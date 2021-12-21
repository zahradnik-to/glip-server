/**
 * Checks user role.
 */
const verifyRole = (requiredRole) => (req, res, next) => {
  console.log('Verify this user: ', req.user);
  if (req.user.role !== requiredRole && req.user.role !== 'admin') {
    return res.status(403).json('Insufficient privileges.');
  }
  return next();
};

module.exports = verifyRole;
