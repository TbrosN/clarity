from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from database import supabase
from middleware.auth import get_current_user_id
from models.logs import (
    BaselineMetric,
    BehaviorImpact,
    DailyLogUpsert,
    EnergyEfficiency,
    Insight,
    PersonalBaselinesResponse,
    ResponseValueUpdate,
)


router = APIRouter(tags=["logs"])

QUESTION_META: dict[str, dict[str, str]] = {
    # Core fields
    "wakeTime": {"response_type": "time", "category": "sleep"},
    "stress": {"response_type": "likert", "category": "stress"},
    "sleepQuality": {"response_type": "likert", "category": "sleep"},
    # Before Bed Survey fields
    "plannedSleepTime": {"response_type": "time", "category": "sleep"},
    # Stored as text in `questions.response_type` to satisfy DB constraints.
    # Ordinal scoring is derived from ORDINAL_SCORES during response upsert.
    "lastMeal": {"response_type": "text", "category": "diet"},
    "screensOff": {"response_type": "text", "category": "sleep"},
    "caffeine": {"response_type": "text", "category": "stimulant"},
    # After Wake Survey fields
    "actualSleepTime": {"response_type": "time", "category": "sleep"},
    "snooze": {"response_type": "text", "category": "sleep"},
    "energy": {"response_type": "likert", "category": "energy"},
    "sleepiness": {"response_type": "likert", "category": "energy"},
}

