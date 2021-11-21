const UserModel = require('../models/user');

/**
 * Assigns info about currently logged in user to req.currentUser.
 */
const getCurrentUser = async (req, res, next) => {
  let { id } = req.user;

  if (!id) {
    const { token } = req.cookies;
    const tokenPayload = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(tokenPayload, 'base64'));
    id = decoded._id;
  }

  const user = await UserModel.findOne({ _id: id });
  if (!user) { throw new Error('Logged in user does not exist!'); }
  req.user = user; // Fixme - only return relevant attributes

  return next();
};

module.exports = getCurrentUser;
