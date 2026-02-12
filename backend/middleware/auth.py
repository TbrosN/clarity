from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from clerk_backend_api import Clerk
from config import settings

security = HTTPBearer()
clerk = Clerk(bearer_auth=settings.clerk_secret_key)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """
    Verify Clerk JWT token and return user information.
    
    Args:
        credentials: HTTP Authorization credentials containing the bearer token
        
    Returns:
        dict: User information from Clerk
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    try:
        token = credentials.credentials
        
        # Verify the JWT token with Clerk
        session = clerk.jwt_templates.verify_token(token)
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
        
        # Get user details from Clerk
        user_id = session.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token",
            )
        
        user = clerk.users.get(user_id)
        
        return {
            "id": user.id,
            "email": user.email_addresses[0].email_address if user.email_addresses else None,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "image_url": user.image_url,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
        )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security, auto_error=False)
) -> dict | None:
    """
    Optionally verify Clerk JWT token. Returns None if no token provided.
    
    Args:
        credentials: HTTP Authorization credentials containing the bearer token (optional)
        
    Returns:
        dict | None: User information from Clerk, or None if no credentials provided
    """
    if not credentials:
        return None
    
    return await get_current_user(credentials)
