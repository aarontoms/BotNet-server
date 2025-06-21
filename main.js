const express = require('express')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 3000

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})