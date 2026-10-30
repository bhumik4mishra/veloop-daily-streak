import React from 'react';
import { ArrowLeft, Gift, User, LogOut } from 'lucide-react';
import { ASSETS } from '../../assets/index.js';
import styles from './StreakHeader.module.css';

export const StreakHeader = ({
  veBalance = 120,
  giftCardBalance = 0,
  user = null,
  onOpenAuth = null,
  onLogout = null,
  onBack = () => {}
}) => {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.leftSection}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            aria-label="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={styles.titleWrapper}>
            <h1 className={styles.pageTitle}>Daily Streak</h1>
            <span className={styles.flameBadge}>
              <img
                src={ASSETS.flame}
                alt="Streak Flame"
                className={styles.coinIcon}
              />
            </span>
          </div>
        </div>

        <div className={styles.walletSection}>
          <div className={`${styles.balancePill} ${styles.vesPill}`} title="VEs Platform Currency Balance">
            <img
              src={ASSETS.vesCoin}
              alt="VEs Coin"
              className={styles.coinIcon}
            />
            <span>{veBalance.toLocaleString()} VEs</span>
          </div>

          <div className={`${styles.balancePill} ${styles.giftPill}`} title="Amazon Gift Card Balance">
            <Gift size={16} />
            <span>₹{giftCardBalance}</span>
          </div>

          {user ? (
            <div
              className={`${styles.balancePill} ${styles.userPill}`}
              title={`Logged in as ${user.username} (${user.email}) - Click to Log Out`}
              onClick={onLogout}
            >
              <User size={15} color="#c4b5fd" />
              <span>{user.username}</span>
              <LogOut size={13} color="#94a3b8" style={{ marginLeft: 2 }} />
            </div>
          ) : onOpenAuth ? (
            <button
              type="button"
              className={`${styles.balancePill} ${styles.authBtn}`}
              onClick={onOpenAuth}
            >
              <User size={15} />
              <span>Sign In</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default StreakHeader;
