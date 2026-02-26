from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings"""

    # Supabase
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str

    # Clerk
    clerk_secret_key: str
    clerk_publishable_key: str

    # API
    api_host: str
    port: int
    cors_origins: str

    # LLM insights (optional)
    llm_insights_enabled: bool = True
    llm_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("LLM_API_KEY", "AWS_BEARER_TOKEN_BEDROCK"),
    )
    llm_model: str = "anthropic.claude-3-5-haiku-20241022-v1:0"
    llm_base_url: str = "https://bedrock-runtime.us-east-1.amazonaws.com"
    llm_timeout_seconds: float = 15.0
    llm_insights_max_items: int = 4
    insights_window_days: int = Field(default=7, ge=7, le=14)

    # Email reminders (Resend)
    resend_api_key: str | None = None
    resend_from_email: str = "Clarity <onboarding@resend.dev>"
    resend_reply_to_email: str | None = None
    frontend_app_url: str = "http://localhost:8081"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
