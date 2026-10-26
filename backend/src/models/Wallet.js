import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  veBalance: {
    type: Number,
    required: true,
    default: 120, // Default baseline matching the UI design (💎 / 🪙 120 VEs)
    min: [0, 'Balance cannot be negative']
  },
  giftCardBalance: {
    type: Number,
    required: true,
    default: 0, // INR gift card balance
    min: [0, 'Gift card balance cannot be negative']
  }
}, {
  timestamps: true
});

export const Wallet = mongoose.model('Wallet', walletSchema);
