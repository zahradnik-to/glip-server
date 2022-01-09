const mongoose = require('mongoose');

const userRoles = {
  ADMIN: 'admin',
  USER: 'user',
  COSMETICS: 'cosmetics',
  HAIR: 'hair',
  MASSAGE: 'massage',
};
const initialUserRoles = [userRoles.ADMIN, userRoles.USER, userRoles.COSMETICS, userRoles.HAIR, userRoles.MASSAGE];

const RoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
});

const RoleModel = mongoose.model('Role', RoleSchema);
module.exports = { RoleModel, initialUserRoles, userRoles };
