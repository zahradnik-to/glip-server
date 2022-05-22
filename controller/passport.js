const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');

const adminEmails = process.env.ADMIN_EMAILS.split(',');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    ((accessToken, refreshToken, profile, done) => {
      // Does user exist in db
      User.findOne({ googleId: profile.id }, (err, user) => {
        if (err) { return done(err, null); }
        if (!user) {
          const email = profile.emails[0].value;
          const isAdmin = adminEmails.includes(email);
          const userDocument = new User({
            email,
            googleId: profile.id,
            isAdmin,
            role: isAdmin ? 'admin' : 'user',
          });
          userDocument.save()
            .then(() => done(null, profile));
        } else done(null, profile);
        return null;
      });
    }),
  ),
);

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
 * Name and avatar is not saved in DB because it can be changed on Googles side.
 */
passport.deserializeUser((apiUser, done) => {
  // Saves user to req.user
  User.findOne({ googleId: apiUser.id }).lean()
    .then((dbUser) => {
      const user = {
        ...dbUser,
        name: apiUser.name,
        displayName: apiUser.displayName,
      };
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});
