const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');

// Todo Refactor/delete all old middleware
const _stripToken = (token) => {
  if (token.includes('Bearer ')) {
    return token.split('Bearer ')[1];
  }
  return token;
};

/**
 * Checks validity of token.
 */
const verifyToken = async (req, res, next) => {
  const token = _stripToken(req.headers.authorization) || '';
  if (!token) {
    return res.status(401).json('You need to Login');
  }

  try {
    const decrypt = jwt.verify(token, process.env.SECRET);

    const user = await UserModel.findOne({ _id: decrypt._id });
    if (!user) { throw new Error('Logged in user does not exist!'); }
    req.user = user; // Fixme - only return relevant attributes

    // req.user = {
    //   id: decrypt._id,
    // };
    return next();
  } catch (err) {
    console.log(err);
    return res.status(500).json(err.toString());
  }
};

module.exports = verifyToken;
