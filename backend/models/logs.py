from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict, Field


class DailyLogUpsert(BaseModel):
    model_config = ConfigDict(extra="allow")

    date: date
    wakeTime: str | None = None  # Time string (HH:mm)
    stress: int | None = Field(default=None, ge=1, le=5)
    sleepQuality: int | None = Field(default=None, ge=1, le=5)
    
    # Before Bed Survey fields
    plannedSleepTime: str | None = None  # Time string (HH:mm)
    lastMeal: str | None = None  # "3+hours" | "2-3hours" | "1-2hours" | "<1hour" | "justAte"
    screensOff: str | None = None  # "2+hours" | "1-2hours" | "30-60min" | "<30min" | "stillUsing"
    caffeine: str | None = None  # "none" | "before12" | "12-2pm" | "2-6pm" | "after6pm"
    
    # After Wake Survey fields
    actualSleepTime: str | None = None  # Time string (HH:mm)
    snooze: str | None = None  # "noAlarm" | "no" | "1-2times" | "3+times"
    energy: int | None = Field(default=None, ge=1, le=5)  # 1 (None) - 5 (Very high)
    sleepiness: int | None = Field(default=None, ge=1, le=5)  # 1 (Extremely sleepy) - 5 (Very alert)


class ResponseValueUpdate(BaseModel):
    value_numeric: float | None = None
    value_bool: bool | None = None
    value_text: str | None = None
    value_time: time | None = None
    value_timestamp: datetime | None = None


class Insight(BaseModel):
    type: str
    message: str
    confidence: str | None = None
    impact: str | None = None


class EnergyEfficiency(BaseModel):
    percentage: int
    color: str
