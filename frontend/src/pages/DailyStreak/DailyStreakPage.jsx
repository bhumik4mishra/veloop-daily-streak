import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, AlertTriangle, RefreshCw, Sparkles, CheckCircle2, Radio, Server, ShieldCheck } from 'lucide-react';
import { StreakHeader } from '../../components/StreakHeader/StreakHeader.jsx';
import { HeroBanner } from '../../components/HeroBanner/HeroBanner.jsx';
import { StreakStats } from '../../components/StreakStats/StreakStats.jsx';
import { UltimateReward } from '../../components/UltimateReward/UltimateReward.jsx';
import { RewardGrid } from '../../components/RewardGrid/RewardGrid.jsx';
import { WhyStreak } from '../../components/WhyStreak/WhyStreak.jsx';
import { TrustFooter } from '../../components/TrustFooter/TrustFooter.jsx';
import { StreakSkeleton } from '../../components/StreakSkeleton/StreakSkeleton.jsx';
import { AuthModal } from '../../components/AuthModal/AuthModal.jsx';
import authService from '../../services/authService.js';
import streakService from '../../services/streakService.js';
import styles from './DailyStreak.module.css';

// 7 Standard Reward Card Blueprints (Fallback & Preset definitions)
const BASE_REWARD_CARDS = [
  { day: 1, title: '+5', subtitle: '5 VEs', rewardType: 'VES', amount: 5, currency: 'VES', badgeText: '', isUltimate: false },
  { day: 2, title: '+10', subtitle: '10 VEs', rewardType: 'VES', amount: 10, currency: 'VES', badgeText: 'Today', isUltimate: false },
  { day: 3, title: '+15', subtitle: '15 VEs', rewardType: 'VES', amount: 15, currency: 'VES', badgeText: '', isUltimate: false },
  { day: 4, title: '₹1', subtitle: 'Amazon Gift Card', rewardType: 'GIFT_CARD', amount: 1, currency: 'INR', badgeText: '', isUltimate: false },
  { day: 5, title: '₹2', subtitle: 'Amazon Gift Card', rewardType: 'GIFT_CARD', amount: 2, currency: 'INR', badgeText: 'Gift Card', isUltimate: false },
  { day: 6, title: '+30', subtitle: '30 VEs', rewardType: 'VES', amount: 30, currency: 'VES', badgeText: 'Coin', isUltimate: false },
  { day: 7, title: '₹5', subtitle: 'Amazon Gift Card', rewardType: 'GIFT_CARD', amount: 5, currency: 'INR', badgeText: 'VIP', isUltimate: true }
];

// Presets for Visual State Evaluation (Phase 5 Review tool)
const PRESETS = {
  DAY_1_AVAILABLE: {
    name: 'Day 1 Available (New User)',
    currentStreak: 0,
    checkedIn: 0,
    nextRewardText: '+5 VEs',
    veBalance: 120,
    giftCardBalance: 0,
    cardStates: ['AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']
  },
  DAY_2_AVAILABLE: {
    name: 'Day 2 Available (Default)',
    currentStreak: 1,
    checkedIn: 1,
    nextRewardText: '+10 VEs',
    veBalance: 125,
    giftCardBalance: 0,
    cardStates: ['CLAIMED', 'AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']
  },
  MID_STREAK: {
    name: 'Mid-Streak (Day 4 Gift Card)',
    currentStreak: 3,
    checkedIn: 3,
    nextRewardText: '₹1 Amazon Card',
    veBalance: 150,
    giftCardBalance: 0,
    cardStates: ['CLAIMED', 'CLAIMED', 'CLAIMED', 'AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED']
  },
  DAY_7_AVAILABLE: {
    name: 'Day 7 VIP Available!',
    currentStreak: 6,
    checkedIn: 6,
    nextRewardText: '₹5 Amazon Card',
    veBalance: 180,
    giftCardBalance: 3,
    cardStates: ['CLAIMED', 'CLAIMED', 'CLAIMED', 'CLAIMED', 'CLAIMED', 'CLAIMED', 'AVAILABLE']
  },
  CYCLE_COMPLETED: {
    name: 'All 7 Days Claimed',
    currentStreak: 7,
    checkedIn: 7,
    nextRewardText: 'Cycle Completed',
    veBalance: 180,
    giftCardBalance: 8,
    cardStates: ['CLAIMED', 'CLAIMED', 'CLAIMED', 'CLAIMED', 'CLAIMED', 'CLAIMED', 'CLAIMED']
  }
};

