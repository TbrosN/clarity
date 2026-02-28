from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from services.reminder_scheduler import settings, should_send_now


def test_should_send_now_within_window_and_not_sent_today(monkeypatch):
    monkeypatch.setattr(settings, "reminder_send_window_minutes", 1)
    now_utc = datetime.now(timezone.utc)
    local_now = now_utc.astimezone(ZoneInfo("America/New_York"))
    pref = {
        "timezone": "America/New_York",
        "target_local_time": local_now.strftime("%H:%M"),
        "last_sent_local_date": None,
    }

    should_send, local_date = should_send_now(pref, now_utc)
    assert should_send is True
    assert local_date == local_now.date().isoformat()


def test_should_not_send_when_already_sent_for_local_date(monkeypatch):
    monkeypatch.setattr(settings, "reminder_send_window_minutes", 1)
    now_utc = datetime.now(timezone.utc)
    local_now = now_utc.astimezone(ZoneInfo("America/New_York"))
    local_date = local_now.date().isoformat()
    pref = {
        "timezone": "America/New_York",
        "target_local_time": local_now.strftime("%H:%M"),
        "last_sent_local_date": local_date,
    }

    should_send, returned_local_date = should_send_now(pref, now_utc)
    assert should_send is False
    assert returned_local_date == local_date


def test_should_not_send_when_outside_window(monkeypatch):
    monkeypatch.setattr(settings, "reminder_send_window_minutes", 1)
    now_utc = datetime.now(timezone.utc)
    local_now = now_utc.astimezone(ZoneInfo("America/New_York"))
    older_local_time = (local_now - timedelta(minutes=2)).strftime("%H:%M")
    pref = {
        "timezone": "America/New_York",
        "target_local_time": older_local_time,
        "last_sent_local_date": None,
    }

    should_send, local_date = should_send_now(pref, now_utc)
    assert should_send is False
    assert local_date is None
