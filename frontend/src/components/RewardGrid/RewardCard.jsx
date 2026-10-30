import React from 'react';
import { Lock, Check, ChevronRight, Clock, Sparkles } from 'lucide-react';
import { ASSETS } from '../../assets/index.js';
import styles from './RewardGrid.module.css';

/**
 * Map reward day & type to official asset illustration
 */
const getRewardAsset = (day, rewardType) => {
  if (day === 7) return ASSETS.day7;
  if (day === 5) return ASSETS.day5;
  if (day === 4) return ASSETS.day4;
  return ASSETS.vesCoin;
};

export const RewardCard = ({
  card = {},
  isClaiming = false,
  countdownText = '',
  onClaim = () => {}
}) => {
  const {
    day = 1,
    title = '+5',
    subtitle = '5 VEs',
    rewardType = 'VES',
    amount = 5,
    currency = 'VES',
    badgeText = '',
    isUltimate = false,
    status = 'LOCKED' // 'CLAIMED' | 'AVAILABLE' | 'LOCKED'
  } = card;

  const isAvailable = status === 'AVAILABLE';
  const isClaimed = status === 'CLAIMED';
  const isLocked = status === 'LOCKED';

  // Determine card classes
  let cardClass = styles.card;
  if (isUltimate) cardClass += ` ${styles.cardVip}`;
  else if (isAvailable) cardClass += ` ${styles.cardAvailable}`;
  else if (isClaimed) cardClass += ` ${styles.cardClaimed}`;
  else if (isLocked) cardClass += ` ${styles.cardLocked}`;

  // Asset image
  const assetSource = getRewardAsset(day, rewardType);

  return (
    <div className={cardClass}>
      {/* Top Left Badge */}
      <div className={styles.badgeWrapper}>
        {isClaimed ? (
          <span className={`${styles.pillBadge} ${styles.badgeClaimed}`}>
            <Check size={10} />
            <span>Claimed</span>
          </span>
        ) : isAvailable ? (
          <span className={`${styles.pillBadge} ${styles.badgeToday}`}>
            <Sparkles size={10} />
            <span>Today</span>
          </span>
        ) : isUltimate ? (
          <span className={`${styles.pillBadge} ${styles.badgeVip}`}>
            <span>VIP</span>
          </span>
        ) : badgeText ? (
          <span className={`${styles.pillBadge} ${rewardType === 'GIFT_CARD' ? styles.badgeGift : styles.badgeCoin}`}>
            <span>{badgeText}</span>
          </span>
        ) : null}
      </div>

      {/* Top Right Day Number */}
      <div className={styles.dayLabel}>
        Day {day}
      </div>

      {/* Reward Asset Illustration */}
      <div className={styles.assetBox}>
        <img
          src={assetSource}
          alt={`Day ${day} ${title}`}
          className={styles.assetImg}
        />
      </div>

      {/* Title & Subtitle */}
      <div className={styles.rewardTitle}>{title}</div>
      <div className={styles.rewardSubtitle}>{subtitle}</div>

      {/* Action Button */}
      {isClaimed ? (
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.btnClaimed}`}
          disabled
        >
          <Check size={15} />
          <span>Claimed</span>
        </button>
      ) : isAvailable ? (
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.btnClaimNow}`}
          onClick={() => onClaim(day)}
          disabled={isClaiming}
        >
          <span>{isClaiming ? 'Claiming...' : 'Claim Now'}</span>
          <ChevronRight size={15} />
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.btnLocked}`}
          disabled
        >
          <Lock size={13} />
          <span>Locked</span>
        </button>
      )}

      {/* Optional countdown indicator if locked */}
      {isLocked && countdownText && (
        <div className={styles.countdownTag}>
          <Clock size={11} />
          <span>{countdownText}</span>
        </div>
      )}
    </div>
  );
};

export default RewardCard;
