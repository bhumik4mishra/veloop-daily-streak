import React from 'react';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import styles from './TrustFooter.module.css';

export const TrustFooter = () => {
  return (
    <footer className={styles.footerContainer}>
      <div className={styles.trustStrip}>
        <div className={styles.leftTrust}>
          <ShieldCheck size={24} className={styles.shieldIcon} />
          <p className={styles.trustText}>
            Official rewards only on <span className={styles.highlightDomain}>VELoopRewards.in</span> | Stay active, stay rewarded!
          </p>
        </div>

        <a
          href="#rewards-terms"
          className={styles.actionLink}
          onClick={(e) => {
            e.preventDefault();
            alert('VELoop Rewards: Daily Streak Terms & Conditions\n\n• Rewards unlock in 24-hour intervals.\n• Each consecutive check-in extends your streak.\n• Day 7 grants the Ultimate Amazon Gift Card.\n• Claims are instantly credited to your wallet ledger.');
          }}
        >
          <span>Reward Terms</span>
          <ChevronRight size={16} />
        </a>
      </div>

      <div className={styles.bottomCopyright}>
        © {new Date().getFullYear()} VELoop Rewards. All rights reserved. Server-authoritative daily check-in engine.
      </div>
    </footer>
  );
};

export default TrustFooter;
