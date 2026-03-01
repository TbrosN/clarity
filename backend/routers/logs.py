import logging
from collections import defaultdict
from datetime import date, datetime, time, timedelta, UTC
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from config import settings
from database import supabase
from middleware.auth import get_current_user_id
from models.logs import (
    BaselineMetric,
    BehaviorImpact,
    DailyLogUpsert,
    Insight,
    PersonalBaselinesResponse,
    ResponseValueUpdate,
)
from services.insight_llm import (
    LLMInsightsClient,
    map_to_api_insights,
    validate_llm_response,
)
from services.insight_recent_surveys import build_recent_survey_payload
from services.reminder_scheduler import run_reminder_scheduler


router = APIRouter(tags=["logs"])
logger = logging.getLogger(__name__)

QUESTION_META: dict[str, dict[str, str]] = {
    # Before Bed Survey fields
    "sleepTime": {"response_type": "text", "category": "sleep"},
    # Stored as text in `questions.response_type` to satisfy DB constraints.
    # Ordinal scoring is derived from ORDINAL_SCORES during response upsert.
    "lastMeal": {"response_type": "text", "category": "diet"},
    "screensOff": {"response_type": "text", "category": "sleep"},
    "caffeine": {"response_type": "text", "category": "stimulant"},
    # After Wake Survey fields
    "sleepiness": {"response_type": "likert", "category": "alertness"},
    "morningLight": {"response_type": "text", "category": "behavior"},
}

