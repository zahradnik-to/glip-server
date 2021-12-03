const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');

class AuthService {
  constructor() {
    this.SECRET = process.env.SECRET;
  }

  async register(user) {
    const salt = crypto.randomBytes(32);
    const passwordHashed = await argon2.hash(user.password, { salt });

    const userDocument = new UserModel({
      email: user.email,
      password: passwordHashed,
    });

    const result = await userDocument.save();

    return {
      user: {
        email: result.email,
        salt: salt.toString('hex'),
      },
      token: this.generateJWT(user),
    };
  }

  async login(email, password) {
    const user = await UserModel.findOne({ email });
    if (!user) {
      console.log('noUser');
      throw new Error('User not found');
    }

    const isPasswordCorrect = await argon2.verify(user.password, password);
    if (!isPasswordCorrect) {
      throw new Error('Password is incorrect');
    }

    return {
      token: this.generateJWT(user),
    };
  }

  generateJWT({ _id }) {
    return jwt.sign({
      _id,
    }, this.SECRET, { expiresIn: '8h' });
  }
}

module.exports = AuthService;
