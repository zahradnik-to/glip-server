/**
 * Checks user role.
 */
const verifyRole = (requiredRole) => (req, res, next) => {
  if (req.user.role !== requiredRole) {
    return res.status(401).end();
  }
  return next();
};

module.exports = verifyRole;
