const express = require('express')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors');

const app = express()
const PORT = process.env.PORT || 3000
app.use(cors());

dotenv.config()
mongoose.connect(process.env.MONGO_URL, {
  dbName: "BotNet"
}).then(() => {
  console.log('Connected to MongoDB')
}).catch(err => {
  console.error('Error connecting to MongoDB:', err)
})

app.use(express.json())

app.get('/', (req, res) => {
  res.send('ok cool')
})

const Auth = require('./models/Auth')
const UserDetails = require('./models/UserDetails')
app.post('/signup', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase()
    const username = req.body.username?.toLowerCase()
    const password = req.body.password
    console.log(`Received signup request: ${username}, ${email}, ${password}`)

    const existingEmail = await Auth.find({ email })
    if (existingEmail.length > 0) return res.status(400).send('Email already in use.')

    const existingUsername = await Auth.findOne({ username })
    if (existingUsername) return res.status(400).send('Username is taken.')

    const auth = new Auth({ username, email, password })
    await auth.save()

    const payload = { id: auth._id }
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15m'
    })
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '30d'
    })
    // console.log("Access Token: %s\nRefresh Token: %s\n", accessToken, refreshToken)

    const userDetails = new UserDetails({
      username: auth.username,
      email: auth.email,
      createdAt: new Date(),
    })
    await userDetails.save()

    res.status(200).json({
      message: 'User registered successfully.',
      accessToken,
      refreshToken,
      userDetails
    })
  } catch (error) {
    res.status(400).send('Error registering user: ' + error.message)
  }
})

app.post('/login', async (req, res) => {
  try {
    const username = req.body.username?.toLowerCase()
    const password = req.body.password
    console.log(`Received login request: ${username}, ${password}`)

    const auth = await Auth.findOne({ username })
    // console.log("user found:", auth )
    if (!auth) return res.status(400).send('Username not found.')

    const match = await bcrypt.compare(password, auth.password)
    if (!match) return res.status(400).send('Invalid password.')

    let userDetails = await UserDetails.findOne({ username: auth.username })
    if (!userDetails) {
      userDetails = new UserDetails({
        username: auth.username,
        email: auth.email,
        createdAt: null,
      })
    }
    await userDetails.save()

    const payload = { id: userDetails._id }
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '15m'
    })
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '30d'
    })
    // console.log("Access Token: %s\nRefresh Token: %s\n", accessToken, refreshToken)

    res.status(200).json({
      message: 'Login successful.',
      accessToken,
      refreshToken,
      userDetails
    })

  } catch (error) {
    res.status(400).send('Error logging in user: ' + error.message)
  }
})

app.post('/token-refresh', (req, res) => {
  const { refreshToken } = req.body
  console.log("Received token refresh request with refresh token:", refreshToken)
  if (!refreshToken) return res.status(400).send('Refresh token required.')

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
    if (err) return res.status(403).send('Invalid or expired refresh token.')

    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    )

    res.status(200).json({ accessToken: newAccessToken })
  })
})

app.get('/refreshDetails', async (req, res) => {
  console.log("Received request to refresh user details")
  try {
    const authHeader = req.headers['authorization']
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("Authorization header missing or malformed")
      return res.status(400).json({ message: 'Token missing or malformed.' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)

    const userDetails = await UserDetails.findById(decoded.id)
    // console.log("Decoded user ID:", decoded.id)
    if (!userDetails) {
      console.log("User details not found for ID:", decoded.id)
      return res.status(404).json({ message: 'User not found.' })
    }

    console.log("User details found:", userDetails)
    res.status(200).json({ message: "User details refreshed successfully.", userDetails })
  } catch (err) {
    // console.error("Error refreshing user details:", err)
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
})

const extractUserId = (req) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    return decoded.id;
  } catch {
    return null;
  }
};

app.post('/updateProfile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization']
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ message: 'Token missing or malformed.' })

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    const userId = decoded.id

    const updates = req.body

    const user = await UserDetails.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true
    })

    console.log("User profile updated:", user)
    res.status(200).json({ message: 'Profile updated', userDetails: user })
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
})

const { upload } = require('./cloudinary')
app.post('/uploadProfilePicture', upload.single('image'), async (req, res) => {
  console.log("Received request to upload profile picture")
  try {
    const authHeader = req.headers['authorization']
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ message: 'Missing token' })

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    const userId = decoded.id

    const imageUrl = req.file.path

    const updatedUser = await UserDetails.findByIdAndUpdate(
      userId,
      { profilePicture: imageUrl },
      { new: true }
    )

    res.status(200).json({ message: 'Profile picture updated', userDetails: updatedUser })
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token.' })
  }
})

