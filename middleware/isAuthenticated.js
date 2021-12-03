const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');

// Todo Refactor all old middleware
const _stripToken = (token) => {
  if (token.includes('Bearer ')) {
    return token.split('Bearer ')[1];
  }
  return null;
};

/**
 * Checks validity of token.
 */
const verifyToken = async (req, res, next) => {
  let token = req.headers.authorization || '';
  if (!token) {
    return res.status(401).json('You need to Login');
  }

  token = _stripToken(token);

  try {
    const decrypt = jwt.verify(token, process.env.SECRET);

    const user = await UserModel.findOne({ _id: decrypt._id });
    if (!user) { throw new Error('Logged in user does not exist!'); }
    req.user = user;

    return next();
  } catch (err) {
    console.log(err);
    if (err instanceof jwt.JsonWebTokenError) return res.status(401).send(err.toString());

    return res.status(500).send(err.toString());
  }
};

module.exports = verifyToken;
