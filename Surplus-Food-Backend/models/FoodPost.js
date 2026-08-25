const mongoose = require('mongoose');

const foodPostSchema = new mongoose.Schema(
  {
    donorName: {
      type: String,
      required: [true, 'Donor name is required'],
      trim: true
    },
    donorType: {
      type: String,
      enum: ['Restaurant', 'Individual', 'Other'],
      required: [true, 'Donor type is required']
    },
    foodItem: {
      type: String,
      required: [true, 'Food type/description is required'],
      trim: true
    },
    quantity: {
      type: String,
      required: [true, 'Quantity is required'],
      trim: true
    },
    preparedTime: {
      type: Date,
      required: [true, 'Prepared time is required'],
      default: Date.now
    },
    expiryHours: {
      type: Number, // Shelf life in hours
      required: [true, 'Shelf life is required'],
      default: 4
    },
    status: {
      type: String,
      enum: ['Available', 'Claimed', 'Picked Up', 'Cancelled'],
      default: 'Available'
    },
    claimedByNGO: {
      type: String, // Stores the NGO's name upon claim
      default: null
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [Longitude, Latitude]
        required: [true, 'Coordinates [longitude, latitude] are required']
      }
    },
    address: {
      type: String,
      required: [true, 'Pickup address is required'],
      trim: true
    }
  },
  {
    timestamps: true
  }
);

foodPostSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('FoodPost', foodPostSchema);