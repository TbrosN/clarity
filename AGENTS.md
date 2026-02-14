# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Clarity is a skin health and acne tracking PWA that helps users discover patterns between their daily life (sleep, food, stress, hydration) and breakouts using personal data.

## Tech Stack

- **Frontend**: Expo/React Native with TypeScript, Expo Router (file-based routing), NativeWind (TailwindCSS), Clerk authentication
- **Backend**: FastAPI (Python 3.11+), Supabase (PostgreSQL), Clerk JWT verification, uv package manager

## Common Commands

### Frontend (from `frontend/` directory)

```bash
npm run web           # Start web development server
npm run ios           # Start iOS simulator
npm run android       # Start Android emulator
npm start             # Start Expo dev server (pick platform)
npm run build:web     # Build web production bundle
```

### Backend (from `backend/` directory)

```bash
# Using uv (preferred)
uv sync                                    # Install dependencies
source .venv/bin/activate                  # Activate virtualenv
python main.py                             # Run dev server with hot reload

# Alternative
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Dependency management
uv add <package>           # Add runtime dependency
uv add --dev <package>     # Add dev dependency
uv lock --upgrade          # Update lockfile
```

### Linting

```bash
# Backend (ruff configured in pyproject.toml)
ruff check backend/
ruff format backend/
```

## Architecture

### Frontend Structure

```
frontend/
├── app/              # Expo Router pages (file-based routing)
│   ├── (tabs)/       # Tab navigator screens
│   ├── _layout.tsx   # Root layout with Clerk provider
│   └── *.tsx         # Modal/stack screens
├── components/       # Reusable React components
├── services/         # API service classes
│   ├── ApiService.ts         # Base axios client with auth token handling
│   ├── CheckInApiService.ts  # Check-in CRUD operations
│   └── StorageService.ts     # AsyncStorage wrapper
└── hooks/            # Custom React hooks (e.g., useCurrentUser)
```

**Key patterns:**
- `ApiService` is a singleton that manages auth tokens and provides typed HTTP methods
- Domain-specific services (like `CheckInApiService`) build on `ApiService`
- Clerk auth token is set globally in `_layout.tsx` when auth state changes
- Use `useAuth()` and `useUser()` from `@clerk/clerk-expo` for auth state

### Backend Structure

```
backend/
├── main.py           # FastAPI app entry point, CORS config, router includes
├── config.py         # Pydantic settings from environment variables
├── routers/          # API route handlers (users, health, check-ins)
├── models/           # Pydantic models
└── middleware/       # Auth middleware for Clerk JWT verification
```

**Key patterns:**
- Settings loaded via `pydantic-settings` from `.env` file
- All protected routes verify Clerk JWT tokens
- Supabase client used for database operations
- CORS origins configured via `CORS_ORIGINS` env var (comma-separated)

### Authentication Flow

1. Frontend: User signs in via Clerk UI components
2. Frontend: `_layout.tsx` calls `getToken()` and sets it on `ApiService`
3. Backend: Middleware extracts and verifies Clerk JWT from `Authorization: Bearer <token>` header
4. Backend: User looked up/created in Supabase `users` table by `clerk_user_id`

## Environment Variables

See `ENV_VARIABLES.md` for complete reference. Key files:
- `frontend/.env` - Clerk publishable key, API URL
- `backend/.env` - Supabase credentials, Clerk secret key, CORS origins

## API Documentation

When backend is running: http://localhost:8000/docs (Swagger UI)
