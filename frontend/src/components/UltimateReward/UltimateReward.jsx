import React from 'react';
import { Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import { ASSETS } from '../../assets/index.js';
import styles from './UltimateReward.module.css';

export const UltimateReward = ({
  day = 7,
  amount = 5,
  title = '₹5 Amazon Gift Card',
  isUnlocked = false,
  isClaimed = false
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.ultimateCard}>
        <div className={styles.leftContent}>
          <div className={styles.tagRow}>
            <span className={styles.tag}>✦ Ultimate Reward ✦</span>
            {isClaimed ? (
              <span className={`${styles.lockBadge} ${styles.unlockedBadge}`}>
                <CheckCircle2 size={14} />
                <span>Claimed in Active Cycle</span>
              </span>
            ) : isUnlocked ? (
              <span className={`${styles.lockBadge} ${styles.unlockedBadge}`}>
                <Sparkles size={14} />
                <span>Ready to Claim!</span>
              </span>
            ) : (
              <span className={styles.lockBadge}>
                <Lock size={14} />
                <span>Unlock on Day {day}</span>
              </span>
            )}
          </div>

          <h3 className={styles.title}>
            <span className={styles.amountHighlight}>₹{amount}</span> Amazon Gift Card
          </h3>

          <p className={styles.description}>
            Log in consistently for all 7 days of the cycle to earn the VIP Amazon Gift Card, delivered directly to your wallet!
          </p>
        </div>

        <div className={styles.rightIllustration}>
          <img
            src={ASSETS.day7}
            alt="Day 7 VIP Golden Crown"
            className={styles.crownImg}
          />
        </div>
      </div>
    </div>
  );
};

export default UltimateReward;
