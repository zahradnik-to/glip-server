const { userRoles } = require('../models/roleModel');

const { STAFF, USER } = userRoles;
/**
 * Checks user role or admin privilege.
 * @returns {boolean} Returns true if user has sufficient privileges.
 */
const verifyRole = (requiredRole, user) => {
  const { role, isAdmin } = user;
  if (requiredRole === STAFF && role !== USER) {
    return true;
  }
  return !(role !== requiredRole && !isAdmin);
};

/**
 * Checks user role, admin privilege or if user is author of entry.
 * @returns {boolean} Returns true if user has sufficient privileges.
 */
const verifyRoleOrAuthor = (requiredRole, user, eventAuthor) => verifyRole(requiredRole, user) || eventAuthor === user._id.toString();

/**
 * Checks if user is author of entry or has admin privilege.
 * @returns {boolean} Returns true if user is author or has sufficient privileges.
 */
const verifyAuthor = (user, eventAuthor) => user.isAdmin || eventAuthor === user._id.toString();

module.exports = { verifyRole, verifyRoleOrAuthor, verifyAuthor };
