# Quick Google OAuth Setup Guide

## 🚨 Error: "Internal server error" when clicking Google login?

**This means Google OAuth credentials are not set up yet.**

## 🔧 Quick Fix (5 minutes):

### Step 1: Get Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google+ API** (or People API)
4. Go to **"Credentials"** → **"Create credentials"** → **"OAuth 2.0 client IDs"**
5. Configure consent screen if prompted
6. Set **Application type** to "Web application"
7. Add **Authorized redirect URIs**: 
   - `http://localhost:3000/auth/google/callback`
   - `https://your-railway-domain.railway.app/auth/google/callback` (for production)

### Step 2: Update .env File
Replace these lines in your `.env` file:
```env
GOOGLE_CLIENT_ID=your-actual-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
```

### Step 3: Restart Server
```bash
npm start
```

## ✅ Test:
- Click "Sign in with Google" - should redirect to Google instead of showing error
- Google OAuth buttons will be fully functional

## 🔄 Alternative (Skip Google OAuth for now):
If you want to skip Google OAuth setup for now, users can still:
- Login with regular email/password
- Register new accounts normally
- All other features work without Google OAuth

The Google buttons will show a proper error message until credentials are configured.

## 📋 Production Setup:
For Railway deployment, add the environment variables in Railway dashboard:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