# Numeric scores for ordinal enum responses (higher = better for sleep/energy)
ORDINAL_SCORES: dict[str, dict[str, int]] = {
    "lastMeal": {
        "3+hours": 5, "2-3hours": 4, "1-2hours": 3, "<1hour": 2, "justAte": 1,
    },
    "screensOff": {
        "2+hours": 5, "1-2hours": 4, "30-60min": 3, "<30min": 2, "stillUsing": 1,
    },
    "caffeine": {
        "none": 5, "before12": 4, "12-2pm": 3, "2-6pm": 2, "after6pm": 1,
    },
    "snooze": {
        "noAlarm": 4, "no": 3, "1-2times": 2, "3+times": 1,
    },
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
    meta = QUESTION_META.get(question_key, {})
    response_type = meta.get("response_type", "text")
    is_ordinal_question = question_key in ORDINAL_SCORES

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

    if is_ordinal_question and isinstance(value, str):
        # Ordinal enums: store both the text label AND a numeric score
        payload["response_text"] = value
        scores = ORDINAL_SCORES.get(question_key, {})
        payload["response_numeric"] = scores.get(value)
    elif response_type == "time" and isinstance(value, str):
        # Time-of-day fields: store in response_time and keep text as fallback
        payload["response_text"] = value
        try:
            parsed = time.fromisoformat(value) if ":" in value else None
            if parsed:
                payload["response_time"] = parsed.isoformat()
        except ValueError:
            pass  # keep as text only if parsing fails
    elif isinstance(value, bool):
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
    """Return the most appropriate display value for a response row.

    Priority: timestamp > time > text (covers ordinal display) > numeric > bool.
    For ordinal responses that have both text and numeric, text is preferred for
    display while the numeric score is exposed separately in the API response.
    """
    if row.get("response_timestamp") is not None:
        return row["response_timestamp"]
    if row.get("response_time") is not None:
        return row["response_time"]
    if row.get("response_text") is not None:
        return row["response_text"]
    if row.get("response_numeric") is not None:
        value = row["response_numeric"]
        return int(value) if float(value).is_integer() else value
    if row.get("response_bool") is not None:
        return row["response_bool"]
    return None


def _extract_value_type(row: dict) -> str:
    if row.get("response_timestamp") is not None:
        return "timestamp"
    if row.get("response_time") is not None:
        return "time"
    # Ordinal: both text label and numeric score are stored
    if row.get("response_text") is not None and row.get("response_numeric") is not None:
        return "ordinal"
    if row.get("response_numeric") is not None:
        return "numeric"
    if row.get("response_bool") is not None:
        return "bool"
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
            "value_numeric": row.get("response_numeric"),
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
            "value_numeric": row.get("response_numeric"),
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


# ---------------------------------------------------------------------------
# Helpers for insights & energy efficiency
# ---------------------------------------------------------------------------

def _compute_sleep_hours(actual_sleep_value: object, wake_value: object) -> float | None:
    """Compute sleep duration in hours from two time-of-day strings (HH:MM or HH:MM:SS)."""
    try:
        sleep_t = time.fromisoformat(str(actual_sleep_value))
        wake_t = time.fromisoformat(str(wake_value))
        sleep_dt = datetime.combine(date.today(), sleep_t)
        wake_dt = datetime.combine(date.today(), wake_t)
        # Handle midnight crossing (e.g. sleep 23:00, wake 07:00)
        if wake_dt <= sleep_dt:
            wake_dt += timedelta(days=1)
        hours = (wake_dt - sleep_dt).total_seconds() / 3600
        # Sanity check: sleep duration should be between 1 and 18 hours
        return hours if 1 <= hours <= 18 else None
    except (ValueError, TypeError):
        return None


def _get_numeric(responses: dict, key: str) -> float | None:
    """Safely extract a numeric value from a response entry (works for both
    likert 'value' and ordinal 'value_numeric')."""
    entry = responses.get(key, {})
    # For ordinal fields, prefer value_numeric; for likert, value is already numeric
    val = entry.get("value_numeric")
    if val is not None and isinstance(val, int | float):
        return float(val)
    val = entry.get("value")
    if isinstance(val, int | float):
        return float(val)
    return None


def _safe_avg(values: list[float]) -> float:
    """Calculate average, returns 0 if empty list."""
    return sum(values) / len(values) if values else 0.0


def _analyze_habits(responses: dict) -> str:
    """Summarize key habits from a day's responses."""
    parts = []
    
    screens = _get_numeric(responses, "screensOff")
    if screens and screens >= 4:
        parts.append("screens off early")
    elif screens and screens <= 2:
        parts.append("screens late")
    
    caffeine = _get_numeric(responses, "caffeine")
    if caffeine and caffeine >= 4:
        parts.append("no/early caffeine")
    elif caffeine and caffeine <= 2:
        parts.append("late caffeine")
    
    meal = _get_numeric(responses, "lastMeal")
    if meal and meal >= 4:
        parts.append("early dinner")
    elif meal and meal <= 2:
        parts.append("late meal")
    
    sleep_quality = _get_numeric(responses, "sleepQuality")
    if sleep_quality:
        parts.append(f"{sleep_quality:.1f}/5 sleep")
    
    energy = _get_numeric(responses, "energy")
    if energy:
        parts.append(f"{energy:.1f}/5 energy")
    
    return ", ".join(parts) if parts else "incomplete data"


# ---------------------------------------------------------------------------
# Insights endpoint
# ---------------------------------------------------------------------------

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

    # ---------- Collect data for analysis ----------
    good_sleep_energy: list[float] = []
    poor_sleep_energy: list[float] = []
    late_screen_sleep: list[float] = []
    early_screen_sleep: list[float] = []
    late_caffeine_sleep: list[float] = []
    early_caffeine_sleep: list[float] = []
    late_meal_sleep: list[float] = []
    early_meal_sleep: list[float] = []
    high_stress_days: int = 0
    sleep_durations: list[float] = []
    long_sleep_energy: list[float] = []
    short_sleep_energy: list[float] = []
    snooze_heavy_energy: list[float] = []
    snooze_light_energy: list[float] = []

    for log in logs:
        responses = log["responses"]

        sleep_quality = _get_numeric(responses, "sleepQuality")
        energy = _get_numeric(responses, "energy")
        screens_score = _get_numeric(responses, "screensOff")
        caffeine_score = _get_numeric(responses, "caffeine")
        meal_score = _get_numeric(responses, "lastMeal")
        stress = _get_numeric(responses, "stress")
        snooze_score = _get_numeric(responses, "snooze")

        # Sleep quality -> morning energy correlation
        if sleep_quality is not None and energy is not None:
            if sleep_quality >= 4:
                good_sleep_energy.append(energy)
            elif sleep_quality <= 2:
                poor_sleep_energy.append(energy)

        # Screen time vs sleep quality (using numeric scores)
        if screens_score is not None and sleep_quality is not None:
            if screens_score <= 2:  # <30min or still using
                late_screen_sleep.append(sleep_quality)
            elif screens_score >= 4:  # 1-2 hours or 2+ hours
                early_screen_sleep.append(sleep_quality)

        # Caffeine timing vs sleep quality
        if caffeine_score is not None and sleep_quality is not None:
            if caffeine_score <= 2:  # 2-6pm or after 6pm
                late_caffeine_sleep.append(sleep_quality)
            elif caffeine_score >= 4:  # none or before 12
                early_caffeine_sleep.append(sleep_quality)

        # Meal timing vs sleep quality
        if meal_score is not None and sleep_quality is not None:
            if meal_score <= 2:  # <1 hour or just ate
                late_meal_sleep.append(sleep_quality)
            elif meal_score >= 4:  # 3+ hours or 2-3 hours
                early_meal_sleep.append(sleep_quality)

        # Stress patterns
        if stress is not None and stress >= 4:
            high_stress_days += 1

        # Sleep duration analysis
        actual_sleep_val = responses.get("actualSleepTime", {}).get("value")
        wake_val = responses.get("wakeTime", {}).get("value")
        duration = _compute_sleep_hours(actual_sleep_val, wake_val)
        if duration is not None:
            sleep_durations.append(duration)
            if energy is not None:
                if duration >= 7:
                    long_sleep_energy.append(energy)
                elif duration < 6:
                    short_sleep_energy.append(energy)

        # Snooze behavior vs energy
        if snooze_score is not None and energy is not None:
            if snooze_score <= 2:  # snoozed 1-2 or 3+ times
                snooze_heavy_energy.append(energy)
            elif snooze_score >= 3:  # no snooze or no alarm
                snooze_light_energy.append(energy)

    # ---------- Generate insights ----------
    output: list[Insight] = []

    # Insight: Sleep quality -> morning energy
    if len(good_sleep_energy) >= 2 and len(poor_sleep_energy) >= 2:
        good_avg = sum(good_sleep_energy) / len(good_sleep_energy)
        poor_avg = sum(poor_sleep_energy) / len(poor_sleep_energy)
        diff = good_avg - poor_avg
        if diff >= 0.5:
            output.append(
                Insight(
                    type="pattern",
                    message=f"When you sleep well, your morning energy averages {good_avg:.1f}/5 vs {poor_avg:.1f}/5 on poor nights.",
                    confidence="high" if diff >= 1.0 else "medium",
                    impact="positive",
                )
            )

    # Insight: Screen time before bed
    if len(early_screen_sleep) >= 2 and len(late_screen_sleep) >= 2:
        early_avg = sum(early_screen_sleep) / len(early_screen_sleep)
        late_avg = sum(late_screen_sleep) / len(late_screen_sleep)
        diff = early_avg - late_avg
        if diff >= 0.5:
            output.append(
                Insight(
                    type="pattern",
                    message=f"Turning off screens earlier is linked to better sleep ({early_avg:.1f}/5 vs {late_avg:.1f}/5).",
                    confidence="medium" if diff < 1.0 else "high",
                    impact="positive",
                )
            )

    # Insight: Late caffeine impact
    if len(early_caffeine_sleep) >= 2 and len(late_caffeine_sleep) >= 2:
        early_avg = sum(early_caffeine_sleep) / len(early_caffeine_sleep)
        late_avg = sum(late_caffeine_sleep) / len(late_caffeine_sleep)
        diff = early_avg - late_avg
        if diff >= 0.5:
            output.append(
                Insight(
                    type="pattern",
                    message=f"Late caffeine appears to hurt your sleep quality ({late_avg:.1f}/5 vs {early_avg:.1f}/5 without).",
                    confidence="medium",
                    impact="negative",
                )
            )

    # Insight: Meal timing impact
    if len(early_meal_sleep) >= 2 and len(late_meal_sleep) >= 2:
        early_avg = sum(early_meal_sleep) / len(early_meal_sleep)
        late_avg = sum(late_meal_sleep) / len(late_meal_sleep)
        diff = early_avg - late_avg
        if diff >= 0.4:
            output.append(
                Insight(
                    type="pattern",
                    message=f"Eating earlier before bed is linked to better sleep ({early_avg:.1f}/5 vs {late_avg:.1f}/5).",
                    confidence="medium" if diff < 0.8 else "high",
                    impact="positive",
                )
            )

    # Insight: Sleep duration and energy
    if len(long_sleep_energy) >= 2 and len(short_sleep_energy) >= 2:
        long_avg = sum(long_sleep_energy) / len(long_sleep_energy)
        short_avg = sum(short_sleep_energy) / len(short_sleep_energy)
        diff = long_avg - short_avg
        if diff >= 0.5:
            avg_duration = sum(sleep_durations) / len(sleep_durations) if sleep_durations else 0
            output.append(
                Insight(
                    type="pattern",
                    message=f"Sleeping 7+ hours gives you more energy ({long_avg:.1f}/5 vs {short_avg:.1f}/5). You average {avg_duration:.1f}h.",
                    confidence="high" if diff >= 1.0 else "medium",
                    impact="positive",
                )
            )

    # Insight: Snooze behavior
    if len(snooze_light_energy) >= 2 and len(snooze_heavy_energy) >= 2:
        light_avg = sum(snooze_light_energy) / len(snooze_light_energy)
        heavy_avg = sum(snooze_heavy_energy) / len(snooze_heavy_energy)
        diff = light_avg - heavy_avg
        if diff >= 0.4:
            output.append(
                Insight(
                    type="pattern",
                    message=f"Days without snoozing tend to start with more energy ({light_avg:.1f}/5 vs {heavy_avg:.1f}/5).",
                    confidence="medium",
                    impact="positive",
                )
            )

    # Insight: Stress patterns
    if high_stress_days >= 3:
        pct = round(high_stress_days / len(logs) * 100)
        output.append(
            Insight(
                type="tip",
                message=f"You reported high stress on {pct}% of evenings. Consider a wind-down routine before bed.",
                confidence="high",
                impact="neutral",
            )
        )

    if not output:
        output.append(
            Insight(
                type="tip",
                message="Keep completing both daily surveys to discover patterns in your sleep and energy.",
            )
        )
        output.append(
            Insight(
                type="tip",
                message="You're building a solid dataset. Meal timing, caffeine, and screen habits will reveal patterns soon.",
            )
        )

    return output[:4]


# ---------------------------------------------------------------------------
# Energy Efficiency endpoint
# ---------------------------------------------------------------------------

@router.get("/energy-efficiency", response_model=EnergyEfficiency)
async def energy_efficiency(user_id: str = Depends(get_current_user_id)):
    """Calculate an overall energy efficiency score (0-100%) based on the last
    7 days of survey responses.  Each day is scored across multiple dimensions
    and averaged.  The scoring uses the same ordinal numeric scales stored by
    the upsert endpoint so the result is consistent with the survey answers."""
    data = await history(days=7, user_id=user_id)
    logs = data["logs"]

    if not logs:
        return EnergyEfficiency(percentage=50, color="#F39C12")

    max_points_per_day = 8.5  # theoretical max across all categories
    total_points = 0.0

    for log in logs:
        responses = log["responses"]
        day_points = 0.0

        # Sleep quality (0-2 points): likert 1-5
        sq = _get_numeric(responses, "sleepQuality")
        if sq is not None:
            day_points += (sq - 1) * 0.5  # 1->0, 5->2

        # Energy level (0-1.5 points): likert 1-5
        energy = _get_numeric(responses, "energy")
        if energy is not None:
            day_points += (energy - 1) * 0.375  # 1->0, 5->1.5

        # Alertness / sleepiness (0-1 point): likert 1-5 (higher = more alert)
        sleepiness = _get_numeric(responses, "sleepiness")
        if sleepiness is not None:
            day_points += (sleepiness - 1) * 0.25  # 1->0, 5->1

        # Screen time management (0-1 point): ordinal 1-5
        screens = _get_numeric(responses, "screensOff")
        if screens is not None:
            day_points += (screens - 1) * 0.25  # 1->0, 5->1

        # Caffeine timing (0-1 point): ordinal 1-5
        caffeine = _get_numeric(responses, "caffeine")
        if caffeine is not None:
            day_points += (caffeine - 1) * 0.25  # 1->0, 5->1

        # Meal timing before bed (0-0.5 points): ordinal 1-5
        meal = _get_numeric(responses, "lastMeal")
        if meal is not None:
            day_points += (meal - 1) * 0.125  # 1->0, 5->0.5

        # Stress level inverted (0-1 point): likert 1(calm)-5(stressed)
        stress = _get_numeric(responses, "stress")
        if stress is not None:
            day_points += (5 - stress) * 0.25  # 1->1, 5->0

        # Snooze behaviour (0-0.5 points): ordinal 1-4
        snooze = _get_numeric(responses, "snooze")
        if snooze is not None:
            day_points += (snooze - 1) * (0.5 / 3)  # 1->0, 4->0.5

        total_points += day_points

    avg_points = total_points / len(logs)
    percentage = round((avg_points / max_points_per_day) * 100)
    percentage = max(0, min(100, percentage))

    if percentage >= 75:
        color = "#27AE60"  # Green
    elif percentage >= 50:
        color = "#F39C12"  # Orange
    elif percentage >= 25:
        color = "#E67E22"  # Dark orange
    else:
        color = "#E74C3C"  # Red

    return EnergyEfficiency(percentage=percentage, color=color)


# ---------------------------------------------------------------------------
# Personal Baselines & Deviations endpoint
# ---------------------------------------------------------------------------

@router.get("/baselines", response_model=PersonalBaselinesResponse)
async def personal_baselines(user_id: str = Depends(get_current_user_id)):
    """Calculate personal baselines across all metrics and show how behaviors
    specifically impact this user's outcomes. This provides personalized context
    beyond just averages."""
    
    data = await history(days=30, user_id=user_id)
    logs = data["logs"]
    
    if len(logs) < 5:
        return PersonalBaselinesResponse(
            baselines=[],
            behavior_impacts=[],
            tracking_days=len(logs),
            last_updated=datetime.now(UTC),
        )
    
    # ---------------------------------------------------------------------------
    # Calculate Personal Baselines
    # ---------------------------------------------------------------------------
    baselines: list[BaselineMetric] = []
    
    # Sleep Quality Baseline
    sleep_qualities = [_get_numeric(log["responses"], "sleepQuality") for log in logs]
    sleep_qualities = [sq for sq in sleep_qualities if sq is not None]
    if len(sleep_qualities) >= 3:
        baseline_sleep = _safe_avg(sleep_qualities)
        recent_sleep = _safe_avg(sleep_qualities[:7]) if len(sleep_qualities) >= 7 else None
        deviation = (recent_sleep - baseline_sleep) if recent_sleep else None
        deviation_pct = (deviation / baseline_sleep * 100) if deviation and baseline_sleep else None
        
        interpretation = None
        if deviation_pct:
            if deviation_pct >= 10:
                interpretation = "significantly better than your baseline"
            elif deviation_pct >= 5:
                interpretation = "better than your baseline"
            elif deviation_pct <= -10:
                interpretation = "significantly worse than your baseline"
            elif deviation_pct <= -5:
                interpretation = "worse than your baseline"
            else:
                interpretation = "consistent with your baseline"
        
        baselines.append(BaselineMetric(
            metric="sleepQuality",
            baseline=round(baseline_sleep, 2),
            current_value=round(recent_sleep, 2) if recent_sleep else None,
            deviation=round(deviation, 2) if deviation else None,
            deviation_percentage=round(deviation_pct, 1) if deviation_pct else None,
            unit="out of 5",
            interpretation=interpretation,
        ))
    
    # Energy Level Baseline
    energy_levels = [_get_numeric(log["responses"], "energy") for log in logs]
    energy_levels = [e for e in energy_levels if e is not None]
    if len(energy_levels) >= 3:
        baseline_energy = _safe_avg(energy_levels)
        recent_energy = _safe_avg(energy_levels[:7]) if len(energy_levels) >= 7 else None
        deviation = (recent_energy - baseline_energy) if recent_energy else None
        deviation_pct = (deviation / baseline_energy * 100) if deviation and baseline_energy else None
        
        interpretation = None
        if deviation_pct:
            if deviation_pct >= 15:
                interpretation = "much higher than your typical energy"
            elif deviation_pct >= 7:
                interpretation = "higher than your typical energy"
            elif deviation_pct <= -15:
                interpretation = "much lower than your typical energy"
            elif deviation_pct <= -7:
                interpretation = "lower than your typical energy"
            else:
                interpretation = "typical for you"
        
        baselines.append(BaselineMetric(
            metric="energy",
            baseline=round(baseline_energy, 2),
            current_value=round(recent_energy, 2) if recent_energy else None,
            deviation=round(deviation, 2) if deviation else None,
            deviation_percentage=round(deviation_pct, 1) if deviation_pct else None,
            unit="out of 5",
            interpretation=interpretation,
        ))
    
    # Sleep Duration Baseline
    sleep_durations = []
    for log in logs:
        responses = log["responses"]
        actual_sleep_val = responses.get("actualSleepTime", {}).get("value")
        wake_val = responses.get("wakeTime", {}).get("value")
        duration = _compute_sleep_hours(actual_sleep_val, wake_val)
        if duration:
            sleep_durations.append(duration)
    
    if len(sleep_durations) >= 3:
        baseline_duration = _safe_avg(sleep_durations)
        recent_duration = _safe_avg(sleep_durations[:7]) if len(sleep_durations) >= 7 else None
        deviation = (recent_duration - baseline_duration) if recent_duration else None
        deviation_pct = (deviation / baseline_duration * 100) if deviation and baseline_duration else None
        
        interpretation = None
        if deviation_pct:
            if deviation_pct >= 10:
                interpretation = f"sleeping {abs(deviation):.1f}h more than your baseline"
            elif deviation_pct >= 5:
                interpretation = f"sleeping slightly more than usual (+{abs(deviation):.1f}h)"
            elif deviation_pct <= -10:
                interpretation = f"sleeping {abs(deviation):.1f}h less than your baseline"
            elif deviation_pct <= -5:
                interpretation = f"sleeping slightly less than usual (-{abs(deviation):.1f}h)"
            else:
                interpretation = "consistent with your typical duration"
        
        baselines.append(BaselineMetric(
            metric="sleepDuration",
            baseline=round(baseline_duration, 2),
            current_value=round(recent_duration, 2) if recent_duration else None,
            deviation=round(deviation, 2) if deviation else None,
            deviation_percentage=round(deviation_pct, 1) if deviation_pct else None,
            unit="hours",
            interpretation=interpretation,
        ))
    
    # Stress Level Baseline
    stress_levels = [_get_numeric(log["responses"], "stress") for log in logs]
    stress_levels = [s for s in stress_levels if s is not None]
    if len(stress_levels) >= 3:
        baseline_stress = _safe_avg(stress_levels)
        recent_stress = _safe_avg(stress_levels[:7]) if len(stress_levels) >= 7 else None
        deviation = (recent_stress - baseline_stress) if recent_stress else None
        deviation_pct = (deviation / baseline_stress * 100) if deviation and baseline_stress else None
        
        interpretation = None
        if deviation_pct:
            if deviation_pct >= 15:
                interpretation = "significantly more stressed than usual"
            elif deviation_pct >= 7:
                interpretation = "more stressed than usual"
            elif deviation_pct <= -15:
                interpretation = "much less stressed than usual"
            elif deviation_pct <= -7:
                interpretation = "less stressed than usual"
            else:
                interpretation = "typical stress levels"
        
        baselines.append(BaselineMetric(
            metric="stress",
            baseline=round(baseline_stress, 2),
            current_value=round(recent_stress, 2) if recent_stress else None,
            deviation=round(deviation, 2) if deviation else None,
            deviation_percentage=round(deviation_pct, 1) if deviation_pct else None,
            unit="out of 5",
            interpretation=interpretation,
        ))
    
    # ---------------------------------------------------------------------------
    # Calculate Behavior Impacts (personalized correlation analysis)
    # ---------------------------------------------------------------------------
    behavior_impacts: list[BehaviorImpact] = []
    
    # Screen Time Impact on Sleep Quality
    early_screen_sleep: list[float] = []
    late_screen_sleep: list[float] = []
    for log in logs:
        responses = log["responses"]
        screens_score = _get_numeric(responses, "screensOff")
        sleep_quality = _get_numeric(responses, "sleepQuality")
        if screens_score and sleep_quality:
            if screens_score >= 4:  # 1-2+ hours before bed
                early_screen_sleep.append(sleep_quality)
            elif screens_score <= 2:  # <30min or still using
                late_screen_sleep.append(sleep_quality)
    
    if len(early_screen_sleep) >= 2 and len(late_screen_sleep) >= 2:
        early_avg = _safe_avg(early_screen_sleep)
        late_avg = _safe_avg(late_screen_sleep)
        impact = early_avg - late_avg
        
        confidence = "high" if len(early_screen_sleep) >= 5 and len(late_screen_sleep) >= 5 else "medium"
        recommendation = None
        if impact >= 0.5:
            recommendation = f"For YOU, turning off screens early consistently improves sleep quality by {impact:.1f} points"
        
        behavior_impacts.append(BehaviorImpact(
            behavior="screensOff",
            behavior_label="Screen Time Management",
            outcome="sleepQuality",
            outcome_label="Sleep Quality",
            when_good=round(early_avg, 2),
            when_poor=round(late_avg, 2),
            your_impact=round(impact, 2),
            sample_size_good=len(early_screen_sleep),
            sample_size_poor=len(late_screen_sleep),
            confidence=confidence,
            recommendation=recommendation,
        ))
    
    # Caffeine Impact on Sleep Quality
    early_caffeine_sleep: list[float] = []
    late_caffeine_sleep: list[float] = []
    for log in logs:
        responses = log["responses"]
        caffeine_score = _get_numeric(responses, "caffeine")
        sleep_quality = _get_numeric(responses, "sleepQuality")
        if caffeine_score and sleep_quality:
            if caffeine_score >= 4:  # none or before 12pm
                early_caffeine_sleep.append(sleep_quality)
            elif caffeine_score <= 2:  # 2-6pm or after 6pm
                late_caffeine_sleep.append(sleep_quality)
    
    if len(early_caffeine_sleep) >= 2 and len(late_caffeine_sleep) >= 2:
        early_avg = _safe_avg(early_caffeine_sleep)
        late_avg = _safe_avg(late_caffeine_sleep)
        impact = early_avg - late_avg
        
        confidence = "high" if len(early_caffeine_sleep) >= 5 and len(late_caffeine_sleep) >= 5 else "medium"
        recommendation = None
        if impact >= 0.5:
            recommendation = f"Your body shows a {impact:.1f} point sleep improvement when avoiding late caffeine"
        elif impact <= -0.3:
            recommendation = "Interestingly, caffeine timing doesn't seem to negatively affect YOUR sleep"
        
        behavior_impacts.append(BehaviorImpact(
            behavior="caffeine",
            behavior_label="Caffeine Timing",
            outcome="sleepQuality",
            outcome_label="Sleep Quality",
            when_good=round(early_avg, 2),
            when_poor=round(late_avg, 2),
            your_impact=round(impact, 2),
            sample_size_good=len(early_caffeine_sleep),
            sample_size_poor=len(late_caffeine_sleep),
            confidence=confidence,
            recommendation=recommendation,
        ))
    
    # Meal Timing Impact on Sleep Quality
    early_meal_sleep: list[float] = []
    late_meal_sleep: list[float] = []
    for log in logs:
        responses = log["responses"]
        meal_score = _get_numeric(responses, "lastMeal")
        sleep_quality = _get_numeric(responses, "sleepQuality")
        if meal_score and sleep_quality:
            if meal_score >= 4:  # 3+ hours or 2-3 hours
                early_meal_sleep.append(sleep_quality)
            elif meal_score <= 2:  # <1 hour or just ate
                late_meal_sleep.append(sleep_quality)
    
    if len(early_meal_sleep) >= 2 and len(late_meal_sleep) >= 2:
        early_avg = _safe_avg(early_meal_sleep)
        late_avg = _safe_avg(late_meal_sleep)
        impact = early_avg - late_avg
        
        confidence = "high" if len(early_meal_sleep) >= 5 and len(late_meal_sleep) >= 5 else "medium"
        recommendation = None
        if impact >= 0.5:
            recommendation = f"Eating dinner earlier gives YOU {impact:.1f} points better sleep"
        
        behavior_impacts.append(BehaviorImpact(
            behavior="lastMeal",
            behavior_label="Meal Timing",
            outcome="sleepQuality",
            outcome_label="Sleep Quality",
            when_good=round(early_avg, 2),
            when_poor=round(late_avg, 2),
            your_impact=round(impact, 2),
            sample_size_good=len(early_meal_sleep),
            sample_size_poor=len(late_meal_sleep),
            confidence=confidence,
            recommendation=recommendation,
        ))
    
    # Sleep Quality Impact on Energy (your personal response)
    good_sleep_energy: list[float] = []
    poor_sleep_energy: list[float] = []
    for log in logs:
        responses = log["responses"]
        sleep_quality = _get_numeric(responses, "sleepQuality")
        energy = _get_numeric(responses, "energy")
        if sleep_quality and energy:
            if sleep_quality >= 4:
                good_sleep_energy.append(energy)
            elif sleep_quality <= 2:
                poor_sleep_energy.append(energy)
    
    if len(good_sleep_energy) >= 2 and len(poor_sleep_energy) >= 2:
        good_avg = _safe_avg(good_sleep_energy)
        poor_avg = _safe_avg(poor_sleep_energy)
        impact = good_avg - poor_avg
        
        confidence = "high" if len(good_sleep_energy) >= 5 and len(poor_sleep_energy) >= 5 else "medium"
        recommendation = None
        if impact >= 0.5:
            recommendation = f"For YOUR body, good sleep translates to {impact:.1f} points more energy"
        
        behavior_impacts.append(BehaviorImpact(
            behavior="sleepQuality",
            behavior_label="Sleep Quality",
            outcome="energy",
            outcome_label="Morning Energy",
            when_good=round(good_avg, 2),
            when_poor=round(poor_avg, 2),
            your_impact=round(impact, 2),
            sample_size_good=len(good_sleep_energy),
            sample_size_poor=len(poor_sleep_energy),
            confidence=confidence,
            recommendation=recommendation,
        ))
    
    # Sleep Duration Impact on Energy (personalized optimal duration)
    long_sleep_energy: list[float] = []
    short_sleep_energy: list[float] = []
    medium_sleep_energy: list[float] = []
    for log in logs:
        responses = log["responses"]
        actual_sleep_val = responses.get("actualSleepTime", {}).get("value")
        wake_val = responses.get("wakeTime", {}).get("value")
        duration = _compute_sleep_hours(actual_sleep_val, wake_val)
        energy = _get_numeric(responses, "energy")
        if duration and energy:
            if duration >= 8:
                long_sleep_energy.append(energy)
            elif duration >= 7:
                medium_sleep_energy.append(energy)
            elif duration < 6.5:
                short_sleep_energy.append(energy)
    
    # Find optimal duration for this specific user
    if len(long_sleep_energy) >= 2 and len(short_sleep_energy) >= 2:
        long_avg = _safe_avg(long_sleep_energy)
        short_avg = _safe_avg(short_sleep_energy)
        medium_avg = _safe_avg(medium_sleep_energy) if len(medium_sleep_energy) >= 2 else None
        
        # Determine what's optimal for THIS user
        best_avg = long_avg
        best_duration = "8+ hours"
        if medium_avg and medium_avg > best_avg:
            best_avg = medium_avg
            best_duration = "7-8 hours"
        
        impact = best_avg - short_avg
        confidence = "medium"
        recommendation = None
        if impact >= 0.5:
            recommendation = f"YOUR optimal sleep duration appears to be {best_duration} (energy: {best_avg:.1f} vs {short_avg:.1f} when short)"
        
        behavior_impacts.append(BehaviorImpact(
            behavior="sleepDuration",
            behavior_label="Sleep Duration",
            outcome="energy",
            outcome_label="Morning Energy",
            when_good=round(best_avg, 2),
            when_poor=round(short_avg, 2),
            your_impact=round(impact, 2),
            sample_size_good=max(len(long_sleep_energy), len(medium_sleep_energy)) if medium_avg else len(long_sleep_energy),
            sample_size_poor=len(short_sleep_energy),
            confidence=confidence,
            recommendation=recommendation,
        ))
    
    # Snooze Behavior Impact on Energy (personalized)
    no_snooze_energy: list[float] = []
    snooze_energy: list[float] = []
    for log in logs:
        responses = log["responses"]
        snooze_score = _get_numeric(responses, "snooze")
        energy = _get_numeric(responses, "energy")
        if snooze_score and energy:
            if snooze_score >= 3:  # no snooze or no alarm
                no_snooze_energy.append(energy)
            elif snooze_score <= 2:  # snoozed 1+ times
                snooze_energy.append(energy)
    
    if len(no_snooze_energy) >= 2 and len(snooze_energy) >= 2:
        no_snooze_avg = _safe_avg(no_snooze_energy)
        snooze_avg = _safe_avg(snooze_energy)
        impact = no_snooze_avg - snooze_avg
        
        confidence = "high" if len(no_snooze_energy) >= 5 and len(snooze_energy) >= 5 else "medium"
        recommendation = None
        if impact >= 0.4:
            recommendation = f"For YOU, getting up immediately adds {impact:.1f} points to morning energy"
        elif impact <= -0.3:
            recommendation = "Interestingly, snoozing doesn't seem to hurt YOUR energy levels"
        
        behavior_impacts.append(BehaviorImpact(
            behavior="snooze",
            behavior_label="Snooze Behavior",
            outcome="energy",
            outcome_label="Morning Energy",
            when_good=round(no_snooze_avg, 2),
            when_poor=round(snooze_avg, 2),
            your_impact=round(impact, 2),
            sample_size_good=len(no_snooze_energy),
            sample_size_poor=len(snooze_energy),
            confidence=confidence,
            recommendation=recommendation,
        ))
    
    # Sort behavior impacts by absolute impact magnitude
    behavior_impacts.sort(key=lambda x: abs(x.your_impact), reverse=True)
    
    return PersonalBaselinesResponse(
        baselines=baselines,
        behavior_impacts=behavior_impacts,
        tracking_days=len(logs),
        last_updated=datetime.now(UTC),
    )


# ---------------------------------------------------------------------------
# DEBUG ENDPOINTS - For Testing Only
# ---------------------------------------------------------------------------

@router.post("/debug/generate-sample-data")
async def generate_sample_data(
    days: int = Query(default=30, ge=7, le=90),
    user_id: str = Depends(get_current_user_id),
):
    """Generate realistic sample data for testing baselines and insights.
    This creates varied patterns to demonstrate the baseline tracking features."""
    
    import random
    
    saved_count = 0
    start_date = datetime.now(UTC).date() - timedelta(days=days)
    
    # Define behavior patterns (some good days, some bad days)
    for day_offset in range(days):
        current_date = start_date + timedelta(days=day_offset)
        
        # Create realistic variation patterns
        is_good_day = random.random() > 0.4  # 60% good days
        is_weekend = current_date.weekday() >= 5
        
        # Sleep timing
        if is_good_day:
            planned_sleep_hour = random.randint(22, 23)
            actual_sleep_hour = planned_sleep_hour + random.randint(0, 1)
            wake_hour = random.randint(6, 8)
        else:
            planned_sleep_hour = random.randint(23, 24)
            actual_sleep_hour = 0 if planned_sleep_hour == 24 else planned_sleep_hour + random.randint(0, 2)
            wake_hour = random.randint(7, 9)
        
        # Before bed survey
        _upsert_response(user_id, current_date, "plannedSleepTime", f"{planned_sleep_hour:02d}:00")
        _upsert_response(user_id, current_date, "stress", random.randint(2, 4) if is_good_day else random.randint(3, 5))
        
        # Screens off - good days turn off earlier
        screens_options = ["2+hours", "1-2hours", "30-60min", "<30min", "stillUsing"]
        if is_good_day:
            _upsert_response(user_id, current_date, "screensOff", random.choice(screens_options[:3]))
        else:
            _upsert_response(user_id, current_date, "screensOff", random.choice(screens_options[2:]))
        
        # Caffeine timing
        caffeine_options = ["none", "before12", "12-2pm", "2-6pm", "after6pm"]
        if is_good_day:
            _upsert_response(user_id, current_date, "caffeine", random.choice(caffeine_options[:3]))
        else:
            _upsert_response(user_id, current_date, "caffeine", random.choice(caffeine_options[1:]))
        
        # Meal timing
        meal_options = ["3+hours", "2-3hours", "1-2hours", "<1hour", "justAte"]
        if is_good_day:
            _upsert_response(user_id, current_date, "lastMeal", random.choice(meal_options[:3]))
        else:
            _upsert_response(user_id, current_date, "lastMeal", random.choice(meal_options[2:]))
        
        # After wake survey
        _upsert_response(user_id, current_date, "actualSleepTime", f"{actual_sleep_hour:02d}:00")
        _upsert_response(user_id, current_date, "wakeTime", f"{wake_hour:02d}:00")
        
        # Sleep quality correlates with behaviors
        base_sleep_quality = 3
        if is_good_day:
            base_sleep_quality += random.randint(1, 2)
        else:
            base_sleep_quality -= random.randint(0, 1)
        sleep_quality = max(1, min(5, base_sleep_quality))
        _upsert_response(user_id, current_date, "sleepQuality", sleep_quality)
        
        # Energy correlates with sleep quality
        energy = max(1, min(5, sleep_quality + random.randint(-1, 1)))
        _upsert_response(user_id, current_date, "energy", energy)
        
        # Sleepiness/alertness
        sleepiness = max(1, min(5, energy + random.randint(-1, 0)))
        _upsert_response(user_id, current_date, "sleepiness", sleepiness)
        
        # Snooze behavior
        snooze_options = ["noAlarm", "no", "1-2times", "3+times"]
        if is_good_day and energy >= 4:
            _upsert_response(user_id, current_date, "snooze", random.choice(snooze_options[:2]))
        else:
            _upsert_response(user_id, current_date, "snooze", random.choice(snooze_options[1:]))
        
        saved_count += 1
    
    return {
        "message": f"Generated {saved_count} days of sample data",
        "days": saved_count,
        "date_range": {
            "start": start_date.isoformat(),
            "end": (start_date + timedelta(days=days-1)).isoformat(),
        },
        "user_id": user_id,
    }


@router.delete("/debug/clear-all-data")
async def clear_all_data(
    confirm: bool = Query(default=False),
    user_id: str = Depends(get_current_user_id),
):
    """Clear all response data for the current user. Use with caution!"""
    
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Must set confirm=true to delete all data"
        )
    
    result = supabase.table("responses").delete().eq("user_id", user_id).execute()
    
    deleted_count = len(result.data) if result.data else 0
    
    return {
        "message": f"Deleted {deleted_count} responses",
        "deleted_count": deleted_count,
        "user_id": user_id,
    }


