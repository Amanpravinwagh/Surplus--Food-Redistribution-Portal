require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function makeAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const res = await User.updateOne(
      { email: 'admin@test.com' },
      { $set: { role: 'Admin', isAdmin: true } }
    );

    console.log('Update Result:', res);
    console.log('admin@test.com is now an Admin!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

makeAdmin();