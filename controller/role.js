const express = require('express');
const {
  RoleModel, initialUserRoles, userRoles, STAFF,
} = require('../models/roleModel');
const { isAuth } = require('../middleware/isAuthenticated');
const { verifyRole } = require('../middleware/isAuthorized');

const router = express.Router();

const setInitialData = function (cb) {
  const initialData = initialUserRoles.map((role) => ({ name: role }));
  RoleModel.insertMany(initialData, cb);
};

RoleModel.findOne({}, async (err, doc) => {
  if (!doc) {
    await setInitialData();
  }
});

router.get('/get', isAuth, async (req, res) => {
  const { getPretend } = req.query;
  if (!verifyRole(STAFF, req.user)) return res.sendStatus(403);
  try {
    let roles = await RoleModel.find().lean();
    if (!getPretend) roles = roles.filter((role) => role.name !== userRoles.ADMIN);
    return res.status(200).json(roles);
  } catch (err) {
    console.log('Get users error: ', err);
    return res.status(401).json(err.toString());
  }
});

module.exports = router;
