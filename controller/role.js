const express = require('express');
const {
  RoleModel, initialUserRoles, userRoles,
} = require('../models/roleModel');
const { isAuth } = require('../middleware/isAuthenticated');
const { verifyRole } = require('../middleware/isAuthorized');
const UserModel = require('../models/userModel');

const router = express.Router();

const setInitialData = function (cb) {
  const initialData = initialUserRoles.map((role) => ({ name: role, type: 'role' }));
  RoleModel.insertMany(initialData, cb);
};

RoleModel.findOne({}, async (err, doc) => {
  if (!doc) {
    await setInitialData();
  }
});

router.get('/get', async (req, res) => {
  const filter = req.query;
  if (!req.user || !verifyRole(userRoles.STAFF, req.user)) {
    filter.type = 'staffRole';
  }
  try {
    const roles = await RoleModel.find(filter).lean();
    return res.status(200).json(roles);
  } catch (err) {
    console.log('Get role error: ', err);
    return res.status(401).json(err.toString());
  }
});

router.post('/create', isAuth, async (req, res) => {
  if (!verifyRole(userRoles.ADMIN, req.user)) return res.sendStatus(403);

  const role = req.body;
  try {
    const roleModel = RoleModel(role);
    await roleModel.save();
    return res.status(201).json(role);
  } catch (err) {
    return res.status(501).json(err);
  }
});

router.delete('/delete', isAuth, async (req, res) => {
  if (!verifyRole(userRoles.ADMIN, req.user)) return res.sendStatus(403);

  const { id } = req.body;
  try {
    // Find role
    const role = await RoleModel.findOne({ _id: id }).lean();
    if (!role.length) throw new Error('Role nebyla nalezena!');

    // Find and update users with role
    const users = await UserModel.findOne({ role: role.name }).lean();
    await updateRoleOfUsers(users);

    // Delete role
    const deleteRole = await RoleModel.deleteOne({ _id: id });
    return res.status(200).json(deleteRole);
  } catch (err) {
    console.error('Role delete failed: ', err);
    return res.status(500).send(err.toString());
  }
});

async function updateRoleOfUsers(users) {
  users.map(async (user) => {
    await UserModel.findByIdAndUpdate({ _id: user._id }, { role: 'user' }, { new: true }).lean();
  });
}

module.exports = router;
