const express = require('express');
const UserModel = require('../models/userModel');
const { verifyRole } = require('../middleware/isAuthorized');
const { isAuth } = require('../middleware/isAuthenticated');

const router = express.Router();
// Todo user auth

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

router.get('/get-many', isAuth, async (req, res) => {
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
    if (!user.length) throw new Error('Uživatel nebyl nalezen!');

    const result = await UserModel.deleteOne({ _id: id });
    return res.status(200).json(result);
  } catch (err) {
    console.warn('user/delete error');
    console.log(err);
    return res.status(500).send(err.toString());
  }
});

/**
 * Primarily used to update users role.
 */
router.put('/update', async (req, res) => {
  const { _id, role } = req.body;
  try {
    const result = await UserModel.findByIdAndUpdate({ _id }, { role }, { new: true }).lean();
    console.log(result);
    res.sendStatus(200);
  } catch (err) {
    console.warn('user/update error');
    console.log(err);
    res.status(500).send(err.toString());
  }
});

module.exports = router;
