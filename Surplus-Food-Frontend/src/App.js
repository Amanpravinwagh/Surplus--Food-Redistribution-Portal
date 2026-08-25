import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import logo from './assets/logo.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const socket = io('http://localhost:5000');

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 14, { animate: true });
    }
  }, [center, map]);
  return null;
}

function LocationPicker({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function DraggableMarker({ position, setPosition, onDragEnd }) {
  const markerRef = useRef(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newLatLng = marker.getLatLng();
          const newCoords = [newLatLng.lat, newLatLng.lng];
          setPosition(newCoords);
          onDragEnd(newCoords);
        }
      },
    }),
    [setPosition, onDragEnd]
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    >
      <Popup minWidth={140}>
        <span className="text-xs font-semibold text-gray-700">
          📍 Drag me to pinpoint exact location!
        </span>
      </Popup>
    </Marker>
  );
}

const geocodeAddress = async (addressQuery) => {
  if (!addressQuery || !addressQuery.trim()) return null;
  const headers = { 'User-Agent': 'SurplusFoodApp/1.0' };

  const parts = addressQuery.split(',').map((p) => p.trim()).filter(Boolean);
  const broaderQuery = parts.length > 2 ? parts.slice(-3).join(', ') : addressQuery;

  try {
    let res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: broaderQuery, format: 'json', limit: 1 },
      headers,
    });

    if (res.data && res.data.length > 0) {
      return [parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)];
    }

    if (parts.length > 1) {
      const cityQuery = parts.slice(-2).join(', ');
      res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q: cityQuery, format: 'json', limit: 1 },
        headers,
      });
      if (res.data && res.data.length > 0) {
        return [parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)];
      }
    }
  } catch (e) {
    console.warn('Geocoding search error:', e);
  }

  return null;
};

