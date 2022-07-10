const mongoose = require('mongoose');

const userRoles = {
  ADMIN: 'admin',
  USER: 'user',
  STAFF: 'staff', // Constant meant to represent any role that is not user
};
const initialUserRoles = [
  {
    name: 'admin',
    displayName: 'Administrátor',
  },
  {
    name: 'user',
    displayName: 'Uživatel',
  },
];

const RoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },

  displayName: {
    type: String,
    unique: true,
  },

  type: {
    type: String,
    enum: ['role', 'staffRole'],
    required: true,
  },
});

RoleSchema.path('displayName').required(function () {
  return this.type === 'staffRole';
});

const RoleModel = mongoose.model('Role', RoleSchema);
module.exports = { RoleModel, initialUserRoles, userRoles };
