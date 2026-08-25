const mongoose = require('mongoose');
const FoodPost = require('./models/FoodPost');
require('dotenv').config();

const samplePosts = [
  {
    donorName: "Grand Hotel",
    donorType: "Restaurant",
    foodItem: "50 Portions Veg Biryani & Paneer Curry",
    quantity: "20 kg",
    preparedTime: new Date(),
    expiryHours: 4,
    location: {
      type: "Point",
      coordinates: [79.0888, 21.1458] // [Longitude, Latitude]
    },
    address: "Civil Lines, Nagpur"
  },
  {
    donorName: "Rohan Sharma",
    donorType: "Individual",
    foodItem: "15 Packets Packed Meals & Snacks",
    quantity: "5 kg",
    preparedTime: new Date(),
    expiryHours: 6,
    location: {
      type: "Point",
      coordinates: [79.0821, 21.1524]
    },
    address: "Dharampeth, Nagpur"
  },
  {
    donorName: "Care & Share Community Kitchen",
    donorType: "NGO",
    foodItem: "40 Portions Rice & Vegetables",
    quantity: "15 kg",
    preparedTime: new Date(),
    expiryHours: 3,
    location: {
      type: "Point",
      coordinates: [79.0800, 21.1400]
    },
    address: "Ramdaspeth, Nagpur"
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for re-seeding...");
    
    // Clear old collection structure
    await FoodPost.deleteMany({});
    console.log("Cleared existing food posts.");

    // Insert new posts with donorType
    await FoodPost.insertMany(samplePosts);
    console.log("Successfully seeded updated food posts!");

    mongoose.connection.close();
  } catch (err) {
    console.error("Seeding error:", err);
  }
};

seedDB();