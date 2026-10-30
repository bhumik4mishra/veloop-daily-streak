import React from 'react';
import { ASSETS } from '../../assets/index.js';
import styles from './WhyStreak.module.css';

const BENEFITS = [
  {
    title: 'Stay Active',
    description: 'Log in daily to keep your streak alive and never miss a reward cycle.',
    image: ASSETS.stayActive
  },
  {
    title: 'Bigger Streak',
    description: 'Longer streaks unlock higher tier rewards and faster platform progress.',
    image: ASSETS.biggerStreak
  },
  {
    title: 'Exclusive Rewards',
    description: 'Get special access to Amazon Gift Cards and surprise bonus perks.',
    image: ASSETS.exclusiveReward
  },
  {
    title: 'Instant Credit',
    description: 'All claimed VEs and gift vouchers are credited immediately to your wallet.',
    image: ASSETS.trust
  }
];

export const WhyStreak = () => {
  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Why Maintain Your Streak?</h3>
        <p className={styles.subtitle}>
          Consistent daily check-ins maximize your rewards and unlock exclusive benefits
        </p>
      </div>

      <div className={styles.grid}>
        {BENEFITS.map((item, idx) => (
          <div key={idx} className={styles.benefitCard}>
            <div className={styles.imgBox}>
              <img
                src={item.image}
                alt={item.title}
                className={styles.benefitImg}
              />
            </div>
            <div>
              <div className={styles.cardTitle}>{item.title}</div>
              <p className={styles.cardDesc}>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WhyStreak;
