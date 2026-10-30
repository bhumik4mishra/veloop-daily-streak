import React from 'react';
import { Calendar, CheckCircle2, ChevronRight } from 'lucide-react';
import { ASSETS } from '../../assets/index.js';
import styles from './StreakStats.module.css';

export const StreakStats = ({
  currentStreak = 0,
  totalRewards = 7,
  checkedIn = 0,
  nextRewardText = '+5 VEs',
  cycleNumber = 1,
  onOpenCalendar = () => {}
}) => {
  return (
    <div className={styles.statsContainer}>
      <div className={styles.topPillRow}>
        <div className={styles.streakPill}>
          <img
            src={ASSETS.flame}
            alt="Streak Fire"
            style={{ width: '22px', height: '22px', objectFit: 'contain' }}
          />
          <span>{currentStreak} Day Streak</span>
        </div>

        <button
          type="button"
          className={styles.calendarPill}
          onClick={onOpenCalendar}
        >
          <Calendar size={16} />
          <span>Cycle #{cycleNumber} Calendar</span>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className={styles.cardsGrid}>
        {/* Stat 1: Total Rewards */}
        <div className={styles.statCard}>
          <div className={`${styles.iconCircle} ${styles.totalIcon}`}>
            <Calendar size={22} />
          </div>
          <div className={styles.cardText}>
            <span className={styles.statLabel}>Total Rewards</span>
            <span className={styles.statValue}>{totalRewards} Days</span>
          </div>
        </div>

        {/* Stat 2: Checked In */}
        <div className={styles.statCard}>
          <div className={`${styles.iconCircle} ${styles.checkedIcon}`}>
            <CheckCircle2 size={22} />
          </div>
          <div className={styles.cardText}>
            <span className={styles.statLabel}>Checked In</span>
            <span className={styles.statValue}>{checkedIn} of {totalRewards}</span>
          </div>
        </div>

        {/* Stat 3: Next Reward */}
        <div className={styles.statCard}>
          <div className={`${styles.iconCircle} ${styles.nextIcon}`}>
            <img
              src={ASSETS.vesCoin}
              alt="Next Reward Icon"
              style={{ width: '24px', height: '24px', objectFit: 'contain' }}
            />
          </div>
          <div className={styles.cardText}>
            <span className={styles.statLabel}>Next Reward</span>
            <span className={styles.statValue}>{nextRewardText}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreakStats;
