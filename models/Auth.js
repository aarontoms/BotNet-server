const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const authSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

authSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const Auth = mongoose.model('Auth', authSchema, 'auth');

module.exports = Auth;
