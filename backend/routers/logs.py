from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from database import supabase
from middleware.auth import get_current_user_id
from models.logs import DailyLogUpsert, Insight, ResponseValueUpdate


router = APIRouter(tags=["logs"])

QUESTION_META: dict[str, dict[str, str]] = {
    "bedtime": {"response_type": "timestamp", "category": "sleep"},
    "lastMealTime": {"response_type": "timestamp", "category": "diet"},
    "acneLevel": {"response_type": "likert", "category": "skin"},
    "skinFeeling": {"response_type": "likert", "category": "skin"},
    "energyLevel": {"response_type": "likert", "category": "energy"},
    "mood": {"response_type": "likert", "category": "mood"},
    "stress": {"response_type": "likert", "category": "stress"},
    "sleepQuality": {"response_type": "likert", "category": "sleep"},
    "touchHygiene": {"response_type": "likert", "category": "hygiene"},
    "morningEnergy": {"response_type": "likert", "category": "energy"},
    "morningSunlight": {"response_type": "enum", "category": "sleep"},
    "afternoonEnergy": {"response_type": "likert", "category": "energy"},
    "caffeineCurfew": {"response_type": "enum", "category": "stimulant"},
    "screenWindDown": {"response_type": "enum", "category": "sleep"},
    "bedtimeDigestion": {"response_type": "likert", "category": "diet"},
    "waterIntake": {"response_type": "likert", "category": "diet"},
    "sugarIntake": {"response_type": "likert", "category": "diet"},
}


def _get_question_map() -> dict[int, str]:
    response = supabase.table("questions").select("id,key").execute()
    return {row["id"]: row["key"] for row in response.data}


def _ensure_question(question_key: str) -> int:
    existing = supabase.table("questions").select("id").eq("key", question_key).limit(1).execute()
    if existing.data:
        return existing.data[0]["id"]

    meta = QUESTION_META.get(question_key, {"response_type": "text", "category": "general"})
    created = (
        supabase.table("questions")
        .insert(
            {
                "key": question_key,
                "label": question_key,
                "category": meta["category"],
                "response_type": meta["response_type"],
                "active": True,
            }
        )
        .execute()
    )
    return created.data[0]["id"]


