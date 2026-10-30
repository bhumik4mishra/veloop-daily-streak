import React from 'react';
import styles from './StreakSkeleton.module.css';

export const StreakSkeleton = () => {
  return (
    <div className={styles.skeletonWrapper}>
      {/* Hero Banner Shimmer */}
      <div className={`${styles.shimmer} ${styles.heroSkeleton}`} />

      {/* 3 Stats Cards Shimmer */}
      <div className={styles.statsRow}>
        <div className={`${styles.shimmer} ${styles.statSkeleton}`} />
        <div className={`${styles.shimmer} ${styles.statSkeleton}`} />
        <div className={`${styles.shimmer} ${styles.statSkeleton}`} />
      </div>

      {/* Ultimate Reward Banner Shimmer */}
      <div className={`${styles.shimmer} ${styles.ultimateSkeleton}`} />

      {/* 7 Cards Grid Shimmer */}
      <div className={styles.gridSkeleton}>
        <div className={`${styles.shimmer} ${styles.cardSkeleton}`} />
        <div className={`${styles.shimmer} ${styles.cardSkeleton}`} />
        <div className={`${styles.shimmer} ${styles.cardSkeleton}`} />
        <div className={`${styles.shimmer} ${styles.cardSkeleton}`} />
      </div>

      <div className={styles.gridSkeletonRow2}>
        <div className={`${styles.shimmer} ${styles.cardSkeleton}`} />
        <div className={`${styles.shimmer} ${styles.cardSkeleton}`} />
        <div className={`${styles.shimmer} ${styles.cardSkeleton}`} />
      </div>
    </div>
  );
};

export default StreakSkeleton;
