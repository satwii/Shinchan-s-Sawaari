import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: `${BASE_URL}/api`,
    headers: { 'Content-Type': 'application/json' },
});

// Auto-attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sawaari_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401/403 globally
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
            localStorage.removeItem('sawaari_token');
            localStorage.removeItem('sawaari_user');
            window.location.href = '/';
        }
        return Promise.reject(err);
    }
);

export default api;
