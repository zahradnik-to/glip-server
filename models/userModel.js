const mongoose = require('mongoose');

const userRoles = ['user', 'cosmetics', 'hair', 'massage', 'admin'];

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },

  googleId: {
    type: String,
  },

  role: {
    type: String,
    enum: userRoles,
    default: 'user',
  },

  pretendRole: {
    enum: userRoles,
    type: Boolean,
  },
});

const UserModel = mongoose.model('User', UserSchema);
module.exports = UserModel;
