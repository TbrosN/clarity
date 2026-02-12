from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal


class CheckInBase(BaseModel):
    """Base check-in model"""
    mood_score: int = Field(..., ge=1, le=10, description="Mood score from 1-10")
    energy_level: int = Field(..., ge=1, le=10, description="Energy level from 1-10")
    stress_level: int = Field(..., ge=1, le=10, description="Stress level from 1-10")
    notes: str | None = None
    check_in_type: Literal["morning", "evening", "quick"] = "quick"


class CheckInCreate(CheckInBase):
    """Check-in creation model"""
    pass


class CheckInUpdate(BaseModel):
    """Check-in update model"""
    mood_score: int | None = Field(None, ge=1, le=10)
    energy_level: int | None = Field(None, ge=1, le=10)
    stress_level: int | None = Field(None, ge=1, le=10)
    notes: str | None = None


class CheckInInDB(CheckInBase):
    """Check-in model as stored in database"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime | None = None
    
    class Config:
        from_attributes = True


class CheckInResponse(BaseModel):
    """Check-in response model"""
    id: int
    mood_score: int
    energy_level: int
    stress_level: int
    notes: str | None
    check_in_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True
