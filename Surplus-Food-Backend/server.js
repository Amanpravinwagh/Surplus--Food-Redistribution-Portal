const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/surplus_food_db')
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// --- MONGOOSE SCHEMAS & MODELS ---

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Admin', 'Restaurant', 'Donor', 'NGO', 'User'], 
    default: 'Restaurant' 
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Food Post Schema
const foodPostSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  userAccountName: { type: String },
  donorType: { type: String, default: 'Restaurant' },
  foodItem: { type: String, required: true },
  quantity: { type: String, required: true },
  expiryHours: { type: Number, default: 4 },
  address: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  status: { type: String, enum: ['Available', 'Claimed'], default: 'Available' },
  claimedBy: { type: String, default: null }
}, { timestamps: true });

foodPostSchema.index({ location: '2dsphere' });
const FoodPost = mongoose.model('FoodPost', foodPostSchema);

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, message: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Middleware to strictly enforce Admin role
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied: Admins only' });
  }
};

// --- AUTH ROUTES ---

// 1. SIGNUP ROUTE (Now correctly saves the selected role)
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, username, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
      username: username || email.split('@')[0],
      role: role || 'Restaurant' // Explicitly accepts role from frontend
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, role: newUser.role, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        name: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. DELETE ACCOUNT ROUTE (Deletes currently logged in user from DB)
app.delete('/api/auth/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: 'User record not found in database' });
    }

    res.json({ 
      success: true, 
      message: `Account ${deletedUser.email} permanently removed from database.` 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- FOOD POST ROUTES ---

// Get All Food Posts
app.get('/api/food/all', async (req, res) => {
  try {
    const posts = await FoodPost.find().sort({ createdAt: -1 });
    res.json({ success: true, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create Food Post
app.post('/api/food/create', async (req, res) => {
  try {
    const { donorName, userAccountName, donorType, foodItem, quantity, expiryHours, address, latitude, longitude } = req.body;

    const newPost = new FoodPost({
      donorName,
      userAccountName,
      donorType,
      foodItem,
      quantity,
      expiryHours,
      address,
      latitude,
      longitude,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      }
    });

    await newPost.save();

    // Broadcast to real-time clients
    io.emit('new_food_available', newPost);

    res.status(201).json({ success: true, data: newPost });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Claim Food Post
app.patch('/api/food/claim/:id', async (req, res) => {
  try {
    const { ngoName } = req.body;
    const updatedPost = await FoodPost.findByIdAndUpdate(
      req.params.id,
      { status: 'Claimed', claimedBy: ngoName },
      { new: true }
    );

    if (!updatedPost) return res.status(404).json({ success: false, message: 'Post not found' });

    io.emit('food_status_updated', updatedPost);

    res.json({ success: true, data: updatedPost });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Food Post (Protected: Admin Only)
app.delete('/api/food/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deletedPost = await FoodPost.findByIdAndDelete(req.params.id);
    if (!deletedPost) return res.status(404).json({ success: false, message: 'Post not found' });

    io.emit('food_post_deleted', { id: req.params.id });

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});