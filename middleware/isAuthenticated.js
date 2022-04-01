const isAuth = async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json('You need to login.');
  }
  return next();
};

module.exports = { isAuth };
