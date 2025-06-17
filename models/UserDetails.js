const mongoose = require('mongoose');

const userDetailsSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    createdAt: { type: Date, immutable: true },

    profilePicture: { type: String, default: '' },
    bio: { type: String, default: '' },
    phoneNumber: { type: String },

});

const userDetails = mongoose.model('User', userDetailsSchema, 'userDetails');

module.exports = userDetails;