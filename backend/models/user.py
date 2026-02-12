from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserBase(BaseModel):
    """Base user model"""
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None


class UserCreate(UserBase):
    """User creation model"""
    clerk_user_id: str


class UserUpdate(BaseModel):
    """User update model"""
    first_name: str | None = None
    last_name: str | None = None


class UserInDB(UserBase):
    """User model as stored in database"""
    id: int
    clerk_user_id: str
    created_at: datetime
    updated_at: datetime | None = None
    
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """User response model"""
    id: int
    email: str
    first_name: str | None = None
    last_name: str | None = None
    clerk_user_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True
