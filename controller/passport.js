const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel');

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
          const userDocument = new User({
            email: profile.emails[0].value,
            googleId: profile.id,
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
 * Saves users id to req.session.passport.user = {id: '..'}
 */
passport.serializeUser((user, done) => {
  done(null, user);
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
        photos: apiUser.photos,
        displayName: apiUser.displayName,
      };
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});
