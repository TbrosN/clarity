# Clarity

**Build better sleep habits with simple daily check-ins.**

[Try Clarity](https://clarity-roan-three.vercel.app/)

## Note
This project is intended for mobile devices, although it can be used on desktop too. This was built as a PWA with Expo, with AI assistance from Cursor.

## What it does

Clarity tracks your sleep habits and makes personalized suggestions to help you improve your sleep.

- Quick & easy bedtime + wake-up surveys,
- AI-generated insights that connect your behavior to morning energy levels
- Reminder emails to help you stay consistent
- Graphs of your sleep habits and various time scales

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

Note you may need to set some environment variables for both the frontend and backend in order to fully run this yourself. Remember to never commit sensitive variables to git.
