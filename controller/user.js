const express = require('express');
const passport = require('passport');
const UserModel = require('../models/userModel');
const { verifyRole } = require('../middleware/isAuthorized');
const { isAuth } = require('../middleware/isAuthenticated');
const { userRoles, RoleModel } = require('../models/roleModel');

const router = express.Router();

router.get('/get', async (req, res) => {
  try {
    const filter = req.query;
    const users = await UserModel.findOne(filter).lean();
    return res.status(200).json(users);
  } catch (err) {
    console.log('Get users error: ', err);
    return res.status(401).json(err.toString());
  }
});

router.get('/get-many', isAuth, async (req, res) => {
  if (!verifyRole(userRoles.ADMIN, req.user)) return res.sendStatus(403);

  try {
    const filter = req.query;
    const users = await UserModel.find(filter).lean();
    return res.status(200).json(users);
  } catch (err) {
    console.log('Get many users error: ', err);
    return res.status(401).json(err.toString());
  }
});

router.delete('/delete', isAuth, async (req, res) => {
  if (!verifyRole(userRoles.ADMIN, req.user)) return res.sendStatus(403);

  const { id } = req.body;
  try {
    const user = await UserModel.findOne({ _id: id }).lean();
    if (!user) throw new Error('Uživatel nebyl nalezen!');

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
router.put('/update', passport.authenticate('bearer', { session: false }), async (req, res) => {
  console.log(req.user);
  if (!verifyRole(userRoles.ADMIN, req.user)) return res.sendStatus(403);

  const { _id, roleId } = req.body;

  try {
    const role = await RoleModel.findById(roleId).lean();

    await UserModel.findByIdAndUpdate({ _id }, { role: role.name }, { new: true }).lean();
    return res.sendStatus(200);
  } catch (err) {
    console.error('User update failed: ', err);
    return res.status(500).send(err.toString());
  }
});

module.exports = router;
