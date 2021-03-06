const mongoose = require('mongoose');
const { userRoles } = require('./roleModel');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
  },

  googleId: {
    type: String,
    unique: true,
  },

  role: {
    type: String,
    enum: Object.values(userRoles),
    default: 'user',
  },

  isAdmin: {
    type: Boolean,
  },
});

const UserModel = mongoose.model('User', UserSchema);
module.exports = UserModel;
