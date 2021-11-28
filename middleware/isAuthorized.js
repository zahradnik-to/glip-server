/**
 * Checks user role.
 */
const verifyRole = (requiredRole) => (req, res, next) => {
  console.log(req.user);
  if (req.user.role !== requiredRole && req.user.role !== 'admin') {
    return res.status(401).end();
  }
  return next();
};

module.exports = verifyRole;
