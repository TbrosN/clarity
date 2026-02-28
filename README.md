# Clarity

**Build better sleep habits with simple daily check-ins.**

[Try Clarity](https://clarity-roan-three.vercel.app/)

## What it does

Clarity is a sleep-focused habit tracker. The app helps you understand which habits actually improve how you feel in the morning by combining:

- quick bedtime + wake-up surveys,
- trend tracking over time,
- and AI-generated insights that connect your behavior to outcomes you care about (like waking up well-rested).

The project used to track a wider set of lifestyle behaviors, but now it is intentionally centered on sleep, since sleep is one of the highest-impact health levers.

## How to use Clarity

1. Sign in with Clerk (email/password or OAuth).
2. Complete the short pre-sleep check-in before bed.
3. Complete the short post-wake check-in in the morning.
4. Review your trends and AI insights in the app.
5. Use reminder emails to stay consistent.

The goal is low-friction consistency: quick inputs, useful feedback, and measurable progress over time.

## Features I am most proud of

- **Actionable AI insights:** the backend analyzes survey history and surfaces relationships between habits and outcomes.
- **Reminder pipeline:** automated email reminders help users keep the streak going. Uses a Cloudflare cron trigger that runs every 5 minutes.
- **Production auth + data stack:** Clerk auth (including OAuth) plus Supabase-backed storage for survey questions, responses, and reminder metadata.

## Run locally

### Prerequisites

- Node.js (for the frontend)
- Python 3.11+
- `uv` (for backend backend dependency management)

### 1) Backend setup

```bash
cd backend
uv sync
uv run main.py
```

### 2) Frontend setup

```bash
cd frontend
npm install
npm run web
```

The frontend reads `EXPO_PUBLIC_API_URL` and defaults to `http://localhost:8000` if unset.

## Secrets and environment variables

This repo uses environment variables for secrets and external service credentials.

- Do **not** hardcode secrets in source files.
- Keep local secrets in `backend/.env` and `frontend/.env`.
- Do **not** commit `.env` files.
- Set production secrets through your platform secret managers (Vercel, Render, Cloudflare), not in git.

Common sensitive values include:

- Clerk keys (`CLERK_SECRET_KEY`, publishable key values)
- Supabase keys (`SUPABASE_SECRET_KEY`, project URL/keys)
- Email provider credentials (`RESEND_API_KEY`)
- Internal cron auth (`INTERNAL_CRON_SECRET`)
- Optional LLM key (`LLM_API_KEY` / `AWS_BEARER_TOKEN_BEDROCK`)