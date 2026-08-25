import axios from 'axios';

// Create base instance pointed to your Express backend
const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Interceptor to automatically add JWT token to protected requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;