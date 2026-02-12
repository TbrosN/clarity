from fastapi import APIRouter, Depends
from supabase import Client

from database import get_supabase

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "clarity-api"
    }


@router.get("/db")
async def database_health_check(supabase: Client = Depends(get_supabase)):
    """
    Database health check endpoint.
    
    Args:
        supabase: Supabase client instance
        
    Returns:
        dict: Database health status
    """
    try:
        # Try a simple query to verify database connection
        result = supabase.table("users").select("count", count="exact").limit(0).execute()
        
        return {
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }
