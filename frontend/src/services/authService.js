import api from './api.js';

const TOKEN_KEY = 'veloop_token';
const USER_KEY = 'veloop_user';

export const authService = {
  /**
   * Log in with existing credentials
   */
  async login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.success && res.data?.token) {
      localStorage.setItem(TOKEN_KEY, res.data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    }
    return res.data;
  },

  /**
   * Register a new user account
   */
  async register(username, email, password) {
    const res = await api.post('/auth/register', { username, email, password });
    if (res.data?.success && res.data?.token) {
      localStorage.setItem(TOKEN_KEY, res.data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    }
    return res.data;
  },

  /**
   * Fetch current authenticated user profile
   */
  async getMe() {
    const res = await api.get('/auth/me');
    if (res.data?.success && res.data?.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    }
    return res.data?.user;
  },

  /**
   * Clear local session storage
   */
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Get stored token
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Get stored user profile
   */
  getStoredUser() {
    const stored = localStorage.getItem(USER_KEY);
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  /**
   * Convenience 1-click Demo Login for quick testing & evaluation.
   * Attempts login with standard demo credentials; if not found, registers automatically.
   */
  async quickDemoLogin() {
    const demoEmail = 'streak_demo@veloop.io';
    const demoPassword = 'Password123!';
    const demoUsername = 'StreakTester';

    try {
      const loginRes = await api.post('/auth/login', {
        email: demoEmail,
        password: demoPassword
      });
      if (loginRes.data?.success && loginRes.data?.token) {
        localStorage.setItem(TOKEN_KEY, loginRes.data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(loginRes.data.user));
        return loginRes.data;
      }
    } catch (err) {
      // If user doesn't exist (400 or 401), register them
      if (err.response?.status === 400 || err.response?.status === 401) {
        const regRes = await api.post('/auth/register', {
          username: demoUsername,
          email: demoEmail,
          password: demoPassword
        });
        if (regRes.data?.success && regRes.data?.token) {
          localStorage.setItem(TOKEN_KEY, regRes.data.token);
          localStorage.setItem(USER_KEY, JSON.stringify(regRes.data.user));
          return regRes.data;
        }
      }
      throw err;
    }
  }
};

export default authService;

