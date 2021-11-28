const jwt = require('jsonwebtoken');
const AuthService = require('../services/authentication');

// Todo Refactor/delete all old middleware

/**
 * Checks validity of token.
 */
const verifyToken = async (req, res, next) => {
  const token = req.cookies.token || '';
  if (!token) { return res.status(401).json('You need to Login'); }

  const authService = new AuthService();
  try {
    const decrypt = jwt.verify(token, authService.SECRET);
    req.user = {
      id: decrypt._id,
    };
    return next();
  } catch (err) {
    return res.status(500).json(err.toString());
  }
};

module.exports = verifyToken;
