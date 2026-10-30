import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import streakRoutes from './routes/streak.routes.js';
import { getWallet } from './controllers/streak.controller.js';
import { authenticateUser } from './middleware/auth.middleware.js';

const app = express();

// Security and middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health check endpoint required by Phase 1
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'VELoop Daily Streak API',
    status: 'healthy',
    serverTime: new Date().toISOString()
  });
});

// Authentication routes (Phase 3)
app.use('/api/auth', authRoutes);

// Daily Streak routes (Phase 4)
app.use('/api/daily-streak', streakRoutes);

// Wallet endpoint (Phase 4)
app.get('/api/wallet', authenticateUser, getWallet);

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found`
  });
});

// Centralized error handler
app.use(errorHandler);

export default app;
