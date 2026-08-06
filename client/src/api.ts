import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '');

const api = axios.create({
  baseURL: configuredBaseUrl,
});

// Response interceptor to handle expired/invalid tokens
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Dispatch a custom event so App.js can update its state
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export default api;
