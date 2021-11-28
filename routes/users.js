const express = require('express');
const UserModel = require('../models/userModel');
const AuthService = require('../services/authentication');

const router = express.Router();

router.post('/register', async (req, res) => {
  const user = new UserModel(req.body);

  try {
    const authService = new AuthService();
    const registerResult = await authService.register(user);
    return res.status(200).json(registerResult).end();
  } catch (e) {
    return res.json(e).status(500).end();
  }
});

router.post('/login', async (req, res) => {
  const userEmail = req.body.email;
  const userPassword = req.body.password;

  try {
    const authService = new AuthService();
    const { token } = await authService.login(userEmail, userPassword);

    return res.json(token).status(200);
  } catch (e) {
    console.log('Err caught');
    console.log(e);
    return res.json(e).status(500);
  }
});

module.exports = router;
