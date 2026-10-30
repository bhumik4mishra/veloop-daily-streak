import React, { useState } from 'react';
import { X, Lock, Mail, User, Sparkles, ArrowRight } from 'lucide-react';
import authService from '../../services/authService.js';
import styles from './AuthModal.module.css';

export const AuthModal = ({
  isOpen = false,
  onClose = () => {},
  onAuthSuccess = () => {}
}) => {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let result;
      if (tab === 'login') {
        result = await authService.login(email, password);
      } else {
        result = await authService.register(username, email, password);
      }

      setLoading(false);
      onAuthSuccess(result.user);
      onClose();
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.message || err.message || 'Authentication failed. Please check your credentials.';
      setError(msg);
    }
  };

  const handleQuickDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await authService.quickDemoLogin();
      setLoading(false);
      onAuthSuccess(result.user);
      onClose();
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.message || err.message || 'Quick demo login failed.';
      setError(msg);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>
            {tab === 'login' ? 'Sign In to VELoop' : 'Create VELoop Account'}
          </h2>
          <p className={styles.subtitle}>
            {tab === 'login'
              ? 'Connect to access your server-authoritative daily streak & wallet'
              : 'Join today and get your 120 VEs welcome balance automatically'}
          </p>
        </div>

        {/* 1-Click Demo Quick Start Button */}
        <button
          type="button"
          className={styles.demoBtn}
          onClick={handleQuickDemo}
          disabled={loading}
        >
          <Sparkles size={16} />
          <span>{loading ? 'Connecting...' : '1-Click Quick Demo Sign-In'}</span>
        </button>

        <div className={styles.divider}>or continue with email</div>

        {/* Tab switcher */}
        <div className={styles.tabRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'login' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setTab('login');
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'register' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setTab('register');
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {tab === 'register' && (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Username</label>
              <input
                type="text"
                required
                className={styles.input}
                placeholder="e.g. StreakMaster"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Address</label>
            <input
              type="email"
              required
              className={styles.input}
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              required
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            <span>{loading ? 'Processing...' : (tab === 'login' ? 'Sign In' : 'Create Account')}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;

