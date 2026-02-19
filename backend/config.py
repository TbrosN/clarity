from pydantic import Field
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
    llm_insights_enabled: bool = False
    llm_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_timeout_seconds: float = 15.0
    llm_insights_max_items: int = 4
    insights_window_days: int = Field(default=14, ge=7, le=14)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
