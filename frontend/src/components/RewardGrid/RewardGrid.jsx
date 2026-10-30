import React from 'react';
import { RewardCard } from './RewardCard.jsx';
import styles from './RewardGrid.module.css';

export const RewardGrid = ({
  cards = [],
  isClaiming = false,
  countdownText = '',
  onClaim = () => {}
}) => {
  // Only show countdown tag on the immediate next locked card (first locked card)
  const nextLockedCard = cards.find((c) => c.status === 'LOCKED');

  // Split into Row 1 (Days 1-4) and Row 2 (Days 5-7) for desktop visual balance
  const rowOne = cards.slice(0, 4);
  const rowTwo = cards.slice(4, 7);

  return (
    <section className={styles.sectionContainer}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>7-Day Streak Rewards</h3>
        <p className={styles.sectionSubtitle}>
          ✦ Come back tomorrow for more rewards! ✦
        </p>
      </div>

      {/* Row 1: Days 1 to 4 */}
      <div className={styles.grid}>
        {rowOne.map((card) => {
          const showTimer = nextLockedCard && card.day === nextLockedCard.day;
          return (
            <RewardCard
              key={card.day}
              card={card}
              isClaiming={isClaiming}
              countdownText={showTimer ? countdownText : ''}
              onClaim={onClaim}
            />
          );
        })}
      </div>

      {/* Row 2: Days 5 to 7 */}
      <div className={`${styles.grid} ${styles.gridRowTwo}`}>
        {rowTwo.map((card) => {
          const showTimer = nextLockedCard && card.day === nextLockedCard.day;
          return (
            <RewardCard
              key={card.day}
              card={card}
              isClaiming={isClaiming}
              countdownText={showTimer ? countdownText : ''}
              onClaim={onClaim}
            />
          );
        })}
      </div>
    </section>
  );
};

export default RewardGrid;
