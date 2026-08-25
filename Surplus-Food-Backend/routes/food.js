const express = require('express');
const router = express.Router();
const Food = require('../models/Food');
const { verifyAdmin } = require('../middleware/authMiddleware');

// Only validated Admins can delete food listings
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await Food.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Post deleted by Admin' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;