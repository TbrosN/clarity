from supabase import create_client, Client
from config import settings

# Initialize Supabase client
supabase: Client = create_client(
    settings.supabase_url,
    settings.supabase_secret_key
)


def get_supabase() -> Client:
    """
    Dependency to get Supabase client instance.
    
    Returns:
        Client: Supabase client instance
    """
    return supabase