export const DailyStreakPage = () => {
  // Mode: 'LIVE' (Real backend APIs) or 'PRESET' (Phase 5 visual preview switcher)
  const [dataMode, setDataMode] = useState('LIVE');
  const [selectedPreset, setSelectedPreset] = useState('DAY_2_AVAILABLE');
  const [viewMode, setViewMode] = useState('NORMAL'); // 'NORMAL' | 'LOADING' | 'ERROR'
  const [errorMessage, setErrorMessage] = useState('');

  // Authentication State
  const [currentUser, setCurrentUser] = useState(authService.getStoredUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Live Streak & Wallet State
  const [currentStreak, setCurrentStreak] = useState(0);
  const [checkedIn, setCheckedIn] = useState(0);
  const [totalRewards, setTotalRewards] = useState(7);
  const [cycleNumber, setCycleNumber] = useState(1);
  const [nextRewardText, setNextRewardText] = useState('+5 VEs');
  const [veBalance, setVeBalance] = useState(120);
  const [giftCardBalance, setGiftCardBalance] = useState(0);
  const [cards, setCards] = useState(BASE_REWARD_CARDS.map(c => ({ ...c, status: 'LOCKED' })));
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Interaction State
  const [isClaiming, setIsClaiming] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Trigger temporary notification
  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // Format countdown seconds into readable HH:MM:SS
  const formatCountdown = (secs) => {
    if (!secs || secs <= 0) return '00h 00m 00s';
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}h ${m}m ${s}s`;
  };

  // Synchronize Authoritative Server Dashboard State
  const fetchLiveDashboard = useCallback(async () => {
    setViewMode('LOADING');
    setErrorMessage('');

    try {
      // 1. Ensure user has an active session; auto-demo login if first visit
      let token = authService.getToken();
      if (!token) {
        try {
          const authRes = await authService.quickDemoLogin();
          setCurrentUser(authRes.user);
          token = authService.getToken();
        } catch {
          // If auto-demo fails (e.g. backend unreachable), open AuthModal
          setIsAuthModalOpen(true);
        }
      } else if (!currentUser) {
        try {
          const me = await authService.getMe();
          setCurrentUser(me);
        } catch {
          authService.logout();
          setCurrentUser(null);
        }
      }

      // 2. Fetch authoritative state from backend
      const data = await streakService.getStreakDashboard();
      if (!data) throw new Error('No streak data received from server');

      // 3. Populate live state from backend response
      setCurrentStreak(data.streak?.currentStreak || 0);
      setCheckedIn(data.statistics?.checkedInDays || 0);
      setTotalRewards(data.streak?.totalCycleDays || 7);
      setCycleNumber(data.cycle?.cycleNumber || 1);
      setVeBalance(data.wallet?.veBalance ?? 120);
      setGiftCardBalance(data.wallet?.giftCardBalance ?? 0);
      setSecondsRemaining(data.streak?.nextClaimInSeconds || 0);

      // Determine next reward display text
      const eligibleDay = data.streak?.eligibleDay || 1;
      const nextCard = data.cards?.find((c) => c.day === eligibleDay);
      if (data.streak?.currentStreak >= 7) {
        setNextRewardText('Cycle Completed');
      } else if (nextCard) {
        setNextRewardText(nextCard.rewardType === 'VES' ? `+${nextCard.amount} VEs` : `₹${nextCard.amount} Amazon Card`);
      }

      // Populate cards array directly from authoritative server response
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        setCards(data.cards);
      }

      setViewMode('NORMAL');
    } catch (err) {
      console.error('[DailyStreakPage] Failed to load dashboard:', err);
      const msg = err.response?.data?.message || err.message || 'Unable to connect to VELoop Daily Streak service.';
      setErrorMessage(msg);
      setViewMode('ERROR');
    }
  }, [currentUser]);

  // Load preset data for visual preview
  const applyPresetData = (key) => {
    const preset = PRESETS[key] || PRESETS.DAY_2_AVAILABLE;
    setSelectedPreset(key);
    setCurrentStreak(preset.currentStreak);
    setCheckedIn(preset.checkedIn);
    setNextRewardText(preset.nextRewardText);
    setVeBalance(preset.veBalance);
    setGiftCardBalance(preset.giftCardBalance);
    setCards(BASE_REWARD_CARDS.map((base, idx) => ({
      ...base,
      status: preset.cardStates[idx] || 'LOCKED'
    })));
    setSecondsRemaining(23 * 3600 + 42 * 60 + 15);
    setViewMode('NORMAL');
  };

  // Initial load
  useEffect(() => {
    if (dataMode === 'LIVE') {
      fetchLiveDashboard();
    } else {
      applyPresetData(selectedPreset);
    }
  }, [dataMode, fetchLiveDashboard]);

  // Real-time ticking countdown timer (Server-synced)
  useEffect(() => {
    if (secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // If in LIVE mode and timer hits 0, re-sync with backend to unlock reward
          if (dataMode === 'LIVE') {
            streakService.getStreakStatus()
              .then(() => fetchLiveDashboard())
              .catch(() => {});
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsRemaining, dataMode, fetchLiveDashboard]);

  // Claim Daily Reward (Server-Authoritative in LIVE mode)
  const handleClaimReward = async (day) => {
    const targetCard = cards.find((c) => c.day === day);
    if (!targetCard || targetCard.status !== 'AVAILABLE' || isClaiming) return;

    setIsClaiming(true);

    if (dataMode === 'LIVE') {
      // LIVE BACKEND CLAIM EXECUTION
      try {
        const result = await streakService.claimDailyReward(day);
        setIsClaiming(false);

        if (result.success && result.streakState) {
          const fresh = result.streakState;

          // Update authoritative balances
          setVeBalance(fresh.wallet?.veBalance ?? veBalance);
          setGiftCardBalance(fresh.wallet?.giftCardBalance ?? giftCardBalance);
          setCurrentStreak(fresh.streak?.currentStreak ?? (currentStreak + 1));
          setCheckedIn(fresh.statistics?.checkedInDays ?? (checkedIn + 1));
          setCycleNumber(fresh.cycle?.cycleNumber ?? cycleNumber);
          setSecondsRemaining(fresh.streak?.nextClaimInSeconds || 86400);

          // Update next reward description
          const nextCard = fresh.cards?.find((c) => c.day === fresh.streak?.eligibleDay);
          if (nextCard) {
            setNextRewardText(nextCard.rewardType === 'VES' ? `+${nextCard.amount} VEs` : `₹${nextCard.amount} Amazon Card`);
          }

          // Update cards array
          if (fresh.cards) {
            setCards(fresh.cards);
          }

          // Show celebration toast
          const r = result.claimedReward;
          const rewardLabel = r.rewardType === 'VES' ? `+${r.amount} VEs` : `₹${r.amount} Amazon Gift Card`;
          showToast(`🎉 Day ${day} Claimed! ${rewardLabel} credited to your wallet ledger.`);
        } else {
          showToast(`🎉 ${result.message || 'Reward claimed!'}`);
          fetchLiveDashboard();
        }
      } catch (err) {
        setIsClaiming(false);
        console.error('[DailyStreakPage] Claim error:', err);
        const errMsg = err.response?.data?.message || err.message || 'Failed to claim streak reward.';
        showToast(`⚠️ ${errMsg}`);

        // Re-sync with backend to ensure state consistency
        fetchLiveDashboard();
      }
    } else {
      // PRESET SIMULATION MODE (Phase 5 Fallback)
      setTimeout(() => {
        setIsClaiming(false);
        setCards((prev) =>
          prev.map((c) => (c.day === day ? { ...c, status: 'CLAIMED' } : c))
        );
        setCheckedIn((prev) => prev + 1);
        setCurrentStreak((prev) => prev + 1);

        if (targetCard.rewardType === 'VES') {
          setVeBalance((prev) => prev + targetCard.amount);
          showToast(`🎉 Day ${day} Claimed! +${targetCard.amount} VEs added to your wallet.`);
        } else {
          setGiftCardBalance((prev) => prev + targetCard.amount);
          showToast(`🎉 Day ${day} Claimed! ₹${targetCard.amount} Amazon Gift Card added!`);
        }
      }, 700);
    }
  };

  // Auth success callback
  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setDataMode('LIVE');
    showToast(`👤 Welcome, ${user.username}! Synchronizing streak...`);
    fetchLiveDashboard();
  };

  // Logout callback
  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    showToast('Logged out of session. Click Sign In to connect an account.');
    fetchLiveDashboard();
  };

  return (
    <div className={styles.pageWrapper}>
      {/* Top Source & Review Switcher Bar */}
      <div className={styles.stateBar}>
        <span className={styles.stateBarLabel}>
          <Server size={14} /> Data Source:
        </span>

        {/* Live Backend Mode Toggle */}
        <button
          type="button"
          className={`${styles.previewBtn} ${dataMode === 'LIVE' && viewMode === 'NORMAL' ? styles.liveBtnActive : ''}`}
          onClick={() => {
            setDataMode('LIVE');
            fetchLiveDashboard();
          }}
          title="Connect directly to Express REST API & MongoDB Atlas"
        >
          <span className={styles.liveIndicatorDot} />
          <span style={{ marginLeft: 6 }}>Live Backend API</span>
        </button>

        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 4px' }}>|</span>

        {/* Phase 5 Visual Review Presets */}
        <span className={styles.stateBarLabel}>
          <Eye size={14} /> Presets:
        </span>
        {Object.keys(PRESETS).map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.previewBtn} ${dataMode === 'PRESET' && selectedPreset === key && viewMode === 'NORMAL' ? styles.previewBtnActive : ''}`}
            onClick={() => {
              setDataMode('PRESET');
              applyPresetData(key);
            }}
          >
            {PRESETS[key].name}
          </button>
        ))}

        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 4px' }}>|</span>

        {/* UI States Testing Buttons */}
        <button
          type="button"
          className={`${styles.previewBtn} ${viewMode === 'LOADING' ? styles.previewBtnActive : ''}`}
          onClick={() => setViewMode('LOADING')}
        >
          Skeleton
        </button>

        <button
          type="button"
          className={`${styles.previewBtn} ${viewMode === 'ERROR' ? styles.previewBtnActive : ''}`}
          onClick={() => {
            setErrorMessage('Simulated network error for visual evaluation.');
            setViewMode('ERROR');
          }}
        >
          Error
        </button>
      </div>

      {/* Main App Header with Wallet & User Session Controls */}
      <StreakHeader
        veBalance={veBalance}
        giftCardBalance={giftCardBalance}
        user={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onBack={() => alert('Navigation: Back to VELoop Home')}
      />

      <main className={styles.mainContent}>
        {viewMode === 'LOADING' ? (
          <StreakSkeleton />
        ) : viewMode === 'ERROR' ? (
          <div className={styles.errorContainer}>
            <div className={styles.errorCard}>
              <AlertTriangle size={36} color="#ef4444" />
              <h3 className={styles.errorTitle}>Unable to Load Streak Data</h3>
              <p className={styles.errorText}>
                {errorMessage || "We couldn't connect to the VELoop Rewards streak service. Please verify backend service status and retry."}
              </p>
              <button
                type="button"
                className={styles.retryBtn}
                onClick={fetchLiveDashboard}
              >
                <RefreshCw size={14} />
                <span>Retry Connection</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <HeroBanner />

            {/* Streak Counter & Stats Row */}
            <StreakStats
              currentStreak={currentStreak}
              totalRewards={totalRewards}
              checkedIn={checkedIn}
              nextRewardText={nextRewardText}
              cycleNumber={cycleNumber}
              onOpenCalendar={() => alert(`Streak Cycle Calendar: You are currently on Cycle #${cycleNumber} (Days 1–7).`)}
            />

            {/* Ultimate Reward Banner (Day 7) */}
            <UltimateReward
              day={7}
              amount={5}
              isUnlocked={cards.find((c) => c.day === 7)?.status === 'AVAILABLE'}
              isClaimed={cards.find((c) => c.day === 7)?.status === 'CLAIMED'}
            />

            {/* 7 Daily Reward Cards Grid */}
            <RewardGrid
              cards={cards}
              isClaiming={isClaiming}
              countdownText={formatCountdown(secondsRemaining)}
              onClaim={handleClaimReward}
            />

            {/* Why Maintain Streak Benefits */}
            <WhyStreak />

            {/* Official Trust & Footer Strip */}
            <TrustFooter />
          </>
        )}
      </main>

      {/* Interactive Celebratory & Alert Toast */}
      {toastMessage && (
        <div className={styles.toastNotification}>
          <Sparkles size={20} color="#fbbf24" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{toastMessage}</span>
        </div>
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
};

export default DailyStreakPage;
