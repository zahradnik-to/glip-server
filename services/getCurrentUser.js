const jwtDecode = require('jwt-decode');
const UserModel = require('../models/user');

/**
 * Find an user from token.
 */
const getCurrentUser = async (token) => {
  const decodedToken = jwtDecode(token);
  const user = await UserModel.findOne({ _id: decodedToken._id });
  if (!user) { throw new Error('Logged in user does not exist!'); }
  return user;
};

module.exports = getCurrentUser;
