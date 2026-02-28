from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from config import settings
from database import supabase
from services.email_service import get_clerk_primary_email, send_resend_email


def _build_email_for_reminder(reminder_type: str) -> dict[str, str]:
    if reminder_type == "wake":
        title = "Quick morning check-in"
        body = "Take 60 seconds to complete your After Wake survey in Clarity. Your body will thank you."
        survey_type = "afterWake"
    else:
        title = "Quick evening check-in"
        body = "Take 60 seconds to complete your Before Bed survey in Clarity. Your body will thank you."
        survey_type = "beforeBed"

    survey_url = f"{settings.frontend_app_url}/survey?type={survey_type}"
    subject = f"Clarity reminder: {title}"
    html = (
        f"<p>{body}</p>"
        f'<p><a href="{survey_url}">Open survey</a></p>'
        "<p>You can ignore this message if you already completed it.</p>"
    )
    text = f"{body}\n\nOpen survey: {survey_url}"
    return {"subject": subject, "html": html, "text": text}


def _parse_hhmm(value: str) -> tuple[int, int]:
    hour, minute = value.split(":")
    return int(hour), int(minute)


def should_send_now(pref: dict, now_utc: datetime) -> tuple[bool, str | None]:
    try:
        timezone = ZoneInfo(pref["timezone"])
    except Exception:
        return False, None

    local_now = now_utc.astimezone(timezone)
    hour, minute = _parse_hhmm(pref["target_local_time"])
    target_local = datetime.combine(local_now.date(), time(hour=hour, minute=minute), tzinfo=timezone)
    minutes_since_target = (local_now - target_local).total_seconds() / 60.0

    if minutes_since_target < 0 or minutes_since_target >= settings.reminder_send_window_minutes:
        return False, None

    local_date = local_now.date().isoformat()
    if pref.get("last_sent_local_date") == local_date:
        return False, local_date

    return True, local_date


async def run_reminder_scheduler() -> dict:
    now_utc = datetime.now(timezone.utc)
    response = (
        supabase.table("user_email_preferences")
        .select("id,user_id,reminder_type,target_local_time,timezone,enabled,last_sent_local_date")
        .eq("enabled", True)
        .execute()
    )
    prefs = response.data or []

    summary = {
        "scanned": len(prefs),
        "sent": 0,
        "skipped": 0,
        "failed": 0,
        "window_minutes": settings.reminder_send_window_minutes,
        "run_at_utc": now_utc.isoformat(),
    }

    for pref in prefs:
        should_send, local_date = should_send_now(pref, now_utc)
        if not should_send:
            summary["skipped"] += 1
            continue

        user_email = await get_clerk_primary_email(pref["user_id"])
        if not user_email:
            summary["failed"] += 1
            continue

        message = _build_email_for_reminder(pref["reminder_type"])
        try:
            await send_resend_email(
                to_email=user_email,
                subject=message["subject"],
                html=message["html"],
                text=message["text"],
            )
            (
                supabase.table("user_email_preferences")
                .update({
                    "last_sent_local_date": local_date,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", pref["id"])
                .execute()
            )
            summary["sent"] += 1
        except Exception:
            summary["failed"] += 1

    return summary
