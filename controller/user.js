const express = require('express');
const UserModel = require('../models/userModel');
const AuthService = require('../services/authentication');

const router = express.Router();

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

router.delete('/delete', async (req, res) => {
  const { id } = req.body;
  try {
    const user = await UserModel.find({ _id: id }).lean();
    console.log('user', user);
    if (!user.length) throw new Error('User set for deletion not found!');

    const result = await UserModel.deleteOne({ _id: id });
    res.status(200).json(result);
  } catch (err) {
    console.warn('user/delete error');
    console.log(err);
    res.status(500).send(err.toString());
  }
});

module.exports = router;