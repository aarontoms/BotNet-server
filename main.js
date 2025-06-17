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
  console.log('Connected to MongoDB'); 
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
})

app.use(express.json())

app.get('/', (req, res) => {
  res.send('ok cool');
})

const User = require('./models/User')
app.post('/signup', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase()
    const username = req.body.username?.toLowerCase()
    const password = req.body.password
    console.log(`Received signup request: ${username}, ${email}, ${password}`)
    
    const existingEmail = await User.find({ email })
    if (existingEmail.length > 0) return res.status(400).send('Email already in use.')
      
    const existingUsername = await User.findOne({ username })
    if (existingUsername) return res.status(400).send('Username is taken.')
      
    const user = new User({ username, email, password })
    await user.save()

    const payload = { id: user._id };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '15m'
    });

    const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRET, {
      expiresIn: '30d'
    });

    console.log("Access Token: %s\nRefresh Token: %s\n", accessToken, refreshToken);

    res.status(200).json({
      message: 'User registered successfully.',
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(400).send('Error registering user: ' + error.message)
  }
})

app.post('/login', async (req, res) => {
  try {
    const username = req.body.username?.toLowerCase()
    const password = req.body.password
    console.log(`Received login request: ${username}, ${password}`)

    const user = await User.findOne({ username })
    console.log("user found:", user )
    if (!user) return res.status(400).send('Username not found.')

    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(400).send('Invalid password.')

    const payload = { id: user._id };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '15m'
    });

    const refreshToken = jwt.sign(payload, process.env.REFRESH_SECRET, {
      expiresIn: '30d'
    });

    console.log("Access Token: %s\nRefresh Token: %s\n", accessToken, refreshToken)

    res.status(200).json({
      message: 'Login successful.',
      accessToken,
      refreshToken
    });

  } catch (error) {
    res.status(400).send('Error logging in user: ' + error.message)
  }
})

app.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).send('Refresh token required.');

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
    if (err) return res.status(403).send('Invalid or expired refresh token.');

    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(200).json({ accessToken: newAccessToken });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
})