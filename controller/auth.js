const router = require('express').Router();
const passport = require('passport');

const CLIENT_URL = 'http://localhost:3000';

router.get('/login/success', (req, res) => {
  if (req.user) {
    return res.status(200).json({
      success: true,
      message: 'Successful',
      user: req.user,
    });
  }
  return res.status(200).json({
    success: false,
    message: 'Anonymous user',
    user: null,
  });
});

router.get('/login/failed', (req, res) => res.status(401).json({
  success: false,
  message: 'Login failed',
}));

router.get('/logout', (req, res) => {
  req.logout();
  return res.redirect(CLIENT_URL);
});

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  accessType: 'offline',
  prompt: 'consent',
}));

router.get('/google/callback', passport.authenticate('google', {
  successRedirect: CLIENT_URL,
  failureRedirect: '/login/failed',
}));

module.exports = router;
