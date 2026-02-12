# Clarity Setup Guide

This guide will help you set up the Clarity PWA with FastAPI backend, Supabase database, and Clerk authentication.

## Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Supabase account (https://supabase.com)
- Clerk account (https://clerk.com)

## Backend Setup

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Supabase

1. Create a new project in [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **Settings > API** to find your credentials:
   - Project URL
   - Anon/Public key
   - Service Role key (keep this secret!)

3. Create the database schema by running this SQL in the Supabase SQL Editor:

```sql
-- Create users table
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

-- Create policies
CREATE POLICY "Users can view own data" ON users
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT
  WITH CHECK (true);
```

### 3. Configure Clerk

1. Create a new application in [Clerk Dashboard](https://dashboard.clerk.com)
2. Enable the authentication methods you want (Email, Google, etc.)
3. Go to **API Keys** to find:
   - Publishable Key (starts with `pk_`)
   - Secret Key (starts with `sk_`)

4. Configure allowed origins in Clerk:
   - Go to **Settings > Security**
   - Add your frontend URLs (localhost, Vercel domain, etc.)

### 4. Set Up Backend Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key

# Clerk
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# API
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:8081,http://localhost:19006,https://your-vercel-domain.vercel.app
```

### 5. Run the Backend

```bash
cd backend
python main.py
```

Or with uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Frontend Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Edit `.env` in the root directory:

```bash
# Supabase (if you want to use Supabase client-side)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Clerk
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# API
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run the Frontend

For web (PWA):
```bash
npm run web
```

For iOS:
```bash
npm run ios
```

For Android:
```bash
npm run android
```

## Using Clerk Authentication

### In Your Components

```tsx
import { useAuth, useUser } from '@clerk/clerk-expo';
import { ClerkAuth } from '@/components/ClerkAuth';

function MyComponent() {
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  return (
    <ClerkAuth fallback={<SignInPrompt />}>
      <Text>Welcome, {user?.firstName}!</Text>
      <Button title="Sign Out" onPress={() => signOut()} />
    </ClerkAuth>
  );
}
```

### Fetching User Data from Backend

```tsx
import { useCurrentUser } from '@/hooks/useCurrentUser';

function ProfileScreen() {
  const { user, loading, error, updateUser } = useCurrentUser();

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return (
    <View>
      <Text>{user?.email}</Text>
      <Text>{user?.first_name} {user?.last_name}</Text>
    </View>
  );
}
```

### Making API Requests

```tsx
import { apiService } from '@/services/ApiService';

async function fetchData() {
  try {
    // The auth token is automatically included from Clerk
    const user = await apiService.getCurrentUser();
    console.log(user);
  } catch (error) {
    console.error('API Error:', error);
  }
}
```

## Deployment

### Backend Deployment (Railway, Render, etc.)

1. Push your code to GitHub
2. Connect your repository to your hosting service
3. Set environment variables in the hosting dashboard
4. Deploy!

Example for Railway:
```bash
railway login
railway init
railway add
# Set environment variables in Railway dashboard
railway up
```

### Frontend Deployment (Vercel)

1. Push your code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

Make sure to:
- Update `CORS_ORIGINS` in backend to include your Vercel URL
- Update `EXPO_PUBLIC_API_URL` in frontend to point to your deployed backend
- Update Clerk allowed origins to include your Vercel URL

## Testing

### Test Backend

```bash
# Health check
curl http://localhost:8000/health

# Database health check
curl http://localhost:8000/health/db
```

### Test with Authentication

1. Sign in to your app
2. Open browser dev tools
3. Get your auth token from localStorage or network requests
4. Test API with curl:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/users/me
```

## Troubleshooting

### Backend Issues

- **"Could not connect to database"**: Check your Supabase URL and keys
- **"Invalid authentication token"**: Verify Clerk secret key is correct
- **CORS errors**: Add your frontend URL to `CORS_ORIGINS` in backend `.env`

### Frontend Issues

- **"Failed to fetch"**: Make sure backend is running and `EXPO_PUBLIC_API_URL` is correct
- **Clerk not loading**: Verify `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is set
- **"Network request failed"**: Check that you're using the correct localhost URL for your platform

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Expo Documentation](https://docs.expo.dev)
