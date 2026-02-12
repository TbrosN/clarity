# Environment Variables Reference

Quick reference for all environment variables needed for Clarity.

## Frontend Environment Variables

File: `.env` (in root directory)

```bash
# Supabase (Optional - only if using Supabase client-side)
EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key

# Clerk (Required)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...your_publishable_key

# API (Required)
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### Where to Find These:

**Supabase:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings > API
4. Copy "Project URL" and "anon/public" key

**Clerk:**
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to API Keys
4. Copy "Publishable key" (starts with `pk_test_` or `pk_live_`)

**API URL:**
- Local development: `http://localhost:8000`
- Production: Your deployed backend URL (e.g., `https://clarity-api.railway.app`)

## Backend Environment Variables

File: `backend/.env`

```bash
# Supabase (Required)
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGc...your_publishable_key
SUPABASE_SECRET_KEY=eyJhbGc...your_secret_key

# Clerk (Required)
CLERK_SECRET_KEY=sk_test_...your_secret_key
CLERK_PUBLISHABLE_KEY=pk_test_...your_publishable_key

# API Configuration (Optional - defaults shown)
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
```

### Where to Find These:

**Supabase:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings > API
4. Copy "Project URL", "anon/public" key, and "service_role" key
   - ⚠️ Keep service_role key secret! It bypasses Row Level Security

**Clerk:**
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to API Keys
4. Copy both "Publishable key" and "Secret key"
   - ⚠️ Keep secret key private! Never commit to git

**CORS Origins:**
- Add all URLs where your frontend will be hosted
- Separate multiple URLs with commas (no spaces)
- Examples:
  - Local: `http://localhost:8081,http://localhost:19006`
  - Production: `https://clarity.vercel.app,https://www.clarity.com`

## Quick Setup

Run this command to create template .env files:

```bash
npm run setup:env
```

Then edit both `.env` files with your actual credentials.

## Security Notes

1. **Never commit `.env` files to git**
   - Both `.env` and `backend/.env` are in `.gitignore`
   
2. **Keep these secrets safe:**
   - Supabase service role key
   - Clerk secret key
   
3. **Public keys are safe to expose:**
   - Supabase anon key (designed for client-side use)
   - Clerk publishable key (designed for client-side use)

4. **Use different keys for development and production**
   - Create separate Supabase projects for dev/prod
   - Create separate Clerk applications for dev/prod

## Deployment

### Frontend (Vercel)

Add these environment variables in Vercel dashboard:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL` (your production backend URL)

### Backend (Railway/Render)

Add these environment variables in your hosting dashboard:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CORS_ORIGINS` (include your frontend production URL)
- `API_HOST` (usually `0.0.0.0`)
- `API_PORT` (provided by host, or `8000`)

## Troubleshooting

### "Failed to fetch" errors
- Check that `EXPO_PUBLIC_API_URL` points to your running backend
- Verify backend is running on the specified port
- Check that frontend URL is in `CORS_ORIGINS`

### Authentication errors
- Verify Clerk keys are correct (publishable key in frontend, secret key in backend)
- Check that Clerk keys match the same application
- Ensure Clerk application has correct allowed origins configured

### Database connection errors
- Verify Supabase URL and keys are correct
- Check that database tables exist (run `backend/sql/schema.sql`)
- Test connection with Supabase dashboard

## Example .env Files

### Frontend `.env` (Example)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDAwMDAwMCwiZXhwIjoxOTU1NTc2MDAwfQ.abcdefghijk1234567890
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### Backend `backend/.env` (Example)
```bash
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDAwMDAwMCwiZXhwIjoxOTU1NTc2MDAwfQ.abcdefghijk1234567890
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NzYwMDB9.xyz9876543210
CLERK_SECRET_KEY=sk_test_abcdefghijklmnopqrstuvwxyz123456
CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
```

---

**Note:** These are example values. Replace with your actual credentials from Supabase and Clerk dashboards.
