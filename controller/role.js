const express = require('express');
const { RoleModel, initialUserRoles, userRoles } = require('../models/roleModel');

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

router.get('/get', async (req, res) => {
  const { getPretend } = req.query;
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
