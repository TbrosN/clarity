from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from clerk_backend_api import AuthenticateRequestOptions, authenticate_request
from config import settings
from database import supabase_auth

security = HTTPBearer(auto_error=True)


class _RequestLike:
    def __init__(self, token: str):
        bearer = f"Bearer {token}"
        # Clerk's SDK lookup is case-sensitive and expects "Authorization".
        self._headers = {"Authorization": bearer, "authorization": bearer}

    @property
    def headers(self) -> dict[str, str]:
        return self._headers


def _verify_and_get_user_id(token: str) -> str:
    # Prefer Supabase-native verification when integration is enabled.
    try:
        user_response = supabase_auth.auth.get_user(token)
        user = getattr(user_response, "user", None)
        user_id = getattr(user, "id", None)
        if not user_id:
            raise ValueError("Missing user identifier")
        return user_id
    except Exception:
        # Fallback: verify directly with Clerk to avoid hard dependency on
        # Supabase third-party auth configuration during rollout.
        try:
            state = authenticate_request(
                _RequestLike(token),
                AuthenticateRequestOptions(secret_key=settings.clerk_secret_key),
            )
            payload = getattr(state, "payload", None) or {}
            user_id = payload.get("sub")
            if not user_id:
                raise ValueError("Missing user identifier")
            return str(user_id)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            ) from exc

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    return _verify_and_get_user_id(credentials.credentials)
