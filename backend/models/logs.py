from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict, Field


class DailyLogUpsert(BaseModel):
    model_config = ConfigDict(extra="allow")

    date: date
    bedtime: datetime | None = None
    lastMealTime: datetime | None = None
    acneLevel: int | None = Field(default=None, ge=1, le=5)
    skinFeeling: int | None = Field(default=None, ge=1, le=5)
    energyLevel: int | None = Field(default=None, ge=1, le=5)
    mood: int | None = Field(default=None, ge=1, le=5)
    stress: int | None = Field(default=None, ge=1, le=5)
    sleepQuality: int | None = Field(default=None, ge=1, le=5)
    touchHygiene: int | None = Field(default=None, ge=1, le=5)
    morningEnergy: int | None = Field(default=None, ge=1, le=5)
    morningSunlight: int | None = Field(default=None, ge=1, le=2)
    afternoonEnergy: int | None = Field(default=None, ge=1, le=5)
    caffeineCurfew: int | None = Field(default=None, ge=1, le=2)
    screenWindDown: int | None = Field(default=None, ge=1, le=3)
    bedtimeDigestion: int | None = Field(default=None, ge=1, le=5)
    waterIntake: int | None = Field(default=None, ge=1, le=5)
    sugarIntake: int | None = Field(default=None, ge=1, le=5)


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
