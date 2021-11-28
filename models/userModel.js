const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true,
  },

  password: {
    type: String,
    required: true,
    trim: true,
    minlength: 3, // Todo add psw complexity
  },

  salt: {
    type: String,
    required: false,
  },

  name: {
    type: String,
  },

  lastname: {
    type: String,
  },

  role: {
    type: String,
    enum: ['user', 'cosmetics', 'hair', 'massage'],
    default: 'user',
  },
});

const UserModel = mongoose.model('User', UserSchema);
module.exports = UserModel;
