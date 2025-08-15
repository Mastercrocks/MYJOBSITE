# Google OAuth & Persistent Login Setup Guide

## What I've Implemented

### 1. Persistent Login Sessions
- ✅ Users stay logged in for 7 days using HTTP-only cookies
- ✅ Automatic redirect if already logged in (no need to login again)
- ✅ Session management with express-session and cookies

### 2. Google OAuth Integration
- ✅ "Sign in with Google" buttons on both login and signup forms
- ✅ Automatic user creation for new Google accounts
- ✅ Links existing accounts with Google if email matches
- ✅ Secure token-based authentication

### 3. Enhanced Security
- ✅ HTTP-only cookies prevent XSS attacks
- ✅ CSRF protection through proper session handling
- ✅ Secure redirects based on user type (employer/job seeker)

## Files Modified/Created

### New Files:
- `config/passport.js` - Google OAuth configuration
- `migrate-google-auth.js` - Database migration script
- `.env.google-oauth-template` - Environment variables template

### Modified Files:
- `routes/auth.js` - Added Google OAuth routes and persistent sessions
- `middleware/auth.js` - Enhanced authentication with cookie support
- `server.js` - Added session management and passport initialization
- `Public/login.html` - Added Google login buttons and auto-login check
- `package.json` - Added new dependencies

## Setup Steps

### 1. Install Dependencies (Already Done)
```bash
npm install passport passport-google-oauth20 express-session cookie-parser
```

### 2. Set Up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create credentials" → "OAuth 2.0 client IDs"
5. Configure consent screen
6. Add authorized origins: `http://localhost:3000`
7. Add authorized redirect URIs: `http://localhost:3000/auth/google/callback`
8. Copy the Client ID and Client Secret

### 3. Update Environment Variables
Add these to your `.env` file:
```env
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
SESSION_SECRET=your-super-secure-session-secret-change-this-in-production
SITE_URL=http://localhost:3000
```

### 4. Run Database Migration
```bash
node migrate-google-auth.js
```
This adds `google_id` and `profile_picture` columns to the users table.

### 5. Restart Your Server
```bash
npm start
```

## How It Works

### For Regular Users:
1. Visit `/login` - automatically redirected to dashboard if already logged in
2. Can sign in with email/password OR click "Sign in with Google"
3. Google OAuth creates account automatically or links to existing email
4. Stays logged in for 7 days via secure cookies

### For Employers:
1. Same login process
2. Can set userType to 'employer' during registration
3. Redirected to `/employer/dashboard.html` after login

### Security Features:
- Sessions expire after 7 days
- HTTP-only cookies prevent client-side access
- CSRF protection through session management
- Secure redirects prevent open redirect vulnerabilities

## Testing

1. Try logging in normally - should work as before
2. Try the "Sign in with Google" button - redirects to Google
3. After successful Google auth, should redirect to appropriate dashboard
4. Close browser and reopen - should stay logged in
5. Try accessing `/login` while logged in - should redirect to dashboard

## Troubleshooting

- **Google OAuth error**: Check your Google Cloud Console credentials
- **Database errors**: Make sure MySQL is running and run the migration
- **Cookie issues**: Check that HTTPS is disabled in development
- **Redirect loops**: Clear browser cookies and localStorage

Your site now has:
✅ Persistent login (stays logged in)
✅ Google OAuth for easy signup/login
✅ No double login required for job posting
✅ Secure session management
