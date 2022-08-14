const express = require('express');
const {
  RoleModel, initialUserRoles, userRoles,
} = require('../models/roleModel');
const { isAuth } = require('../middleware/isAuthenticated');
const { verifyRole } = require('../middleware/isAuthorized');
const UserModel = require('../models/userModel');
const { ProcedureModel } = require('../models/procedureModel');
const EventModel = require('../models/eventModel');
const StaffEventModel = require('../models/staffEventModel');

const router = express.Router();

const setInitialData = function (cb) {
  const initialData = initialUserRoles.map((role) => ({ name: role.name, displayName: role.displayName, type: 'role' }));
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
  role.name = role.name
    .trim()
    .replace(/\s/g, '_')
    .toLowerCase();
  role.type = 'staffRole';
  try {
    const roleModel = RoleModel(role);
    await roleModel.save();
    return res.status(201).json(role);
  } catch (err) {
    return res.status(500).json(err);
  }
});

router.delete('/delete', isAuth, async (req, res) => {
  if (!verifyRole(userRoles.ADMIN, req.user)) return res.sendStatus(403);

  const { _id } = req.body;
  try {
    // Find role
    const role = await RoleModel.findById(_id).lean();
    if (!role) throw new Error('Role nebyla nalezena!');

    // Delete role
    const deleteRole = await RoleModel.deleteOne({ _id });

    // Find and update users with role
    const users = await UserModel.find({ role: role.name }).lean();
    if (users) await updateUsersWithDeletedRole(users);

    // Disable procedures with role
    await ProcedureModel.updateMany({ typeOfService: role.name }, { disabled: true });
    // Cancel future studio events
    await EventModel.updateMany({ start: { $gte: new Date() }, typeOfService: role.displayName }, { canceled: true });
    // Delete all studio staff events
    await StaffEventModel.deleteMany({ typeOfService: role.displayName });

    return res.status(200).json(deleteRole);
  } catch (err) {
    console.error('Role delete failed: ', err);
    return res.status(500).send(err.toString());
  }
});

router.put('/update', isAuth, async (req, res) => {
  const {
    _id, name, displayName,
  } = req.body;
  if (!verifyRole(name, req.user)) return res.sendStatus(403);
  try {
    const update = {
      name,
      displayName,
    };
    const result = await RoleModel.findOneAndUpdate({ _id }, update, { new: true }).lean();
    return res.status(200).json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.toString());
  }
});

async function updateUsersWithDeletedRole(users) {
  const newRole = 'user';
  users.map(async (user) => {
    await UserModel.findByIdAndUpdate({ _id: user._id }, { role: newRole }, { new: true }).lean();
  });
}

module.exports = router;
