from __future__ import annotations

from typing import Any

import httpx

from config import settings


RESEND_API_BASE_URL = "https://api.resend.com"
CLERK_API_BASE_URL = "https://api.clerk.com/v1"


def _require_resend_config() -> tuple[str, str]:
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY is not configured.")
    return settings.resend_api_key, settings.resend_from_email


async def send_resend_email(
    *,
    to_email: str,
    subject: str,
    html: str,
    text: str | None = None,
) -> dict[str, Any]:
    api_key, from_email = _require_resend_config()

    payload: dict[str, Any] = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if settings.resend_reply_to_email:
        payload["reply_to"] = settings.resend_reply_to_email

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{RESEND_API_BASE_URL}/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        return response.json()


async def get_clerk_primary_email(user_id: str) -> str | None:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{CLERK_API_BASE_URL}/users/{user_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        )

    if response.status_code != 200:
        return None

    data = response.json()
    primary_email_address_id = data.get("primary_email_address_id")
    email_addresses = data.get("email_addresses") or []

    for item in email_addresses:
        if item.get("id") == primary_email_address_id and item.get("email_address"):
            return str(item["email_address"])

    for item in email_addresses:
        if item.get("email_address"):
            return str(item["email_address"])

    return None
