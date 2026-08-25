# 🍱 Surplus Food Redistribution Portal

An end-to-end web application built to eliminate local food waste and tackle hunger. **Surplus Food Portal** bridges the gap between surplus food providers (restaurants, hotels, events, and individuals) and local non-profit organizations (NGOs, shelters, and food banks). 

By leveraging real-time WebSockets and geolocation mapping, the platform allows donors to list excess edible food instantly, allowing nearby verified NGOs to view, claim, and collect the food before it spoils.

---

## 🌟 Problem & Solution

* **The Problem:** Massive amounts of edible, fresh food are discarded daily by commercial kitchens and events while local food banks and shelters struggle with food shortages.
* **The Solution:** A unified platform providing real-time alerts, dynamic location mapping, and streamlined matching so surplus food is safely redirected to those in need within minutes.

---

## ✨ Key Features

* 📍 **Interactive Map & Geocoding:** Visualizes active pickup points using Leaflet maps with automatic address reverse-geocoding via OpenStreetMap.
* ⚡ **Real-Time Dynamic Dispatch:** Utilizes Socket.IO to immediately notify online NGOs when new food listings are published without needing a page refresh.
* 🎯 **Role-Based Workflows:** Customized interfaces for Food Donors (listing, updating, managing stock) and NGOs (filtering, navigating, claiming).
* 🔒 **Secure Authentication & Management:** User authorization with account management capabilities.

---

## 🛠️ Tech Stack

* **Frontend:** React.js, Tailwind CSS, Leaflet.js, React-Leaflet, Axios, Socket.IO Client
* **Backend:** Node.js, Express.js, Socket.IO
* **Database:** MongoDB (Geospatial Indexing & Queries)
* **APIs:** OpenStreetMap Nominatim API (Geocoding & Reverse Geocoding)

---

## 📂 Project Structure

```text
surplus-food-portal/
├── client/                 # React Frontend Application
│   ├── public/
│   ├── src/
│   │   ├── assets/         # App icons and images
│   │   ├── App.js          # Main application file & Socket handlers
│   │   └── index.js
│   └── package.json
│
├── server/                 # Node.js Express Backend Engine
│   ├── models/             # Database Schemas (User, FoodPost)
│   ├── routes/             # REST API Routes (Auth, Food CRUD)
│   ├── server.js           # Server entry point & Socket.IO initialization
│   └── package.json
│
└── README.md
⚙️ How to Run the Project Locally
Follow these instructions to set up and execute both the backend and frontend on your local machine.

Prerequisites
Ensure you have the following installed on your system:

Node.js (v16.x or higher)

npm (comes with Node.js)

MongoDB running locally on port 27017 OR a MongoDB Atlas connection string.

Step 1: Clone the Repository
Bash
git clone [https://github.com/your-username/surplus-food-portal.git](https://github.com/your-username/surplus-food-portal.git)
cd surplus-food-portal
Step 2: Backend Setup & Execution
Navigate to the backend server directory:

Bash
cd server
Install backend dependencies:

Bash
npm install
Create a .env file in the server root folder and add the following variables:

Code snippet
PORT=5000
MONGO_URI=mongodb://localhost:27017/surplus_food_db
JWT_SECRET=your_jwt_secret_key
(Replace MONGO_URI with your MongoDB Atlas string if you are using cloud database storage).

Start the backend server:

Bash
# Development mode with auto-reload (if nodemon is configured)
npm run dev

# Standard node server startup
npm start
The backend server should now be running on http://localhost:5000.

Step 3: Frontend Setup & Execution
Open a new terminal window/tab, navigate to the repository root, and switch to the client directory:

Bash
cd client
Install frontend dependencies:

Bash
npm install
Start the React development server:

Bash
npm start
Open your browser and navigate to:

Plaintext
http://localhost:3000
🧪 Testing the Application
Register as a Donor / Restaurant:

Create an account, switch to the Dashboard, enter a food item, quantity, and address.

Click Publish. The map will automatically update with a pin at the location.

Register as an NGO (In a second browser tab or private window):

Sign in as an NGO user.

View the interactive map and dashboard—the listing published by the donor will appear in real time via Socket.IO.

Click Claim Food to lock the donation.

📜 Regulatory Standards & Research Frameworks
The core mission and logic of this project align with global sustainability and food security guidelines:

UNEP: Food Waste Index Report Standards

FAO: Food Loss and Waste Protocol

FSSAI: Recovery & Distribution of Surplus Food Regulations
