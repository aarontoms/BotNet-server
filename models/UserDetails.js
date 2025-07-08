const mongoose = require('mongoose');

const userDetailsSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    createdAt: { type: Date, immutable: true },

    fullName: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    bio: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    posts: {
        type: [{
            imgUrl: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
            caption: { type: String, default: '' }
        }],
        default: []
    }
});

const UserDetails = mongoose.model('User', userDetailsSchema, 'userDetails');

module.exports = UserDetails;