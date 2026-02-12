from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client
from datetime import datetime, timedelta
from typing import List

from database import get_supabase
from middleware.auth import get_current_user
from models.check_in import CheckInCreate, CheckInResponse, CheckInUpdate

router = APIRouter(prefix="/check-ins", tags=["check-ins"])


async def get_user_id_from_clerk(
    current_user: dict,
    supabase: Client
) -> int:
    """Helper to get database user ID from Clerk user"""
    result = supabase.table("users").select("id").eq(
        "clerk_user_id", current_user["id"]
    ).execute()
    
    if not result.data or len(result.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    
    return result.data[0]["id"]


@router.post("", response_model=CheckInResponse, status_code=status.HTTP_201_CREATED)
async def create_check_in(
    check_in: CheckInCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Create a new check-in entry.
    
    Args:
        check_in: Check-in data
        current_user: Current authenticated user
        supabase: Supabase client instance
        
    Returns:
        CheckInResponse: Created check-in entry
    """
    user_id = await get_user_id_from_clerk(current_user, supabase)
    
    check_in_data = check_in.model_dump()
    check_in_data["user_id"] = user_id
    
    result = supabase.table("check_ins").insert(check_in_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create check-in"
        )
    
    return result.data[0]


@router.get("", response_model=List[CheckInResponse])
async def get_check_ins(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    days: int | None = Query(default=None, description="Get check-ins from last N days"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get user's check-in history.
    
    Args:
        limit: Maximum number of check-ins to return
        offset: Number of check-ins to skip
        days: Filter check-ins from last N days
        current_user: Current authenticated user
        supabase: Supabase client instance
        
    Returns:
        List[CheckInResponse]: List of check-in entries
    """
    user_id = await get_user_id_from_clerk(current_user, supabase)
    
    query = supabase.table("check_ins").select("*").eq("user_id", user_id)
    
    if days:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query = query.gte("created_at", cutoff_date.isoformat())
    
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    
    return result.data


@router.get("/{check_in_id}", response_model=CheckInResponse)
async def get_check_in(
    check_in_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get a specific check-in by ID.
    
    Args:
        check_in_id: Check-in ID
        current_user: Current authenticated user
        supabase: Supabase client instance
        
    Returns:
        CheckInResponse: Check-in entry
    """
    user_id = await get_user_id_from_clerk(current_user, supabase)
    
    result = supabase.table("check_ins").select("*").eq("id", check_in_id).eq(
        "user_id", user_id
    ).execute()
    
    if not result.data or len(result.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in not found"
        )
    
    return result.data[0]


@router.put("/{check_in_id}", response_model=CheckInResponse)
async def update_check_in(
    check_in_id: int,
    check_in_update: CheckInUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Update a check-in entry.
    
    Args:
        check_in_id: Check-in ID
        check_in_update: Updated check-in data
        current_user: Current authenticated user
        supabase: Supabase client instance
        
    Returns:
        CheckInResponse: Updated check-in entry
    """
    user_id = await get_user_id_from_clerk(current_user, supabase)
    
    update_data = check_in_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    result = supabase.table("check_ins").update(update_data).eq(
        "id", check_in_id
    ).eq("user_id", user_id).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in not found"
        )
    
    return result.data[0]


@router.delete("/{check_in_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_check_in(
    check_in_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Delete a check-in entry.
    
    Args:
        check_in_id: Check-in ID
        current_user: Current authenticated user
        supabase: Supabase client instance
    """
    user_id = await get_user_id_from_clerk(current_user, supabase)
    
    result = supabase.table("check_ins").delete().eq("id", check_in_id).eq(
        "user_id", user_id
    ).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in not found"
        )
    
    return None


@router.get("/stats/summary")
async def get_check_in_stats(
    days: int = Query(default=7, description="Number of days to include in stats"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get statistical summary of check-ins.
    
    Args:
        days: Number of days to include in statistics
        current_user: Current authenticated user
        supabase: Supabase client instance
        
    Returns:
        dict: Statistical summary including averages and trends
    """
    user_id = await get_user_id_from_clerk(current_user, supabase)
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    result = supabase.table("check_ins").select("*").eq("user_id", user_id).gte(
        "created_at", cutoff_date.isoformat()
    ).execute()
    
    if not result.data or len(result.data) == 0:
        return {
            "days": days,
            "count": 0,
            "averages": None,
            "message": "No check-ins found for this period"
        }
    
    check_ins = result.data
    count = len(check_ins)
    
    avg_mood = sum(c["mood_score"] for c in check_ins) / count
    avg_energy = sum(c["energy_level"] for c in check_ins) / count
    avg_stress = sum(c["stress_level"] for c in check_ins) / count
    
    return {
        "days": days,
        "count": count,
        "averages": {
            "mood_score": round(avg_mood, 2),
            "energy_level": round(avg_energy, 2),
            "stress_level": round(avg_stress, 2)
        }
    }
