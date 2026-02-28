# Clarity Backend API

FastAPI backend for the Clarity mental health tracking PWA with Supabase and Clerk authentication.

## Setup

### Prerequisites

Install `uv` (fast Python package manager):
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or with Homebrew
brew install uv

# Or with pip
pip install uv
```

### Installation

1. **Install dependencies:**
   ```bash
   cd backend
   
   # Install all dependencies (creates .venv automatically)
   uv sync
   
   # Activate the virtual environment
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` with your actual values:
   - Get Supabase credentials from your Supabase project dashboard
   - Get Clerk keys from your Clerk dashboard
   - For email reminders with Resend, add:
     - `RESEND_API_KEY`
     - `RESEND_FROM_EMAIL` (for example: `Clarity <onboarding@resend.dev>`)
     - `RESEND_REPLY_TO_EMAIL` (optional)
     - `FRONTEND_APP_URL` (for example: `https://your-app.example.com`)
     - `INTERNAL_CRON_SECRET` (shared secret for protected cron endpoint)

3. **Set up Supabase database:**
   
   Create a `users` table in your Supabase project:
   
   ```sql
   CREATE TABLE users (
     id BIGSERIAL PRIMARY KEY,
     clerk_user_id TEXT UNIQUE NOT NULL,
     email TEXT NOT NULL,
     first_name TEXT,
     last_name TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ
   );
   
   -- Create index on clerk_user_id for faster lookups
   CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id);
   
   -- Enable Row Level Security
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   
   -- Create policy to allow users to read their own data
   CREATE POLICY "Users can view own data" ON users
     FOR SELECT
     USING (true);
   
   -- Create policy to allow users to update their own data
   CREATE POLICY "Users can update own data" ON users
     FOR UPDATE
     USING (true);
   
   -- Create policy to allow inserting new users
   CREATE POLICY "Users can insert own data" ON users
     FOR INSERT
     WITH CHECK (true);
   ```

4. **Run the server:**
   ```bash
   python main.py
   ```
   
   Or with uvicorn:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Set up email reminder preferences table:**
   ```sql
   -- run this script in Supabase SQL editor
   -- backend/sql/user_email_preferences.sql
   ```

## API Documentation

Once the server is running, visit:
- **Interactive API docs (Swagger):** http://localhost:8000/docs
- **Alternative API docs (ReDoc):** http://localhost:8000/redoc

## Endpoints

### Health
- `GET /health` - Basic health check
- `GET /health/db` - Database connection health check

### Users
- `GET /users/me` - Get current user profile (requires authentication)
- `PUT /users/me` - Update current user profile (requires authentication)

## Authentication

The API uses Clerk for authentication. All protected endpoints require a valid Clerk JWT token in the `Authorization` header:

```
Authorization: Bearer <clerk-jwt-token>
```

## Deployment

### Development
```bash
# With uv
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or activate venv first
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

Or use a process manager like Gunicorn:
```bash
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Render cron for daily reminders
Create a Render Cron Job that hits your backend every 5 minutes:

- **URL:** `POST https://<your-backend>/internal/reminders/run`
- **Header:** `X-Cron-Secret: <INTERNAL_CRON_SECRET>`

The backend route performs timezone-aware reminder checks and sends email at user-configured local times.

## Managing Dependencies with uv

### Adding new packages
```bash
# Add a runtime dependency
uv add package-name

# Add a development dependency
uv add --dev package-name

# Add a specific version
uv add package-name==1.2.3
```

### Updating dependencies
```bash
# Update all dependencies
uv lock --upgrade

# Update a specific package
uv add package-name@latest

# Sync dependencies after updating
uv sync
```

### Removing dependencies
```bash
# Remove a package
uv remove package-name
```

### Syncing dependencies
```bash
# Install/sync all dependencies from pyproject.toml and uv.lock
uv sync

# Install with dev dependencies
uv sync --all-extras
```

## Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── config.py            # Configuration and settings
├── database.py          # Supabase client setup
├── pyproject.toml       # Project metadata and dependencies (uv)
├── uv.lock              # Lockfile for reproducible installs (auto-generated)
├── requirements.txt     # Legacy pip requirements (for compatibility)
├── middleware/
│   └── auth.py         # Clerk authentication middleware
├── models/
│   └── user.py         # Pydantic models for users
└── routers/
    ├── health.py       # Health check endpoints
    └── users.py        # User endpoints
```

## Why uv?

This project uses [uv](https://github.com/astral-sh/uv) as the package manager for:
- **10-100x faster** package installation compared to pip
- **Better dependency resolution** with a modern resolver
- **Lockfile support** for reproducible builds (`uv.lock`)
- **Drop-in replacement** for pip - all pip commands work with `uv pip`
- **Built-in virtual environment management** with `uv venv` and `uv sync`
