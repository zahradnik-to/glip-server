const mongoose = require('mongoose');

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
    enum: ['user', 'cosmetics', 'hair', 'massage', 'admin'],
    default: 'user',
  },
});

const UserModel = mongoose.model('User', UserSchema);
module.exports = UserModel;
