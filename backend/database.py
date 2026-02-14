from supabase import Client, create_client
from config import settings


supabase: Client = create_client(settings.supabase_url, settings.supabase_secret_key)
supabase_auth: Client = create_client(settings.supabase_url, settings.supabase_publishable_key)