# Numeric scores for ordinal enum responses (higher = better for sleep/alertness)
ORDINAL_SCORES: dict[str, dict[str, int]] = {
    "sleepTime": {
        "1hr": 3, "30mins": 2, "<30mins": 1,
    },
    "lastMeal": {
        "4": 4, "3": 3, "2": 2, "1": 1,
    },
    "screensOff": {
        "60": 3, "30-60": 2, "<30mins": 1,
    },
    "caffeine": {
        "before12": 4, "12-2pm": 3, "2-6pm": 2, "after6pm": 1,
    },
    "morningLight": {
        "0-30mins": 3, "30-60mins": 2, "none": 1,
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

# ---------------------------------------------------------------------------
# Insights endpoint
# ---------------------------------------------------------------------------

@router.get("/insights", response_model=list[Insight])
async def insights(user_id: str = Depends(get_current_user_id)):
    data = await history(days=settings.insights_window_days, user_id=user_id)
    logs = data["logs"]
    user_hint = user_id[:8] if user_id else "unknown"
    logger.info(
        "Insights request: user=%s logs_count=%d window_days=%d",
        user_hint,
        len(logs),
        settings.insights_window_days,
    )

    if not settings.llm_insights_enabled or not settings.llm_api_key:
        logger.warning(
            "Insights fallback (LLM disabled/missing key): user=%s enabled=%s has_api_key=%s",
            user_hint,
            settings.llm_insights_enabled,
            bool(settings.llm_api_key),
        )
        return [
            Insight(
                type="tip",
                message="Insights are temporarily unavailable. Enable LLM insights to generate personalized reminders.",
            )
        ]

    survey_results = build_recent_survey_payload(logs=logs, window_days=settings.insights_window_days, max_surveys=10)
    logger.info(
        "Insights payload built: user=%s logs_count=%d fact_count=%d summary_fact_count=%d date_start=%s date_end=%s",
        user_hint,
        survey_results.logs_count,
        len(survey_results.fact_registry),
        len(survey_results.summary_fact_ids),
        survey_results.date_start,
        survey_results.date_end,
    )

    llm_client = LLMInsightsClient(
        api_key=settings.llm_api_key,
        model=settings.llm_model,
        base_url=settings.llm_base_url,
        timeout_seconds=settings.llm_timeout_seconds,
    )

    try:
        llm_response = await llm_client.generate(survey_results, max_insights=settings.llm_insights_max_items)
        validation = validate_llm_response(llm_response, survey_results)
        if not validation.valid:
            logger.warning(
                "Insights validation failed (attempt 1): user=%s errors=%s",
                user_hint,
                validation.errors,
            )
            # One repair attempt as a simple retry path.
            llm_response = await llm_client.generate(survey_results, max_insights=settings.llm_insights_max_items)
            validation = validate_llm_response(llm_response, survey_results)
        if validation.valid:
            insights_with_citations = map_to_api_insights(llm_response, survey_results)
            if insights_with_citations:
                logger.info(
                    "Insights success: user=%s generated_count=%d",
                    user_hint,
                    len(insights_with_citations),
                )
                return insights_with_citations[: settings.llm_insights_max_items]
            logger.warning(
                "Insights mapping produced empty output: user=%s llm_items=%d",
                user_hint,
                len(llm_response.insights),
            )
        else:
            logger.warning(
                "Insights validation failed (attempt 2): user=%s errors=%s",
                user_hint,
                validation.errors,
            )
    except Exception:
        logger.exception(
            "Error generating insights: user=%s logs_count=%d fact_count=%d",
            user_hint,
            survey_results.logs_count,
            len(survey_results.fact_registry),
        )
        return [
            Insight(
                type="tip",
                message="There was an error generating insights. Please try again later.",
            )
        ]

    logger.warning(
        "Insights fallback (no valid insights): user=%s logs_count=%d fact_count=%d",
        user_hint,
        survey_results.logs_count,
        len(survey_results.fact_registry),
    )
    return [
        Insight(
            type="tip",
            message="No insights are available right now. Complete more surveys and try again soon.",
        )
    ]

# ---------------------------------------------------------------------------
# Personal Baselines & Deviations endpoint
# ---------------------------------------------------------------------------

@router.get("/baselines", response_model=PersonalBaselinesResponse)
async def personal_baselines(user_id: str = Depends(get_current_user_id)):
    """Calculate personal baselines using only currently active survey fields."""
    data = await history(days=30, user_id=user_id)
    logs = data["logs"]

    baselines: list[BaselineMetric] = []
    behavior_impacts: list[BehaviorImpact] = []

    metric_units: dict[str, str] = {
        "sleepiness": "out of 5",
        "sleepTime": "ordinal score",
        "screensOff": "ordinal score",
        "caffeine": "ordinal score",
        "lastMeal": "ordinal score",
        "morningLight": "ordinal score",
    }
    for metric, unit in metric_units.items():
        values = [_get_numeric(log["responses"], metric) for log in logs]
        values = [value for value in values if value is not None]
        baseline = _safe_avg(values)
        recent = _safe_avg(values[:7]) if len(values) >= 7 else None
        deviation = (recent - baseline) if recent is not None else None
        deviation_pct = (deviation / baseline * 100) if deviation is not None and baseline else None
        baselines.append(
            BaselineMetric(
                metric=metric,
                baseline=round(baseline, 2),
                current_value=round(recent, 2) if recent is not None else None,
                deviation=round(deviation, 2) if deviation is not None else None,
                deviation_percentage=round(deviation_pct, 1) if deviation_pct is not None else None,
                unit=unit,
                interpretation=None,
            )
        )

    behavior_impacts.sort(key=lambda x: abs(x.your_impact), reverse=True)
    return PersonalBaselinesResponse(
        baselines=baselines,
        behavior_impacts=behavior_impacts,
        tracking_days=len(logs),
        last_updated=datetime.now(UTC),
    )

@router.post("/internal/reminders/run")
async def run_internal_reminders(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    if not settings.internal_cron_secret:
        raise HTTPException(
            status_code=500,
            detail="Cron secret is not configured.",
        )
    if x_cron_secret != settings.internal_cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    summary = await run_reminder_scheduler()
    return {"ok": True, **summary}

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

        # Before bed survey
        sleep_time_options = ["1hr", "30mins", "<30mins"]
        screens_options = ["60", "30-60", "<30mins"]
        caffeine_options = ["before12", "12-2pm", "2-6pm", "after6pm"]
        meal_options = ["4", "3", "2", "1"]
        if is_good_day:
            _upsert_response(user_id, current_date, "sleepTime", random.choice(sleep_time_options[:2]))
            _upsert_response(user_id, current_date, "screensOff", random.choice(screens_options[:2]))
            _upsert_response(user_id, current_date, "caffeine", random.choice(caffeine_options[:2]))
            _upsert_response(user_id, current_date, "lastMeal", random.choice(meal_options[:2]))
        else:
            _upsert_response(user_id, current_date, "sleepTime", random.choice(sleep_time_options[1:]))
            _upsert_response(user_id, current_date, "screensOff", random.choice(screens_options[1:]))
            _upsert_response(user_id, current_date, "caffeine", random.choice(caffeine_options[2:]))
            _upsert_response(user_id, current_date, "lastMeal", random.choice(meal_options[1:]))

        # Morning survey
        light_options = ["0-30mins", "30-60mins", "none"]
        if is_good_day and not is_weekend:
            _upsert_response(user_id, current_date, "morningLight", random.choice(light_options[:2]))
            sleepiness = random.randint(3, 5)
        else:
            _upsert_response(user_id, current_date, "morningLight", random.choice(light_options[1:]))
            sleepiness = random.randint(1, 4)
        _upsert_response(user_id, current_date, "sleepiness", sleepiness)

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
