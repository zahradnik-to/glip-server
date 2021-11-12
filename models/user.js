const mongoose = require('mongoose')

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

  surname: {
    type: String,
  },

  role: {
    type: String,
    default: 'user', // Possible values: user | admin
  }
})

const User = mongoose.model("User", UserSchema)
module.exports = User