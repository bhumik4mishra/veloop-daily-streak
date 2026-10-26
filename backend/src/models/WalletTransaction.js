import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  currency: {
    type: String,
    required: true,
    enum: ['VES', 'INR']
  },
  type: {
    type: String,
    required: true,
    enum: ['CREDIT', 'DEBIT'],
    default: 'CREDIT'
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Transaction amount must be greater than zero']
  },
  source: {
    type: String,
    required: true,
    default: 'DAILY_STREAK'
  },
  referenceId: {
    type: String,
    required: true, // e.g. STREAK-XXXXXXXX
    index: true
  },
  streakDay: {
    type: Number,
    required: true,
    min: 1,
    max: 7
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['SUCCESS', 'FAILED'],
    default: 'SUCCESS'
  }
}, {
  timestamps: true
});

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
