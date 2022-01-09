const express = require('express');
const UserModel = require('../models/userModel');
const User = require('../models/userModel');
const { UserRoles } = require('../models/roleModel');

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

/**
 * Primarily used to update users role.
 * Admins main role can never be updated, update his pretendRole instead.
 */
router.put('/update', async (req, res) => {
  const { _id, role } = req.body;
  try {
    const user = await User.findOne({ _id });

    if (user.role === UserRoles.ADMIN) user.pretendRole = role;
    else user.role = role;

    await user.save();
    res.status(200);
  } catch (err) {
    console.warn('procedure/delete error');
    console.log(err);
    res.status(500).send(err.toString());
  }
});

module.exports = router;
