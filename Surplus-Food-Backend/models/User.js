const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required']
    },
    role: {
      type: String,
      enum: ['Donor', 'NGO', 'Admin', 'User','Restaurant'],
      required: true
    },
    // Explicit DB flag for Admin privileges
    isAdmin: {
      type: Boolean,
      default: false
    },
    // NGO specific field (Name + Address only)
    address: {
      type: String,
      trim: true,
      required: function () {
        return this.role === 'NGO'; // Required for NGOs
      }
    },
    // Donor specific field
    donorType: {
      type: String,
      enum: ['Restaurant', 'Individual', 'Other'],
      required: function () {
        return this.role === 'Donor'; // Required for Donors
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);