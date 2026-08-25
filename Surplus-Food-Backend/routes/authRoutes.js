const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

// ------------------------------------------------------------------
// 1. Signup Route -> Resolves to: POST /api/auth/signup
// ------------------------------------------------------------------
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, address, donorType } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Security Guard: Prevent public signup as 'Admin' directly
    const assignedRole = role === 'Admin' ? 'User' : (role || 'User');

    // Create user document according to User.js schema
    const user = new User({
      name,
      email,
      password, // Note: Hash with bcrypt in production
      role: assignedRole,
      address,
      donorType,
      isAdmin: false
    });

    await user.save();

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user._id, role: user.role, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address,
        donorType: user.donorType,
        isAdmin: user.isAdmin
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// ------------------------------------------------------------------
// 2. Login Route -> Resolves to: POST /api/auth/login
// ------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Verify user exists in DB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Verify password
    if (user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Verify Admin Authorization against DB record
    if (role === 'Admin' && (!user.isAdmin || user.role !== 'Admin')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: You do not have administrator permissions.' 
      });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user._id, role: user.role, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        address: user.address,
        donorType: user.donorType,
        isAdmin: user.isAdmin
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});

// Export the router module
module.exports = router;