const UserModel = require('../models/userModel');

/**
 * Assigns info about currently logged in user to req.currentUser.
 */
const getCurrentUser = async (req, res, next) => {
  const { id } = req.user;

  const user = await UserModel.findOne({ _id: id });
  if (!user) { throw new Error('Logged in user does not exist!'); }
  req.user = user;

  return next();
};

module.exports = getCurrentUser;
