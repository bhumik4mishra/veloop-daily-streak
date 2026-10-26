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
