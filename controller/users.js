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
  } catch (err) {
    return res.status(500).json(err.toString()).end();
  }
});

router.post('/login', async (req, res) => {
  const userEmail = req.body.email;
  const userPassword = req.body.password;

  try {
    const authService = new AuthService();
    const { token } = await authService.login(userEmail, userPassword);

    return res.status(200).json(token);
  } catch (err) {
    console.log(err);
    return res.status(401).json(err.toString());
  }
});

router.get('/get', async (req, res) => {
  try {
    const filter = req.query;
    console.log(filter);
    const users = await UserModel.findOne(filter).lean();
    return res.status(200).json(users);
  } catch (err) {
    console.log('Get users error: ', err);
    return res.status(401).json(err.toString());
  }
});

router.get('/get-many', async (req, res) => {
  try {
    const filter = req.query;
    const users = await UserModel.find(filter).lean();
    return res.status(200).json(users);
  } catch (err) {
    console.log('Get many users error: ', err);
    return res.status(401).json(err.toString());
  }
});

module.exports = router;
