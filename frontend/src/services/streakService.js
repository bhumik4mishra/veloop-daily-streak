import api from './api.js';

export const streakService = {
  /**
   * Fetch full server-authoritative streak dashboard state
   * Returns: { config, cycle, streak, statistics, cards, ultimateReward, wallet, serverTime }
   */
  async getStreakDashboard() {
    const res = await api.get('/daily-streak');
    return res.data?.data;
  },

  /**
   * Fetch lightweight status for countdown sync and eligibility polling
   * Returns: { serverTime, canClaimToday, nextClaimAt, nextClaimInSeconds, currentStreak, eligibleDay, cycleNumber }
   */
  async getStreakStatus() {
    const res = await api.get('/daily-streak/status');
    return res.data;
  },

  /**
   * Execute atomic daily reward claim
   * @param {number} [day] - Day to claim (validated server-side against authoritative eligibleDay)
   * Returns: { success, message, claimedReward, transaction, streakState }
   */
  async claimDailyReward(day) {
    const payload = day ? { day } : {};
    const res = await api.post('/daily-streak/claim', payload);
    return res.data;
  },

  /**
   * Fetch historical claim ledger and cycle records
   */
  async getStreakHistory() {
    const res = await api.get('/daily-streak/history');
    return res.data?.data;
  },

  /**
   * Fetch current wallet balance and transaction ledger
   */
  async getWallet() {
    const res = await api.get('/daily-streak/wallet');
    return res.data?.data;
  }
};

export default streakService;