const reverseGeocode = async (lat, lon) => {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon, format: 'json' },
      headers: { 'User-Agent': 'SurplusFoodApp/1.0' },
    });
    if (res.data && res.data.display_name) {
      return res.data.display_name;
    }
  } catch (e) {
    console.error('Reverse geocode error:', e);
  }
  return null;
};

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  const [authData, setAuthData] = useState({ 
    email: '', 
    password: '', 
    name: '',
    role: 'Restaurant'
  });

  const [foodPosts, setFoodPosts] = useState([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [previewCoords, setPreviewCoords] = useState(null);
  const [ngoLocation, setNgoLocation] = useState('');
  const [ngoCoords, setNgoCoords] = useState(null);
  const [searchFilterQuery, setSearchFilterQuery] = useState('');

  const [formData, setFormData] = useState({
    donorName: '',
    donorType: 'Restaurant',
    foodItem: '',
    quantity: '',
    expiryHours: 4,
    address: ''
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);
      setToken(storedToken);
      setIsAuthenticated(true);
      setActiveTab('dashboard');
    }
  }, []);

  useEffect(() => {
    fetchFoodPosts();

    socket.on('new_food_available', (newPost) => {
      setFoodPosts((prev) => [newPost, ...prev]);
    });

    socket.on('food_status_updated', (updatedPost) => {
      setFoodPosts((prev) =>
        prev.map((post) => (post._id === updatedPost._id ? updatedPost : post))
      );
    });

    socket.on('food_post_deleted', ({ id }) => {
      setFoodPosts((prev) => prev.filter((post) => post._id !== id));
    });

    return () => {
      socket.off('new_food_available');
      socket.off('food_status_updated');
      socket.off('food_post_deleted');
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && !previewCoords) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setPreviewCoords([latitude, longitude]);
          },
          (error) => {
            console.warn('GPS access denied:', error);
          }
        );
      }
    }
  }, [isAuthenticated, previewCoords]);

  const getInitialCenter = () => {
    if (ngoCoords) return ngoCoords;
    if (previewCoords) return previewCoords;

    if (foodPosts.length > 0) {
      const latestPost = foodPosts[0];
      const lat = Number(latestPost.location?.coordinates?.[1] ?? latestPost.latitude);
      const lng = Number(latestPost.location?.coordinates?.[0] ?? latestPost.longitude);
      if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }

    return [19.7515, 75.7139];
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported');
      return;
    }
    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coords = [latitude, longitude];
        setPreviewCoords(coords);
        
        const fullAddress = await reverseGeocode(latitude, longitude);
        if (fullAddress) {
          setFormData((prev) => ({ ...prev, address: fullAddress }));
        }
        setIsGeocoding(false);
      },
      () => {
        alert('Unable to retrieve location.');
        setIsGeocoding(false);
      }
    );
  };

  useEffect(() => {
    if (!formData.address.trim()) return;

    const timer = setTimeout(async () => {
      setIsGeocoding(true);
      const coords = await geocodeAddress(formData.address);
      if (coords) {
        setPreviewCoords(coords);
      }
      setIsGeocoding(false);
    }, 900);

    return () => clearTimeout(timer);
  }, [formData.address]);

  const handleNgoAddressSearch = async () => {
    if (!ngoLocation.trim()) {
      setSearchFilterQuery('');
      setNgoCoords(null);
      return;
    }
    setIsGeocoding(true);
    setSearchFilterQuery(ngoLocation.trim().toLowerCase());
    
    const coords = await geocodeAddress(ngoLocation);
    if (coords) {
      setNgoCoords(coords);
    } else {
      alert('Could not pinpoint coordinates for typed address, filtering list by text match instead.');
    }
    setIsGeocoding(false);
  };

  const fetchFoodPosts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/food/all');
      if (res.data.success) {
        setFoodPosts(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  const handleAuthSubmit = async (e, isSignupMode) => {
    e.preventDefault();
    const endpoint = isSignupMode ? '/api/auth/signup' : '/api/auth/login';

    try {
      const payload = isSignupMode 
        ? { ...authData, username: authData.name, role: authData.role } 
        : { email: authData.email, password: authData.password };

      const res = await axios.post(`http://localhost:5000${endpoint}`, payload);
      
      if (res.data.success) {
        const backendUser = res.data.user || {};
        const userObj = {
          ...backendUser,
          name: backendUser.name || authData.name || authData.email,
          role: backendUser.role || authData.role
        };

        setCurrentUser(userObj);
        setIsAuthenticated(true);
        setActiveTab('dashboard');

        if (res.data.token) {
          setToken(res.data.token);
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(userObj));
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setToken('');
    setActiveTab('home');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete account (${currentUser?.email}) from database?`)) {
      return;
    }

    try {
      await axios.delete('http://localhost:5000/api/auth/delete-account', {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Account deleted permanently from database.');
      handleLogout();
    } catch (err) {
      alert('Failed to delete account: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    setIsGeocoding(true);

    let coords = previewCoords;
    if (!coords) {
      coords = await geocodeAddress(formData.address);
    }

    if (!coords) {
      alert('Could not locate map coordinates.');
      setIsGeocoding(false);
      return;
    }

    const [lat, lon] = coords;

    try {
      const postPayload = {
        ...formData,
        donorName: formData.donorName || currentUser?.name || 'Food Donor',
        userAccountName: currentUser?.name || authData.name || 'Anonymous',
        createdBy: currentUser?._id || currentUser?.id,
        latitude: lat,
        longitude: lon,
        location: {
          type: 'Point',
          coordinates: [lon, lat]
        }
      };

      const res = await axios.post('http://localhost:5000/api/food/create', postPayload);
      alert('Food listing published!');
      
      const newlyCreatedPost = res.data?.data || {
        ...postPayload,
        _id: Date.now().toString(),
        status: 'Available'
      };

      setFoodPosts((prev) => [newlyCreatedPost, ...prev]);

      setFormData({
        donorName: '',
        donorType: userRole === 'Donor' ? 'Individual' : 'Restaurant',
        foodItem: '',
        quantity: '',
        expiryHours: 4,
        address: ''
      });

      fetchFoodPosts();
    } catch (err) {
      alert('Failed to publish post: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleClaim = async (id) => {
    const ngoName = currentUser?.name || prompt('Enter NGO Name to claim:');
    if (!ngoName) return;

    try {
      await axios.patch(`http://localhost:5000/api/food/claim/${id}`, { ngoName });
      alert('Food post claimed successfully!');
      fetchFoodPosts();
    } catch (err) {
      alert('Failed to claim post: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this listing?')) return;

    try {
      await axios.delete(`http://localhost:5000/api/food/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Post deleted!');
      fetchFoodPosts();
    } catch (err) {
      alert('Failed to delete post: ' + (err.response?.data?.message || err.message));
    }
  };

  const userRole = currentUser?.role || authData.role;
  const isNGO = userRole === 'NGO';
  const isAdmin = userRole === 'Admin';
  const isFoodProvider = userRole === 'Restaurant' || userRole === 'Donor' || userRole === 'User';

  const displayedPosts = useMemo(() => {
    if (!searchFilterQuery) return foodPosts;
    return foodPosts.filter((post) => {
      const addr = (post.address || '').toLowerCase();
      const item = (post.foodItem || '').toLowerCase();
      const donor = (post.donorName || '').toLowerCase();
      return addr.includes(searchFilterQuery) || item.includes(searchFilterQuery) || donor.includes(searchFilterQuery);
    });
  }, [foodPosts, searchFilterQuery]);

  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans text-emerald-950 bg-emerald-50/20">
      
      {/* GLOBAL NAVIGATION HEADER */}
      <header className="sticky top-0 z-50 border-b shadow-xs bg-white/90 backdrop-blur-md border-emerald-100">
        <div className="flex items-center justify-between px-6 py-4 mx-auto max-w-7xl">
          <div 
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => setActiveTab('home')}
          >
            <img src={logo} alt="Surplus Food Portal Logo" className="object-contain w-8 h-8 rounded-full" />
            <h1 className="text-xl font-black tracking-tight text-emerald-700">Surplus Food Portal</h1>
          </div>

          <nav className="flex items-center gap-8 text-sm font-semibold text-emerald-900">
            <button 
              onClick={() => scrollToSection('home')}
              className={`hover:text-emerald-600 transition-colors ${activeTab === 'home' ? 'text-emerald-600' : ''}`}
            >
              Home
            </button>
            <button 
              onClick={() => scrollToSection('about')}
              className={`hover:text-emerald-600 transition-colors ${activeTab === 'about' ? 'text-emerald-600' : ''}`}
            >
              About
            </button>
            <button 
              onClick={() => scrollToSection('how-it-works')}
              className={`hover:text-emerald-600 transition-colors ${activeTab === 'how-it-works' ? 'text-emerald-600' : ''}`}
            >
              How It Works
            </button>
            <button 
              onClick={() => scrollToSection('impact')}
              className={`hover:text-emerald-600 transition-colors ${activeTab === 'impact' ? 'text-emerald-600' : ''}`}
            >
              Impact
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-3 pl-4 border-l border-emerald-200">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Delete Account
                </button>
                <button 
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors border rounded-lg border-emerald-300 hover:bg-emerald-50"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 pl-4 border-l border-emerald-200">
                <button 
                  onClick={() => setActiveTab('login')}
                  className="px-4 py-2 text-xs font-bold transition-colors rounded-full text-emerald-800 hover:bg-emerald-100"
                >
                  Login
                </button>
                <button 
                  onClick={() => setActiveTab('signup')}
                  className="px-5 py-2 text-xs font-bold text-white transition-all rounded-full shadow-md bg-emerald-700 hover:bg-emerald-800"
                >
                  Register
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* BODY CONTENT CONTAINER */}
      <main className="flex-1">

        {/* 1. HOME & LANDING SECTIONS */}
        {(activeTab === 'home' || activeTab === 'about' || activeTab === 'how-it-works' || activeTab === 'impact') && (
          <div>
            {/* HERO BANNER */}
            <section id="home" className="relative flex items-center justify-center min-h-[580px] px-6 py-24 text-center text-white bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(10, 40, 25, 0.78), rgba(10, 40, 25, 0.78)), url('https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=1600&auto=format&fit=crop')` }}>
              <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                
                {/* PILL BADGE */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-emerald-200 text-xs font-semibold tracking-wide">
                  <span>🌱</span> Reduce Food Waste • Feed Communities
                </div>

                {/* MAIN HEADLINE */}
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl drop-shadow-md">
                  Give Surplus Food <br />
                  <span className="text-emerald-300">Give Hope.</span>
                </h1>

                {/* SUBTITLE */}
                <p className="max-w-xl mx-auto text-sm leading-relaxed text-emerald-100/90 md:text-base">
                  Surplus Food Portal connects restaurants, hotels, events, households and food donors with NGOs to redistribute surplus food to people who need it.
                </p>

                {/* CALL TO ACTION BUTTONS */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                  <button 
                    onClick={() => setActiveTab(isAuthenticated ? 'dashboard' : 'signup')}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white transition-transform rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 hover:scale-105"
                  >
                    🍲 Donate Food
                  </button>
                  <button 
                    onClick={() => setActiveTab(isAuthenticated ? 'dashboard' : 'signup')}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-900 transition-transform bg-white rounded-full shadow-lg hover:bg-gray-100 hover:scale-105"
                  >
                    🤝 Join as NGO
                  </button>
                </div>

                {/* HERO STATS */}
                <div className="flex justify-center gap-12 pt-8 text-left border-t border-white/10">
                  <div>
                    <h3 className="text-2xl font-black text-white">5,000+</h3>
                    <p className="text-xs text-emerald-200/80">Meals Saved</p>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">250+</h3>
                    <p className="text-xs text-emerald-200/80">Donors</p>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">80+</h3>
                    <p className="text-xs text-emerald-200/80">NGOs</p>
                  </div>
                </div>

              </div>
            </section>

            {/* ABOUT SECTION */}
            <section id="about" className="px-6 py-20 bg-emerald-50/40">
              <div className="max-w-6xl mx-auto space-y-12 text-center">
                <div className="space-y-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-700">ABOUT SURPLUS FOOD PORTAL</span>
                  <h2 className="text-3xl font-black text-emerald-950 md:text-4xl">
                    Turning Surplus Food Into <span className="text-emerald-700">Social Impact</span>
                  </h2>
                  <p className="max-w-2xl mx-auto text-xs text-gray-600 md:text-sm">
                    Every day, large quantities of perfectly edible food are wasted while many communities struggle with food insecurity.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col items-center p-8 space-y-3 text-center bg-white border shadow-xs rounded-3xl hover:shadow-md border-emerald-100/50">
                    <div className="flex items-center justify-center w-12 h-12 text-xl rounded-full bg-emerald-100/80">🍽️</div>
                    <h3 className="text-base font-extrabold text-emerald-950">Food Donors</h3>
                    <p className="text-xs leading-relaxed text-gray-500">
                      Restaurants, hotels, events, households and businesses can easily list their surplus food.
                    </p>
                  </div>

                  <div className="flex flex-col items-center p-8 space-y-3 text-center bg-white border shadow-xs rounded-3xl hover:shadow-md border-emerald-100/50">
                    <div className="flex items-center justify-center w-12 h-12 text-xl rounded-full bg-emerald-100/80">🤝</div>
                    <h3 className="text-base font-extrabold text-emerald-950">NGO Partners</h3>
                    <p className="text-xs leading-relaxed text-gray-500">
                      Verified NGOs can discover available food donations near their location.
                    </p>
                  </div>

                  <div className="flex flex-col items-center p-8 space-y-3 text-center bg-white border shadow-xs rounded-3xl hover:shadow-md border-emerald-100/50">
                    <div className="flex items-center justify-center w-12 h-12 text-xl rounded-full bg-emerald-100/80">🚚</div>
                    <h3 className="text-base font-extrabold text-emerald-950">Smart Distribution</h3>
                    <p className="text-xs leading-relaxed text-gray-500">
                      Connect donations with nearby NGOs and coordinate fast pickup and delivery.
                    </p>
                  </div>

                  <div className="flex flex-col items-center p-8 space-y-3 text-center bg-white border shadow-xs rounded-3xl hover:shadow-md border-emerald-100/50">
                    <div className="flex items-center justify-center w-12 h-12 text-xl rounded-full bg-emerald-100/80">🌱</div>
                    <h3 className="text-base font-extrabold text-emerald-950">Reduce Waste</h3>
                    <p className="text-xs leading-relaxed text-gray-500">
                      Reduce food waste and contribute to a healthier, more sustainable environment.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section id="how-it-works" className="px-6 py-20 bg-emerald-100/30">
              <div className="max-w-6xl mx-auto space-y-12 text-center">
                <div className="space-y-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-700">HOW IT WORKS</span>
                  <h2 className="text-3xl font-black text-emerald-950 md:text-4xl">
                    Simple. Fast. <span className="text-emerald-700">Impactful.</span>
                  </h2>
                </div>

                <div className="relative grid grid-cols-1 gap-8 md:grid-cols-4">
                  <div className="relative flex flex-col items-center space-y-3">
                    <div className="z-10 flex items-center justify-center w-12 h-12 text-lg font-bold text-white rounded-full shadow-md bg-emerald-800">1</div>
                    <h3 className="text-base font-extrabold text-emerald-950">Donate Food</h3>
                    <p className="max-w-xs text-xs leading-relaxed text-gray-600">
                      Donor enters food details, quantity, pickup time and location.
                    </p>
                  </div>

                  <div className="relative flex flex-col items-center space-y-3">
                    <div className="z-10 flex items-center justify-center w-12 h-12 text-lg font-bold text-white rounded-full shadow-md bg-emerald-800">2</div>
                    <h3 className="text-base font-extrabold text-emerald-950">NGO Finds Donation</h3>
                    <p className="max-w-xs text-xs leading-relaxed text-gray-600">
                      Nearby verified NGOs receive notifications about available food.
                    </p>
                  </div>

                  <div className="relative flex flex-col items-center space-y-3">
                    <div className="z-10 flex items-center justify-center w-12 h-12 text-lg font-bold text-white rounded-full shadow-md bg-emerald-800">3</div>
                    <h3 className="text-base font-extrabold text-emerald-950">Pickup</h3>
                    <p className="max-w-xs text-xs leading-relaxed text-gray-600">
                      NGO accepts the donation and coordinates pickup from the donor.
                    </p>
                  </div>

                  <div className="relative flex flex-col items-center space-y-3">
                    <div className="z-10 flex items-center justify-center w-12 h-12 text-lg font-bold text-white rounded-full shadow-md bg-emerald-800">4</div>
                    <h3 className="text-base font-extrabold text-emerald-950">Food Reaches People</h3>
                    <p className="max-w-xs text-xs leading-relaxed text-gray-600">
                      Surplus food is distributed to people and communities in need.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* IMPACT SECTION */}
            <section id="impact" className="px-6 py-20 bg-white">
              <div className="max-w-6xl mx-auto space-y-12 text-center">
                <div className="space-y-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-700">OUR IMPACT</span>
                  <h2 className="text-3xl font-black text-emerald-950 md:text-4xl">
                    Together We Can Make A <span className="text-emerald-700">Difference</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col items-center justify-center p-8 space-y-2 border bg-emerald-50/60 rounded-3xl border-emerald-100/50">
                    <span className="text-3xl">🍱</span>
                    <h3 className="text-2xl font-black text-emerald-950">25,000+</h3>
                    <p className="text-xs font-medium text-gray-500">Meals Redistributed</p>
                  </div>

                  <div className="flex flex-col items-center justify-center p-8 space-y-2 border bg-emerald-50/60 rounded-3xl border-emerald-100/50">
                    <span className="text-3xl">🏢</span>
                    <h3 className="text-2xl font-black text-emerald-950">250+</h3>
                    <p className="text-xs font-medium text-gray-500">Food Donors</p>
                  </div>

                  <div className="flex flex-col items-center justify-center p-8 space-y-2 border bg-emerald-50/60 rounded-3xl border-emerald-100/50">
                    <span className="text-3xl">🤝</span>
                    <h3 className="text-2xl font-black text-emerald-950">80+</h3>
                    <p className="text-xs font-medium text-gray-500">NGO Partners</p>
                  </div>

                  <div className="flex flex-col items-center justify-center p-8 space-y-2 border bg-emerald-50/60 rounded-3xl border-emerald-100/50">
                    <span className="text-3xl">🌍</span>
                    <h3 className="text-2xl font-black text-emerald-950">10,000+</h3>
                    <p className="text-xs font-medium text-gray-500">Kg Food Saved</p>
                  </div>
                </div>
              </div>
            </section>

            {/* CALLOUT SECTION */}
            <section className="px-6 py-16 text-center text-white bg-emerald-900">
              <div className="max-w-3xl mx-auto space-y-4">
                <h2 className="text-3xl font-black md:text-4xl">Ready to Make an Impact?</h2>
                <p className="text-xs text-emerald-200/90 md:text-sm">
                  Join Surplus Food Portal and help turn surplus food into meaningful meals.
                </p>
                <div className="pt-2">
                  <button 
                    onClick={() => setActiveTab(isAuthenticated ? 'dashboard' : 'signup')}
                    className="px-8 py-3 text-xs font-bold text-white transition-all rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 hover:scale-105"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 2. LOGIN / SIGNUP TABS */}
        {(activeTab === 'login' || activeTab === 'signup') && !isAuthenticated && (
          <div className="flex items-center justify-center px-4 py-16 bg-emerald-50/30">
            <div className="w-full max-w-md p-8 bg-white border shadow-xl border-emerald-100 rounded-3xl">
              <div className="flex justify-center mb-3">
                <img src={logo} alt="Surplus Food Portal Logo" className="object-contain w-12 h-12 rounded-full" />
              </div>

              <h2 className="mb-1 text-2xl font-black text-center text-emerald-950">
                {activeTab === 'signup' ? 'Create an Account' : 'Welcome Back'}
              </h2>
              <p className="mb-6 text-xs text-center text-gray-500">
                {activeTab === 'signup' ? 'Join as a Donor, Restaurant, or NGO' : 'Sign in to access surplus food portal'}
              </p>

              <form onSubmit={(e) => handleAuthSubmit(e, activeTab === 'signup')} className="space-y-4">
                {activeTab === 'signup' && (
                  <input
                    type="text"
                    placeholder="Full / Entity Name"
                    value={authData.name}
                    onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                    className="w-full p-3 text-sm border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                )}

                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Select Role</label>
                  <select
                    value={authData.role}
                    onChange={(e) => setAuthData({ ...authData, role: e.target.value })}
                    className="w-full p-3 text-sm bg-white border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Donor">Individual / Food Donor</option>
                    <option value="NGO">NGO Organization</option>
                  </select>
                </div>

                <input
                  type="email"
                  placeholder="Email Address"
                  value={authData.email}
                  onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                  className="w-full p-3 text-sm border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={authData.password}
                  onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                  className="w-full p-3 text-sm border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                  required
                />

                <button
                  type="submit"
                  className="w-full py-3 text-sm font-bold text-white transition-colors bg-emerald-700 hover:bg-emerald-800 rounded-xl"
                >
                  {activeTab === 'signup' ? 'Register Account' : 'Sign In'}
                </button>
              </form>

              <p className="mt-4 text-xs text-center text-gray-500">
                {activeTab === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  onClick={() => setActiveTab(activeTab === 'signup' ? 'login' : 'signup')}
                  className="font-bold text-emerald-700 hover:underline"
                >
                  {activeTab === 'signup' ? 'Sign In' : 'Register Now'}
                </button>
              </p>
            </div>
          </div>
        )}

        {/* 3. DASHBOARD */}
        {activeTab === 'dashboard' && isAuthenticated && (
          <div className="p-6 mx-auto space-y-6 max-w-7xl">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              
              {/* LEFT SIDEBAR: CREATION FORM / CONTROLS */}
              <div className="space-y-6 lg:col-span-1">
                {isFoodProvider && (
                  <div className="p-6 bg-white border shadow-sm border-emerald-100 rounded-3xl">
                    <h3 className="mb-4 text-lg font-black text-emerald-950">Publish Surplus Food</h3>
                    <form onSubmit={handlePostSubmit} className="space-y-3">
                      <div>
                        <select
                          name="donorType"
                          value={formData.donorType}
                          onChange={handleInputChange}
                          className="w-full p-3 text-xs font-semibold text-gray-700 bg-white border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="Restaurant">Restaurant</option>
                          <option value="Individual">Individual Donor</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          name="donorName"
                          placeholder="Donor / Restaurant Name"
                          value={formData.donorName}
                          onChange={handleInputChange}
                          className="w-full p-3 text-xs border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          name="foodItem"
                          placeholder="Food Item Description"
                          value={formData.foodItem}
                          onChange={handleInputChange}
                          className="w-full p-3 text-xs border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          name="quantity"
                          placeholder="Quantity (e.g. 5 kg / 10 meals)"
                          value={formData.quantity}
                          onChange={handleInputChange}
                          className="w-full p-3 text-xs border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                        <input
                          type="number"
                          name="expiryHours"
                          placeholder="Shelf Life (Hours)"
                          value={formData.expiryHours}
                          onChange={handleInputChange}
                          className="w-full p-3 text-xs border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          name="address"
                          placeholder="Pickup Address (e.g. Area, City)"
                          value={formData.address}
                          onChange={handleInputChange}
                          className="w-full p-3 text-xs border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleGetCurrentLocation}
                        className="w-full py-2 text-xs font-semibold transition-colors text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl"
                      >
                        📍 Use Current Location
                      </button>

                      <button
                        type="submit"
                        disabled={isGeocoding}
                        className="w-full py-3 text-xs font-bold text-white transition-all bg-emerald-700 hover:bg-emerald-800 rounded-xl"
                      >
                        {isGeocoding ? 'Locating...' : 'Publish Listing'}
                      </button>
                    </form>
                  </div>
                )}

                {isNGO && (
                  <div className="p-6 space-y-3 bg-white border shadow-sm border-emerald-100 rounded-3xl">
                    <h3 className="text-lg font-black text-emerald-950">Search Area</h3>
                    <input
                      type="text"
                      placeholder="Enter Area / City"
                      value={ngoLocation}
                      onChange={(e) => setNgoLocation(e.target.value)}
                      className="w-full p-3 text-xs border border-gray-200 outline-none rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleNgoAddressSearch}
                      className="w-full py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl"
                    >
                      Search Nearby Listings
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT CONTENT: MAP & LISTINGS */}
              <div className="space-y-6 lg:col-span-2">
                {/* MAP CONTAINER */}
                <div className="overflow-hidden border shadow-sm h-80 border-emerald-100 rounded-3xl">
                  <MapContainer
                    center={getInitialCenter()}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <MapRecenter center={getInitialCenter()} />
                    <LocationPicker onLocationSelect={(coords) => setPreviewCoords(coords)} />

                    {previewCoords && (
                      <DraggableMarker
                        position={previewCoords}
                        setPosition={setPreviewCoords}
                        onDragEnd={async (coords) => {
                          const address = await reverseGeocode(coords[0], coords[1]);
                          if (address) {
                            setFormData((prev) => ({ ...prev, address }));
                          }
                        }}
                      />
                    )}

                    {displayedPosts.map((post) => {
                      const lat = Number(post.location?.coordinates?.[1] ?? post.latitude);
                      const lng = Number(post.location?.coordinates?.[0] ?? post.longitude);

                      if (isNaN(lat) || isNaN(lng)) return null;

                      return (
                        <Marker key={post._id} position={[lat, lng]}>
                          <Popup>
                            <div className="p-1 text-xs">
                              <h4 className="font-bold text-emerald-900">{post.foodItem}</h4>
                              <p>Donor: {post.donorName}</p>
                              <p>Quantity: {post.quantity}</p>
                              <p>Status: {post.status}</p>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>

                {/* AVAILABLE LISTINGS */}
                <div className="p-6 bg-white border shadow-sm border-emerald-100 rounded-3xl">
                  <h3 className="mb-4 text-lg font-black text-emerald-950">Available Listings</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {displayedPosts.length === 0 ? (
                      <p className="text-xs text-gray-500">No active food listings found matching search criteria.</p>
                    ) : (
                      displayedPosts.map((listing) => {
                        const currentUserId = currentUser?._id || currentUser?.id;
                        const isOwnPost = currentUserId && listing.createdBy && (currentUserId === listing.createdBy);
                        const canDelete = isAdmin || isOwnPost;

                        return (
                          <div
                            key={listing._id}
                            className="flex flex-col justify-between p-4 bg-white border border-gray-100 shadow-xs rounded-2xl"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="text-sm font-extrabold text-emerald-950">
                                  {listing.foodItem}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                                    listing.status === 'Claimed'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {listing.status || 'Available'}
                                </span>
                              </div>

                              <div className="space-y-1 text-xs text-gray-600">
                                <p><strong>Donor:</strong> {listing.donorName} ({listing.donorType || 'Individual'})</p>
                                <p><strong>Quantity:</strong> {listing.quantity}</p>
                                <p><strong>Shelf Life:</strong> {listing.expiryHours} Hours</p>
                                <p>📍 {listing.address}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100">
                              {/* Claim Action for NGOs */}
                              {isNGO && listing.status !== 'Claimed' && (
                                <button
                                  onClick={() => handleClaim(listing._id)}
                                  className="px-3 py-1 text-xs font-bold text-white transition-colors rounded-lg bg-emerald-700 hover:bg-emerald-800"
                                >
                                  Claim
                                </button>
                              )}

                              {/* Delete Button - Shown ONLY to post owner or Admin */}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(listing._id)}
                                  className="px-3 py-1 text-xs font-semibold text-red-600 transition-colors rounded-lg bg-red-50 hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="py-6 border-t bg-emerald-950 text-emerald-100/80 border-emerald-900">
        <div className="flex flex-col items-center justify-center gap-2 px-6 mx-auto text-xs max-w-7xl">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Surplus Food Portal Logo" className="object-contain w-6 h-6 rounded-full" />
            <span className="font-bold text-white">Surplus Food Portal</span>
          </div>
          <p>Connecting surplus food with communities in need.</p>
          <div className="flex gap-4 pt-1 text-[11px] text-emerald-300">
            <button onClick={() => scrollToSection('home')}>Home</button>
            <button onClick={() => scrollToSection('about')}>About</button>
            <button onClick={() => scrollToSection('how-it-works')}>How It Works</button>
            <button onClick={() => scrollToSection('impact')}>Impact</button>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;