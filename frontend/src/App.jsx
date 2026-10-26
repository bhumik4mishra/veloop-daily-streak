import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Flame, CheckCircle, ShieldCheck } from 'lucide-react';
import './App.css';

function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    axios.get(`${apiUrl}/health`)
      .then(res => {
        setHealthStatus(res.data);
        setLoading(false);
      })
      .catch(err => {
        setHealthStatus({ success: false, message: err.message });
        setLoading(false);
      });
  }, [apiUrl]);

  return (
    <div className="app-container d-flex flex-column justify-content-center align-items-center text-center p-4">
      <div style={{
        maxWidth: '560px',
        width: '100%',
        background: 'rgba(24, 19, 47, 0.85)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '20px',
        padding: '36px 28px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.2)'
      }}>
        <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
          <Flame size={32} color="#fbbf24" />
          <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700 }}>VELoop Rewards</h1>
        </div>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.95rem', marginBottom: '24px' }}>
          Daily Streak & Rewards System — Full-Stack MERN Architecture
        </p>

        <div style={{
          background: 'rgba(10, 10, 20, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '18px',
          textAlign: 'left',
          marginBottom: '20px'
        }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <CheckCircle size={18} color="#10b981" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Phase 1: Environment & Scaffolding</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
            <div>• React + Vite Frontend Initialized</div>
            <div>• Express API Backend Initialized</div>
            <div>• CSS Modules & Bootstrap Configured</div>
            <div>• Official Design Assets Cataloged</div>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '9999px',
          background: loading ? 'rgba(255,255,255,0.05)' : (healthStatus?.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
          border: `1px solid ${loading ? 'rgba(255,255,255,0.1)' : (healthStatus?.success ? '#10b981' : '#ef4444')}`,
          fontSize: '0.85rem'
        }}>
          <ShieldCheck size={16} color={loading ? '#94a3b8' : (healthStatus?.success ? '#10b981' : '#ef4444')} />
          <span>
            {loading ? 'Checking Backend API...' : (healthStatus?.success ? `Backend Live (${healthStatus.service})` : `Backend offline: ${healthStatus?.message}`)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