@router.get("/debug/baseline-summary")
async def baseline_summary(user_id: str = Depends(get_current_user_id)):
    """Quick summary of data available for baseline calculation - useful for debugging."""
    
    data = await history(days=30, user_id=user_id)
    logs = data["logs"]
    
    summary = {
        "total_days": len(logs),
        "metrics": {},
        "behaviors": {},
    }
    
    # Count how many days have each metric
    for log in logs:
        responses = log["responses"]
        for key in ["sleepQuality", "energy", "stress", "sleepiness"]:
            if key in responses:
                summary["metrics"][key] = summary["metrics"].get(key, 0) + 1
        
        for key in ["screensOff", "caffeine", "lastMeal", "snooze"]:
            if key in responses:
                summary["behaviors"][key] = summary["behaviors"].get(key, 0) + 1
    
    # Count sleep duration data
    sleep_duration_count = 0
    for log in logs:
        responses = log["responses"]
        actual_sleep_val = responses.get("actualSleepTime", {}).get("value")
        wake_val = responses.get("wakeTime", {}).get("value")
        if _compute_sleep_hours(actual_sleep_val, wake_val):
            sleep_duration_count += 1
    
    summary["metrics"]["sleepDuration"] = sleep_duration_count
    
    # Check if baselines can be calculated
    summary["ready_for_baselines"] = len(logs) >= 5
    summary["message"] = (
        "✅ Ready for baselines!" if summary["ready_for_baselines"]
        else f"❌ Need {5 - len(logs)} more days of data"
    )
    
    return summary