app.get('/searchUsers', async (req, res) => {

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer '))
    return res.status(400).json({ message: 'Missing token' });

  try {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  let query = req.query.q;
  console.log("Received search request with query:", query);
  if (!query) return res.status(200).json({ users: [] });

  try {
    const users = await UserDetails.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } }
      ]
    }).select('-__v');

    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

app.get('/getUserDetails/:username', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer '))
    return res.status(400).json({ message: 'Missing token' });
  
  let currentUserId;
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    currentUserId = decoded.id;
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  
  const targetUsername = req.params.username;
  try {
    const targetUser = await UserDetails.findOne({ username: targetUsername })
      .populate('followers', '_id')
      .populate('following', '_id');
    
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const isFollowing = targetUser.followers.some(f => f._id.toString() === currentUserId);
    const isRequested = targetUser.pendingRequests.some(r => r._id.toString() === currentUserId);
    const isSelf = targetUser._id.toString() === currentUserId;

    if (isFollowing || isSelf) {
      let fullUser = await UserDetails.findById(targetUser._id)
        .populate('followers', 'username fullName profilePicture')
        .populate('following', 'username fullName profilePicture')
        .select('-__v');
      fullUser = {
        ...fullUser.toObject(),
        isFollowing,
        isRequested,
      };
      return res.status(200).json({ userDetails: fullUser });
    } else {
      const { username, fullName, profilePicture, bio, followers, following, posts } = targetUser;
      return res.status(200).json({
        userDetails: {
          username,
          fullName,
          profilePicture,
          bio,
          followersCount: followers.length,
          followingCount: following.length,
          postsCount: posts.length,
          isFollowing,
          isRequested,
        }
      });
    }
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve user details', error: err.message });
  }
});

app.post('/sendFollowRequest/:username', async (req, res) => {
  console.log("Received request to send follow request")
  const currentUserId = extractUserId(req);
  if (!currentUserId) return res.status(401).send('Unauthorized');

  const targetUsername = req.params.username;
  const targetUser = await UserDetails.findOne({ username: targetUsername });
  if (!targetUser) return res.status(404).send('Target user not found');

  if (!targetUser.pendingRequests.includes(currentUserId)) {
    targetUser.pendingRequests.push(currentUserId);
    await targetUser.save();
  }

  res.status(200).send('Follow request sent');
});

app.post('/removeFollowRequest/:username', async (req, res) => {
  const currentUserId = extractUserId(req);
  if (!currentUserId) return res.status(401).send('Unauthorized');

  const targetUsername = req.params.username;
  const targetUser = await UserDetails.findOne({ username: targetUsername });
  if (!targetUser) return res.status(404).send('Target user not found');

  targetUser.pendingRequests = targetUser.pendingRequests.filter(
    (id) => id.toString() !== currentUserId
  );
  await targetUser.save();

  res.status(200).send('Follow request removed');
});

app.post('/unfollowUser/:username', async (req, res) => {
  const currentUserId = extractUserId(req);
  if (!currentUserId) return res.status(401).send('Unauthorized');

  const targetUsername = req.params.username;
  const targetUser = await UserDetails.findOne({ username: targetUsername });
  const currentUser = await UserDetails.findById(currentUserId);
  if (!targetUser || !currentUser) return res.status(404).send('User not found');

  targetUser.followers = targetUser.followers.filter(
    (id) => id.toString() !== currentUserId
  );
  currentUser.following = currentUser.following.filter(
    (id) => id.toString() !== targetUser._id.toString()
  );

  await targetUser.save();
  await currentUser.save();

  res.status(200).send('Unfollowed successfully');
});

app.get('/getFollowRequests', async (req, res) => {
  const currentUserId = extractUserId(req);
  if (!currentUserId) return res.status(401).send('Unauthorized');

  try {
    const user = await UserDetails.findById(currentUserId).populate('pendingRequests', 'username fullName profilePicture');
    if (!user) return res.status(404).send('User not found');

    res.status(200).json({ followRequests: user.pendingRequests });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.post('/acceptFollowRequest/:userID', async (req, res) => {
  console.log("Received request to accept follow request")
  const currentUserId = extractUserId(req);
  if (!currentUserId) return res.status(401).send('Unauthorized');

  const requesterId = req.params.userID;

  const currentUser = await UserDetails.findById(currentUserId);
  const requester = await UserDetails.findById(requesterId);

  if (!currentUser || !requester) return res.status(404).send('User not found');

  const requesterObjectId = new mongoose.Types.ObjectId(requesterId);

  if (!currentUser.pendingRequests.some(id => id.equals(requesterObjectId))) {
    return res.status(400).send('Follow request not found');
  }

  currentUser.followers.push(requesterObjectId);
  requester.following.push(currentUser._id);

  currentUser.pendingRequests = currentUser.pendingRequests.filter(
    id => !id.equals(requesterObjectId)
  );

  await currentUser.save();
  await requester.save();

  res.status(200).send('Follow request accepted');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})