def _upsert_response(user_id: str, local_date: date, question_key: str, value: object) -> dict:
    question_id = _ensure_question(question_key)
    payload: dict[str, object] = {
        "user_id": user_id,
        "question_id": question_id,
        "local_date": local_date.isoformat(),
        "recorded_at": datetime.now(UTC).isoformat(),
        "response_numeric": None,
        "response_text": None,
        "response_bool": None,
        "response_time": None,
        "response_timestamp": None,
    }

    if isinstance(value, bool):
        payload["response_bool"] = value
    elif isinstance(value, int | float):
        payload["response_numeric"] = value
    elif isinstance(value, datetime):
        payload["response_timestamp"] = value.isoformat()
    else:
        payload["response_text"] = str(value)

    existing = (
        supabase.table("responses")
        .select("id")
        .eq("user_id", user_id)
        .eq("question_id", question_id)
        .eq("local_date", local_date.isoformat())
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
    if existing.data:
        response = (
            supabase.table("responses")
            .update(payload)
            .eq("id", existing.data[0]["id"])
            .execute()
        )
        return response.data[0]

    response = supabase.table("responses").insert(payload).execute()
    return response.data[0]


def _extract_value(row: dict) -> object:
    if row.get("response_timestamp") is not None:
        return row["response_timestamp"]
    if row.get("response_numeric") is not None:
        value = row["response_numeric"]
        return int(value) if float(value).is_integer() else value
    if row.get("response_bool") is not None:
        return row["response_bool"]
    if row.get("response_time") is not None:
        return row["response_time"]
    return row.get("response_text")


def _extract_value_type(row: dict) -> str:
    if row.get("response_timestamp") is not None:
        return "timestamp"
    if row.get("response_numeric") is not None:
        return "numeric"
    if row.get("response_bool") is not None:
        return "bool"
    if row.get("response_time") is not None:
        return "time"
    return "text"


@router.post("/logs/upsert")
async def upsert_log(payload: DailyLogUpsert, user_id: str = Depends(get_current_user_id)):
    body = payload.model_dump(exclude_none=True)
    local_date = body.pop("date")
    saved: list[dict] = []

    for field_name, value in body.items():
        saved.append(_upsert_response(user_id=user_id, local_date=local_date, question_key=field_name, value=value))

    return {"saved": saved}


@router.get("/logs/history")
async def history(
    days: int = Query(default=30, ge=1, le=365),
    user_id: str = Depends(get_current_user_id),
):
    since = (datetime.now(UTC).date() - timedelta(days=days)).isoformat()
    question_map = _get_question_map()
    response = (
        supabase.table("responses")
        .select("id,question_id,local_date,response_numeric,response_text,response_bool,response_time,response_timestamp")
        .eq("user_id", user_id)
        .gte("local_date", since)
        .order("local_date", desc=True)
        .execute()
    )

    grouped: dict[str, dict] = defaultdict(dict)
    for row in response.data:
        local_date = row["local_date"]
        question_key = question_map.get(row["question_id"])
        if not question_key:
            continue
        if "date" not in grouped[local_date]:
            grouped[local_date]["date"] = local_date
            grouped[local_date]["responses"] = {}
        grouped[local_date]["responses"][question_key] = {
            "id": row["id"],
            "value": _extract_value(row),
            "value_type": _extract_value_type(row),
        }

    logs = list(grouped.values())
    logs.sort(key=lambda item: item["date"], reverse=True)
    return {"logs": logs}

@router.get("/logs/{log_date}")
async def log_by_date(log_date: date, user_id: str = Depends(get_current_user_id)):
    question_map = _get_question_map()
    response = (
        supabase.table("responses")
        .select("id,question_id,local_date,response_numeric,response_text,response_bool,response_time,response_timestamp")
        .eq("user_id", user_id)
        .eq("local_date", log_date.isoformat())
        .order("recorded_at", desc=False)
        .execute()
    )
    if not response.data:
        return {"log": None}

    log: dict[str, object] = {"date": log_date.isoformat(), "responses": {}}
    for row in response.data:
        question_key = question_map.get(row["question_id"])
        if not question_key:
            continue
        log["responses"][question_key] = {
            "id": row["id"],
            "value": _extract_value(row),
            "value_type": _extract_value_type(row),
        }
    return {"log": log}


@router.put("/responses/{response_id}")
async def update_response(
    response_id: int,
    payload: ResponseValueUpdate,
    user_id: str = Depends(get_current_user_id),
):
    existing = (
        supabase.table("responses")
        .select("id")
        .eq("id", response_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Response not found")

    update_payload = {
        "response_numeric": payload.value_numeric,
        "response_bool": payload.value_bool,
        "response_text": payload.value_text,
        "response_time": payload.value_time.isoformat() if payload.value_time else None,
        "response_timestamp": payload.value_timestamp.isoformat() if payload.value_timestamp else None,
        "recorded_at": datetime.now(UTC).isoformat(),
    }
    updated = supabase.table("responses").update(update_payload).eq("id", response_id).execute()
    return {"response": updated.data[0]}


@router.get("/insights", response_model=list[Insight])
async def insights(user_id: str = Depends(get_current_user_id)):
    data = await history(days=60, user_id=user_id)
    logs = data["logs"]

    if len(logs) < 5:
        return [
            Insight(
                type="tip",
                message="Keep logging for a few more days to unlock personalized energy insights.",
            )
        ]

    meal_before_7: list[float] = []
    meal_after_7: list[float] = []
    no_caffeine: list[float] = []
    with_caffeine: list[float] = []
    low_stress_skin: list[float] = []
    high_stress_skin: list[float] = []

    for log in logs:
        responses = log["responses"]
        energy_values: list[float] = []
        if "morningEnergy" in responses:
            energy_values.append(float(responses["morningEnergy"]["value"]))
        if "afternoonEnergy" in responses:
            energy_values.append(float(responses["afternoonEnergy"]["value"]))
        if not energy_values:
            continue
        avg_energy = sum(energy_values) / len(energy_values)

        meal_value = responses.get("lastMealTime", {}).get("value")
        if isinstance(meal_value, str):
            try:
                hour = datetime.fromisoformat(meal_value.replace("Z", "+00:00")).hour
                if hour < 19:
                    meal_before_7.append(avg_energy)
                else:
                    meal_after_7.append(avg_energy)
            except ValueError:
                pass

        caffeine_value = responses.get("caffeineCurfew", {}).get("value")
        if isinstance(caffeine_value, int | float):
            if int(caffeine_value) == 1:
                no_caffeine.append(avg_energy)
            if int(caffeine_value) == 2:
                with_caffeine.append(avg_energy)

        stress_value = responses.get("stress", {}).get("value")
        acne_value = responses.get("acneLevel", {}).get("value")
        if isinstance(stress_value, int | float) and isinstance(acne_value, int | float):
            if int(stress_value) <= 2:
                low_stress_skin.append(float(acne_value))
            if int(stress_value) >= 4:
                high_stress_skin.append(float(acne_value))

    output: list[Insight] = []

    if meal_before_7 and meal_after_7:
        early_avg = sum(meal_before_7) / len(meal_before_7)
        late_avg = sum(meal_after_7) / len(meal_after_7)
        if late_avg > 0 and early_avg > late_avg:
            pct = int(((early_avg - late_avg) / late_avg) * 100)
            output.append(
                Insight(
                    type="pattern",
                    message=f"When your last meal is before 7 PM, your energy is about {pct}% higher.",
                    confidence="medium",
                    impact="positive",
                )
            )

    if no_caffeine and with_caffeine:
        no_caf_avg = sum(no_caffeine) / len(no_caffeine)
        caf_avg = sum(with_caffeine) / len(with_caffeine)
        if caf_avg > no_caf_avg:
            output.append(
                Insight(
                    type="pattern",
                    message="Afternoon caffeine looks linked to lower same-day energy consistency.",
                    confidence="low",
                    impact="negative",
                )
            )

    if low_stress_skin and high_stress_skin:
        low_stress_avg = sum(low_stress_skin) / len(low_stress_skin)
        high_stress_avg = sum(high_stress_skin) / len(high_stress_skin)
        if high_stress_avg > low_stress_avg:
            output.append(
                Insight(
                    type="pattern",
                    message="Higher-stress days are showing worse skin outcomes in your recent logs.",
                    confidence="low",
                    impact="negative",
                )
            )

    if not output:
        output.append(
            Insight(
                type="tip",
                message="You’re building a solid dataset. Keep logging meal timing, caffeine, and energy for stronger patterns.",
            )
        )

    return output[:3]
