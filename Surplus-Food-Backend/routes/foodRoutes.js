const express = require('express');
const router = express.Router();
const FoodPost = require('../models/FoodPost');
const { verifyAdmin } = require('../middleware/authMiddleware'); 
const { sendNewFoodAlertToNGO, sendClaimNotificationToDonor } = require('../utils/emailService');

// 1. POST /api/food/create - Restaurant publishes food -> Sends Email to NGO
router.post('/create', async (req, res) => {
  try {
    const { 
      donorName, 
      donorType, 
      donorEmail, // Email of the restaurant publishing food
      foodItem, 
      quantity, 
      preparedTime, 
      expiryHours, 
      longitude, 
      latitude, 
      address,
      createdBy,
      targetNgoEmail,
      targetNgoName
    } = req.body;

    if (longitude === undefined || latitude === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Longitude and latitude are required' 
      });
    }

    const newPost = new FoodPost({
      donorName,
      donorType: donorType || 'Restaurant',
      donorEmail: donorEmail || null,
      foodItem,
      quantity,
      preparedTime: preparedTime || new Date(),
      expiryHours: expiryHours || 4,
      createdBy: createdBy || null,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      address
    });

    await newPost.save();

    const io = req.app.get('socketio');
    if (io) {
      io.emit('new_food_available', newPost);
    }

    res.status(201).json({ success: true, data: newPost });

    // Send Real-time Gmail notification to NGO
    sendNewFoodAlertToNGO({
      ngoEmail: targetNgoEmail,
      ngoName: targetNgoName || 'NGO Partner',
      restaurantName: donorName,
      foodItem: foodItem,
      quantity: quantity,
      address: address
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/food/nearby - Query nearby available food posts
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radiusKm = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude and Longitude query parameters are required' 
      });
    }

    const nearbyFood = await FoodPost.find({
      status: 'Available',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radiusKm) * 1000
        }
      }
    });

    res.status(200).json({ 
      success: true, 
      count: nearbyFood.length, 
      data: nearbyFood 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/food/all - Fetch all posts
router.get('/all', async (req, res) => {
  try {
    const posts = await FoodPost.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. PATCH /api/food/claim/:id - NGO claims food -> Sends Email to Restaurant
router.patch('/claim/:id', async (req, res) => {
  try {
    const { ngoName, ngoEmail } = req.body;

    if (!ngoName) {
      return res.status(400).json({ 
        success: false, 
        message: 'NGO name is required to claim food' 
      });
    }

    const updatedPost = await FoodPost.findByIdAndUpdate(
      req.params.id,
      { status: 'Claimed', claimedByNGO: ngoName },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ success: false, message: 'Food post not found' });
    }

    const io = req.app.get('socketio');
    if (io) {
      io.emit('food_status_updated', updatedPost);
    }

    res.status(200).json({ success: true, data: updatedPost });

    // Send Real-time Gmail notification to Restaurant
    sendClaimNotificationToDonor({
      donorEmail: updatedPost.donorEmail,
      donorName: updatedPost.donorName,
      ngoName: ngoName,
      ngoEmail: ngoEmail,
      foodItem: updatedPost.foodItem || 'Surplus Food Package',
      quantity: updatedPost.quantity
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. DELETE /api/food/:id - Remove/Delete a food post (Admin Protected)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const deletedPost = await FoodPost.findByIdAndDelete(req.params.id);

    if (!deletedPost) {
      return res.status(404).json({ success: false, message: 'Food post not found' });
    }

    const io = req.app.get('socketio');
    if (io) {
      io.emit('food_post_deleted', { id: req.params.id });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Food post removed successfully',
      deletedId: req.params.id 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;