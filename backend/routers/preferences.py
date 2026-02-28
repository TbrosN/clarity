from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import supabase
from middleware.auth import get_current_user_id

DEFAULT_WAKE_TIME = "07:00"
DEFAULT_WIND_DOWN_TIME = "22:30"

ReminderType = Literal["wake", "wind_down"]

router = APIRouter(tags=["preferences"])


class ReminderPreferencePatch(BaseModel):
    target_local_time: str | None = Field(default=None, pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
    enabled: bool | None = None


class EmailReminderPreferencesUpdate(BaseModel):
    timezone: str | None = None
    wake: ReminderPreferencePatch | None = None
    wind_down: ReminderPreferencePatch | None = None


class TimezoneUpdateRequest(BaseModel):
    timezone: str


def _validate_timezone(timezone: str) -> str:
    try:
        ZoneInfo(timezone)
        return timezone
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid timezone.") from exc


def _default_time(reminder_type: ReminderType) -> str:
    return DEFAULT_WAKE_TIME if reminder_type == "wake" else DEFAULT_WIND_DOWN_TIME


def _normalize_row(row: dict | None, reminder_type: ReminderType, fallback_timezone: str) -> dict:
    row = row or {}
    return {
        "reminder_type": reminder_type,
        "target_local_time": row.get("target_local_time") or _default_time(reminder_type),
        "timezone": row.get("timezone") or fallback_timezone,
        "enabled": bool(row.get("enabled", True)),
        "last_sent_local_date": row.get("last_sent_local_date"),
    }


def _fetch_user_preferences(user_id: str) -> dict[ReminderType, dict]:
    response = (
        supabase.table("user_email_preferences")
        .select("reminder_type,target_local_time,timezone,enabled,last_sent_local_date")
        .eq("user_id", user_id)
        .execute()
    )
    rows = response.data or []
    mapped = {row["reminder_type"]: row for row in rows if row.get("reminder_type") in {"wake", "wind_down"}}
    timezone = "UTC"
    if mapped.get("wake", {}).get("timezone"):
        timezone = str(mapped["wake"]["timezone"])
    elif mapped.get("wind_down", {}).get("timezone"):
        timezone = str(mapped["wind_down"]["timezone"])

    return {
        "wake": _normalize_row(mapped.get("wake"), "wake", timezone),
        "wind_down": _normalize_row(mapped.get("wind_down"), "wind_down", timezone),
    }


def _upsert_preference(
    *,
    user_id: str,
    reminder_type: ReminderType,
    patch: ReminderPreferencePatch | None,
    existing: dict,
    timezone: str,
) -> None:
    patch = patch or ReminderPreferencePatch()
    now = datetime.now(dt_timezone.utc).isoformat()
    target_time = patch.target_local_time or existing["target_local_time"]
    new_enabled = patch.enabled if patch.enabled is not None else existing["enabled"]

    existing_resp = (
        supabase.table("user_email_preferences")
        .select("id")
        .eq("user_id", user_id)
        .eq("reminder_type", reminder_type)
        .execute()
    )

    if existing_resp.data:
        row_id = existing_resp.data[0]["id"]
        (
            supabase.table("user_email_preferences")
            .update({
                "target_local_time": target_time,
                "timezone": timezone,
                "enabled": new_enabled,
                "updated_at": now,
            })
            .eq("id", row_id)
            .execute()
        )
    else:
        (
            supabase.table("user_email_preferences")
            .insert({
                "user_id": user_id,
                "reminder_type": reminder_type,
                "target_local_time": target_time,
                "timezone": timezone,
                "enabled": new_enabled,
                "updated_at": now,
            })
            .execute()
        )


@router.get("/preferences/email-reminders")
async def get_email_reminder_preferences(user_id: str = Depends(get_current_user_id)):
    prefs = _fetch_user_preferences(user_id)
    return {
        "wake": prefs["wake"],
        "wind_down": prefs["wind_down"],
        "timezone": prefs["wake"]["timezone"],
    }


@router.put("/preferences/email-reminders")
async def upsert_email_reminder_preferences(
    payload: EmailReminderPreferencesUpdate,
    user_id: str = Depends(get_current_user_id),
):
    existing = _fetch_user_preferences(user_id)
    timezone = payload.timezone or existing["wake"]["timezone"] or "UTC"
    timezone = _validate_timezone(timezone)

    _upsert_preference(
        user_id=user_id,
        reminder_type="wake",
        patch=payload.wake,
        existing=existing["wake"],
        timezone=timezone,
    )
    _upsert_preference(
        user_id=user_id,
        reminder_type="wind_down",
        patch=payload.wind_down,
        existing=existing["wind_down"],
        timezone=timezone,
    )

    prefs = _fetch_user_preferences(user_id)
    return {
        "wake": prefs["wake"],
        "wind_down": prefs["wind_down"],
        "timezone": prefs["wake"]["timezone"],
    }


@router.post("/preferences/timezone")
async def update_timezone(payload: TimezoneUpdateRequest, user_id: str = Depends(get_current_user_id)):
    timezone = _validate_timezone(payload.timezone)
    existing = _fetch_user_preferences(user_id)

    _upsert_preference(
        user_id=user_id,
        reminder_type="wake",
        patch=None,
        existing=existing["wake"],
        timezone=timezone,
    )
    _upsert_preference(
        user_id=user_id,
        reminder_type="wind_down",
        patch=None,
        existing=existing["wind_down"],
        timezone=timezone,
    )

    prefs = _fetch_user_preferences(user_id)
    return {
        "timezone": prefs["wake"]["timezone"],
        "wake": prefs["wake"],
        "wind_down": prefs["wind_down"],
    }
