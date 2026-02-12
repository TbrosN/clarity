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
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:8081,http://localhost:19006"
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
