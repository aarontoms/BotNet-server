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
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '15m'
    })
    const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRET, {
      expiresIn: '30d'
    })
    // console.log("Access Token: %s\nRefresh Token: %s\n", accessToken, refreshToken)

    const userDetails = new UserDetails({
      username: auth.username,
      email: auth.email,
      createdAt: new Date(),
      profilePicture: '', 
      bio: '',
      phoneNumber: ''
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

    const payload = { id: auth._id }
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '15m'
    })
    const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRET, {
      expiresIn: '30d'
    })
    // console.log("Access Token: %s\nRefresh Token: %s\n", accessToken, refreshToken)

    let userDetails = await UserDetails.findOne({ username: auth.username })
    if (!userDetails) {
      userDetails = new UserDetails({
        username: auth.username,
        email: auth.email,
        createdAt: null,
        profilePicture: "",
        bio: "",
        phoneNumber: ""
      })
    }
    await userDetails.save()

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
  if (!refreshToken) return res.status(401).send('Refresh token required.')

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
    if (err) return res.status(403).send('Invalid or expired refresh token.')

    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    )

    res.status(200).json({ accessToken: newAccessToken })
  })
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})