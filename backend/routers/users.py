from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from database import get_supabase
from middleware.auth import get_current_user
from models.user import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Get current user's profile.
    
    Args:
        current_user: Current authenticated user from Clerk
        supabase: Supabase client instance
        
    Returns:
        UserResponse: Current user's profile data
    """
    # Try to get user from database
    result = supabase.table("users").select("*").eq("clerk_user_id", current_user["id"]).execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]
    
    # Create user if doesn't exist
    user_data = {
        "clerk_user_id": current_user["id"],
        "email": current_user["email"],
        "first_name": current_user.get("first_name"),
        "last_name": current_user.get("last_name"),
    }
    
    result = supabase.table("users").insert(user_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile"
        )
    
    return result.data[0]


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)
):
    """
    Update current user's profile.
    
    Args:
        user_update: User update data
        current_user: Current authenticated user from Clerk
        supabase: Supabase client instance
        
    Returns:
        UserResponse: Updated user profile
    """
    update_data = user_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    result = supabase.table("users").update(update_data).eq(
        "clerk_user_id", current_user["id"]
    ).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return result.data[0]
