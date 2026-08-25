import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import API from '../services/api';
import socket from '../services/socket';

// Fix Leaflet's default marker icon paths in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const FoodMap = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default map center (e.g., [Latitude, Longitude])
  const defaultCenter = [20.93, 77.75];

  // 1. Fetch initial food posts
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await API.get('/food/all');
        setPosts(response.data.data);
      } catch (err) {
        console.error('Error fetching food posts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // 2. Listen to Real-time Socket.io Events to update Map Markers
  useEffect(() => {
    // New food post added -> Add new marker
    socket.on('new_food_available', (newPost) => {
      setPosts((prevPosts) => [newPost, ...prevPosts]);
    });

    // Post status updated (e.g. Claimed) -> Update marker info
    socket.on('food_status_updated', (updatedPost) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === updatedPost._id ? updatedPost : post
        )
      );
    });

    // Post deleted -> Remove marker from map
    socket.on('food_post_deleted', ({ id }) => {
      setPosts((prevPosts) => prevPosts.filter((post) => post._id !== id));
    });

    return () => {
      socket.off('new_food_available');
      socket.off('food_status_updated');
      socket.off('food_post_deleted');
    };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Loading Map...</div>;
  }

  return (
    <div className="w-full h-screen p-4">
      <h1 className="mb-4 text-2xl font-bold text-gray-800">
        Live Surplus Food Map
      </h1>

      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-[85vh] rounded-lg shadow-md z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {posts.map((post) => {
          // GeoJSON coordinates array is stored as [longitude, latitude]
          const lat = post.location?.coordinates?.[1];
          const lng = post.location?.coordinates?.[0];

          if (!lat || !lng) return null;

          return (
            <Marker key={post._id} position={[lat, lng]}>
              <Popup>
                <div className="max-w-xs p-1">
                  <h3 className="text-lg font-bold text-gray-800">{post.foodItem}</h3>
                  <p className="text-sm"><strong>Donor:</strong> {post.donorName}</p>
                  <p className="text-sm"><strong>Quantity:</strong> {post.quantity}</p>
                  <p className="mb-2 text-sm"><strong>Status:</strong> 
                    <span className={post.status === 'Available' ? 'text-green-600 font-semibold ml-1' : 'text-yellow-600 font-semibold ml-1'}>
                      {post.status}
                    </span>
                  </p>
                  {post.address && <p className="text-xs text-gray-500">{post.address}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default FoodMap;