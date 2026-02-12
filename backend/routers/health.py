from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "clarity-api"
    }
