const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');

const adminEmails = process.env.ADMIN_EMAILS.split(',');

const passportStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
  },
  ((accessToken, refreshToken, profile, done) => {
    // Prepare user object
    const email = profile.emails[0].value;
    const isAdmin = adminEmails.includes(email);
    const user = {
      email,
      googleId: profile.id,
      isAdmin,
      name: profile.name,
      displayName: profile.displayName,
    };
    if (isAdmin) user.role = 'admin';

    // Update user with new tokens, if new user -> create
    User.findOneAndUpdate({ googleId: profile.id }, user, { upsert: true, new: true }, (err, dbUser) => {
      if (err) { return done(err, null); }
      return done(null, dbUser);
    }).lean();
  }),
);

passport.use(passportStrategy);

/**
 * Saves users id to req.session.passport.user = {id: '..'}. User data get passed to deserializeUser.
 */
passport.serializeUser((user, done) => {
  console.log(user);
  done(null, { _id: user._id });
});

/**
 * Saves user to req.user = {user}.
 * Finds user with same google id in DB and merges them with data from Google API.
 */
passport.deserializeUser((user, done) => {
  // Saves user to req.user
  User.findById(user._id.toString()).lean()
    .then((dbUser) => {
      done(null, dbUser);
    })
    .catch((err) => {
      done(err, null);
    });
});
