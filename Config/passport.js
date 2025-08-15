const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('../Config/database');

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists in database
    const [existingUsers] = await pool.execute(
      'SELECT * FROM users WHERE google_id = ? OR email = ?',
      [profile.id, profile.emails[0].value]
    );
    
    if (existingUsers.length > 0) {
      // User exists - update google_id if not set
      const user = existingUsers[0];
      if (!user.google_id) {
        await pool.execute(
          'UPDATE users SET google_id = ? WHERE id = ?',
          [profile.id, user.id]
        );
        user.google_id = profile.id;
      }
      return done(null, user);
    }
    
    // Create new user
    const [userResult] = await pool.execute(
      `INSERT INTO users (
        username, email, google_id, user_type, first_name, last_name, 
        status, email_verified, profile_picture
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.emails[0].value.split('@')[0], // username from email
        profile.emails[0].value,
        profile.id,
        'job_seeker', // default to job seeker
        profile.name.givenName || '',
        profile.name.familyName || '',
        'active',
        true, // Google accounts are verified
        profile.photos[0]?.value || null
      ]
    );

    const newUser = {
      id: userResult.insertId,
      username: profile.emails[0].value.split('@')[0],
      email: profile.emails[0].value,
      google_id: profile.id,
      user_type: 'job_seeker',
      first_name: profile.name.givenName || '',
      last_name: profile.name.familyName || '',
      status: 'active',
      email_verified: true,
      profile_picture: profile.photos[0]?.value || null
    };

    return done(null, newUser);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    if (users.length > 0) {
      done(null, users[0]);
    } else {
      done(null, null);
    }
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
