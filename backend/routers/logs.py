from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from database import supabase
from middleware.auth import get_current_user_id
from models.logs import DailyLogUpsert, Insight, ResponseValueUpdate


router = APIRouter(tags=["logs"])

QUESTION_META: dict[str, dict[str, str]] = {
    # Core fields
    "wakeTime": {"response_type": "timestamp", "category": "sleep"},
    "stress": {"response_type": "likert", "category": "stress"},
    "sleepQuality": {"response_type": "likert", "category": "sleep"},
    # Before Bed Survey fields
    "plannedSleepTime": {"response_type": "text", "category": "sleep"},
    "lastMeal": {"response_type": "text", "category": "diet"},
    "screensOff": {"response_type": "text", "category": "sleep"},
    "caffeine": {"response_type": "text", "category": "stimulant"},
    # After Wake Survey fields
    "actualSleepTime": {"response_type": "text", "category": "sleep"},
    "snooze": {"response_type": "text", "category": "sleep"},
    "energy": {"response_type": "likert", "category": "energy"},
    "sleepiness": {"response_type": "likert", "category": "energy"},
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
    data = await history(days=30, user_id=user_id)
    logs = data["logs"]

    if len(logs) < 5:
        return [
            Insight(
                type="tip",
                message="Keep completing your daily surveys to unlock personalized sleep and stress insights.",
            )
        ]

    # Collect data for analysis
    good_sleep_energy: list[float] = []
    poor_sleep_energy: list[float] = []
    late_screen_sleep: list[float] = []
    early_screen_sleep: list[float] = []
    late_caffeine_sleep: list[float] = []
    no_caffeine_sleep: list[float] = []
    high_stress_days: int = 0

    for log in logs:
        responses = log["responses"]
        
        # Get sleep quality and morning energy
        sleep_quality = responses.get("sleepQuality", {}).get("value")
        energy = responses.get("energy", {}).get("value")
        
        if isinstance(sleep_quality, int | float) and isinstance(energy, int | float):
            if int(sleep_quality) >= 4:  # Good sleep
                good_sleep_energy.append(float(energy))
            elif int(sleep_quality) <= 2:  # Poor sleep
                poor_sleep_energy.append(float(energy))
        
        # Analyze screen time vs sleep quality
        screens_off = responses.get("screensOff", {}).get("value")
        if isinstance(screens_off, str) and isinstance(sleep_quality, int | float):
            if screens_off in ["<30min", "stillUsing"]:
                late_screen_sleep.append(float(sleep_quality))
            elif screens_off in ["2+hours", "1-2hours"]:
                early_screen_sleep.append(float(sleep_quality))
        
        # Analyze caffeine vs sleep quality
        caffeine = responses.get("caffeine", {}).get("value")
        if isinstance(caffeine, str) and isinstance(sleep_quality, int | float):
            if caffeine in ["2-6pm", "after6pm"]:
                late_caffeine_sleep.append(float(sleep_quality))
            elif caffeine in ["none", "before12"]:
                no_caffeine_sleep.append(float(sleep_quality))
        
        # Track stress patterns
        stress = responses.get("stress", {}).get("value")
        if isinstance(stress, int | float) and int(stress) >= 4:
            high_stress_days += 1

    output: list[Insight] = []

    # Insight: Sleep quality and morning energy
    if good_sleep_energy and poor_sleep_energy and len(good_sleep_energy) >= 2 and len(poor_sleep_energy) >= 2:
        good_avg = sum(good_sleep_energy) / len(good_sleep_energy)
        poor_avg = sum(poor_sleep_energy) / len(poor_sleep_energy)
        if good_avg > poor_avg and (good_avg - poor_avg) >= 0.5:
            output.append(
                Insight(
                    type="pattern",
                    message="Better sleep quality is linked to higher morning energy levels.",
                    confidence="medium",
                    impact="positive",
                )
            )

    # Insight: Screen time before bed
    if early_screen_sleep and late_screen_sleep and len(early_screen_sleep) >= 2 and len(late_screen_sleep) >= 2:
        early_avg = sum(early_screen_sleep) / len(early_screen_sleep)
        late_avg = sum(late_screen_sleep) / len(late_screen_sleep)
        if early_avg > late_avg and (early_avg - late_avg) >= 0.5:
            output.append(
                Insight(
                    type="pattern",
                    message="Turning off screens earlier is associated with better sleep quality.",
                    confidence="medium",
                    impact="positive",
                )
            )

    # Insight: Late caffeine impact
    if no_caffeine_sleep and late_caffeine_sleep and len(no_caffeine_sleep) >= 2 and len(late_caffeine_sleep) >= 2:
        no_caf_avg = sum(no_caffeine_sleep) / len(no_caffeine_sleep)
        late_caf_avg = sum(late_caffeine_sleep) / len(late_caffeine_sleep)
        if no_caf_avg > late_caf_avg and (no_caf_avg - late_caf_avg) >= 0.5:
            output.append(
                Insight(
                    type="pattern",
                    message="Late afternoon/evening caffeine appears to impact your sleep quality.",
                    confidence="low",
                    impact="negative",
                )
            )

    # Insight: Stress patterns
    if high_stress_days >= 3:
        output.append(
            Insight(
                type="tip",
                message="You've had several high-stress evenings recently. Consider relaxation techniques before bed.",
                confidence="high",
                impact="neutral",
            )
        )

    if not output:
        output.append(
            Insight(
                type="tip",
                message="Keep completing both daily surveys to discover patterns in your sleep and stress levels.",
            )
        )

        output.append(
            Insight(
                type="tip",
                message="You’re building a solid dataset. Keep logging meal timing, caffeine, and energy for stronger patterns.",
            )
        )

    return output[:3]
