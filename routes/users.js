const express = require('express');
const Users = require('../models/user');
const AuthService = require('../services/authentication');
const verifyToken = require('../middleware/isAuthenticated');
const getCurrentUser = require('../middleware/getCurrentUser');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  const user = new Users(req.body);

  try {
    const authService = new AuthService();
    const registerResult = await authService.register(user);
    return res.status(200).json(registerResult).end();
  } catch (e) {
    return res.json(e).status(500).end();
  }
});

router.post('/login', async (req, res, next) => {
  const userEmail = req.body.email;
  const userPassword = req.body.password;

  try {
    const authService = new AuthService();
    const { token } = await authService.login(userEmail, userPassword);
    // AuthService.generateHttpCookie(res, token);

    return res.json(token);
  } catch (e) {
    return res.json(e).status(500).end();
  }
});

module.exports = router;
