# VELoop Rewards — Daily Streak System

Full-Stack MERN Daily Streak & Rewards system for **VELoop Rewards**, featuring backend-authoritative streak calculation, strict server-side timers, tamper-proof claiming, wallet ledger tracking, and an authentic dark-themed responsive UI matching VELoop's official design system.

---

## Architecture Overview

```
React Frontend (Vite + Bootstrap + CSS Modules)
       │
       ▼
Express.js REST API (Node.js)
       │
       ▼
MongoDB Database (Mongoose)
```

- **Frontend**: Presentation and user interaction only. React is never authoritative over streak count, eligibility, or timers.
- **Backend**: Authoritative streak calculations, server-side countdown timers, atomic wallet updates, idempotency, and anti-cheat validation.

---

## Implementation Progress

### Phase 1: Project Setup & Repository Scaffold
- **Monorepo Architecture**: Structured layout matching assignment specification (`frontend/`, `backend/`, `docs/`, `postman/`).
- **Backend**: Express service configured with security headers (`helmet`), CORS, error sanitization, and health check endpoint `GET /api/health`.
- **Frontend**: Vite + React 18 client configured with Bootstrap 5, CSS Modules, Google Fonts (Outfit & Inter), and theme tokens in `variables.css`.
- **Official Assets**: Ingested and organized all official design assets from the VELoop Drive link into `frontend/src/assets/images/`.

### Phase 2: Database Models, Seed & Configuration
- **Mongoose Data Layer**: 8 comprehensive schemas (`User`, `Wallet`, `StreakConfig`, `StreakReward`, `StreakCycle`, `StreakClaim`, `WalletTransaction`, `AuditLog`).
- **Compound Indexes & Constraints**: Unique compound indexes enforcing one claim per cycle day `{ userId: 1, cycleId: 1, day: 1 }` and unique user email/wallet mappings.
- **Idempotent Rewards Seeding**: Exact 7-day reward configuration (Days 1–3: 5, 10, 15 VEs; Days 4–5: ₹1, ₹2 Gift Cards; Day 6: 30 VEs; Day 7: ₹5 Ultimate Gift Card) seeded safely via upserts with zero re-seed modifications.

### Phase 3: Authentication, Authorization & Audit Logging
- **Secure Registration & Login**: Bcrypt password hashing (salt rounds = 10, zero plaintext storage), automatic wallet (120 VEs default) and active StreakCycle initialization.
- **JWT Authentication**: Bearer token signing and verification with anti-tampering protection that strips spoofed `req.body.userId` fields.
- **Rate Limiting & Input Validation**: Brute-force protection (`express-rate-limit`) and schema input sanitation.
- **Security Audit Logging**: Sensitive event tracking (`USER_REGISTER`, `USER_LOGIN`, `USER_LOGIN_FAILED`, `AUTH_UNAUTHORIZED`) with automatic credential redaction.
- **Automated Verification**: End-to-end verification suites (`npm run test:phase2`, `npm run test:phase3`).

### Phase 4: Daily Streak Engine, Timers & Claim Logic
- **Backend-Authoritative Streak Engine**: Full server calculation of streak counters, cycle progression, 24h interval timers, and 24h grace period window logic.
- **Atomic ACID Claim Execution**: MongoDB transactions guaranteeing that `StreakClaim`, `Wallet`, and `WalletTransaction` commit atomically or rollback completely on any failure.
- **Anti-Cheat & Concurrency Protection**: Server-enforced day-skipping defense, idempotency, and double-click collision protection via unique compound indexes and atomic sessions.
- **REST Endpoints**: `GET /api/daily-streak`, `GET /api/daily-streak/status`, `POST /api/daily-streak/claim`, `GET /api/daily-streak/history`, `GET /api/wallet`.
- **Automated Verification**: Comprehensive test suite (`npm run test:phase4`).

### Phase 5: High-Fidelity Frontend UI & State Review
- **Authentic VELoop Design System**: Responsive dark purple theme (`#0a0a14`, `#18132f`, `#8b5cf6`, `#fbbf24`) with official typography (Outfit & Inter) and 3D visual assets.
- **Modular Components**: `StreakHeader` with live dual balances, `HeroBanner`, `StreakStats`, `UltimateReward` (Day 7 VIP Banner), `RewardGrid` with 7 individual `RewardCard` elements, `WhyStreak`, and `TrustFooter`.
- **States & Micro-Interactions**: Loading shimmer skeleton (`StreakSkeleton`), connection error state with retry handler, and interactive celebration toast notifications.
- **Visual State Review Switcher**: Interactive preset bar allowing visual evaluation of all 5 cycle states (Day 1 Available, Day 2 Available, Mid-Streak, Day 7 VIP Available, All 7 Days Claimed).

### Phase 6: Live Frontend-Backend Integration & State Sync
- **Service Layer**: Dedicated Axios API client (`api.js`), authentication service (`authService.js`), and streak service (`streakService.js`) with automatic JWT Bearer injection.
- **Full Backend-Driven Client**: `DailyStreakPage.jsx` connected to live REST endpoints with real-time server-synced countdown timers and automatic unlocking.
- **Live Claim Execution**: Real claim submissions triggering atomic backend transactions, instantaneous wallet ledger balance updates, and card progression.
- **Session Management & Demo Sign-In**: Interactive `AuthModal` supporting login, registration, user session display, and 1-click Quick Demo Sign-In.
- **Automated Integration Suite**: End-to-end integration verification (`npm run test:phase6`) passing 10/10 automated checks.

---

## Quick Start

### 1. Backend Service
```bash
cd backend
npm install
npm run dev
```
API runs on `http://localhost:5000` (Health check: `http://localhost:5000/api/health`).

### 2. Frontend Client
```bash
cd frontend
npm install
npm run dev
```
Application runs on `http://localhost:5173`.
