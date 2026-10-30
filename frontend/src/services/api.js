import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach JWT Bearer token automatically to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('veloop_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept responses for centralized error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If backend returns 401 Unauthorized, token may be invalid or expired
    if (error.response?.status === 401) {
      console.warn('[API] 401 Unauthorized received. Session expired or invalid.');
    }
    return Promise.reject(error);
  }
);

export default api;

