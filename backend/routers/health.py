from fastapi import APIRouter, HTTPException
from database import supabase


router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health():
    return {"status": "healthy"}


@router.get("/db")
async def db_health():
    try:
        supabase.table("questions").select("id").limit(1).execute()
        return {"status": "healthy", "database": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database health check failed: {exc}") from exc
