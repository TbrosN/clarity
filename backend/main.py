from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import users, health, check_ins

app = FastAPI(
    title="Clarity API",
    description="Backend API for Clarity skincare and health tracking app",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(users.router)
app.include_router(check_ins.router)


@app.get("/health")
async def root():
    """Root endpoint"""
    return {
        "status": "healthy",
        "database": "connected"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
