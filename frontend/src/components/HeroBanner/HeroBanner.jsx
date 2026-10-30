import React from 'react';
import { Sparkles } from 'lucide-react';
import { ASSETS } from '../../assets/index.js';
import styles from './HeroBanner.module.css';

export const HeroBanner = () => {
  return (
    <div className={styles.heroContainer}>
      <div className={styles.heroCard}>
        <div className={styles.leftIllustration}>
          <img
            src={ASSETS.topLeft}
            alt="Streak Calendar 3D"
            className={styles.heroImg}
          />
        </div>

        <div className={styles.centerContent}>
          <div className={styles.badgePill}>
            <Sparkles size={14} color="#fbbf24" />
            <span>Daily Check-in Rewards</span>
          </div>
          <h2 className={styles.headline}>
            Login Daily & Earn <span className={styles.goldHighlight}>Bigger Rewards!</span>
          </h2>
          <p className={styles.subtitle}>
            Maintain your streak and unlock exciting rewards every day. Build consecutive check-ins to claim the Day 7 Ultimate Prize!
          </p>
        </div>

        <div className={styles.rightIllustration}>
          <img
            src={ASSETS.topRight}
            alt="3D Reward Gift Box"
            className={styles.heroImg}
          />
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
