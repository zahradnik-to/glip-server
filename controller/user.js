const express = require('express');
const passport = require('passport');
const UserModel = require('../models/userModel');
const { verifyRole, verifyRoleOrAuthor } = require('../middleware/isAuthorized');
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
 * Used to update users role.
 */
router.put('/update', isAuth, async (req, res) => {
  const { _id, phoneNumber } = req.body;
  let roleName = req.body.role;
  if (!verifyRoleOrAuthor(userRoles.ADMIN, req.user, _id)) return res.sendStatus(403);
  if (!verifyRole(userRoles.ADMIN, req.user)) roleName = null;

  try {
    const dbRole = await RoleModel.findOne({ name: roleName }).lean();

    await UserModel.findByIdAndUpdate({ _id }, { role: dbRole?.name, phoneNumber }, { new: true }).lean();
    return res.status(200).json(dbRole);
  } catch (err) {
    console.error('User update failed: ', err);
    return res.status(500).send(err.toString());
  }
});

module.exports = router;
