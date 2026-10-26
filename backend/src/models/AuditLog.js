import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  event: {
    type: String,
    required: true,
    enum: [
      'STREAK_CLAIM_REQUEST',
      'STREAK_CLAIM_SUCCESS',
      'STREAK_CLAIM_REJECTED',
      'STREAK_RESET',
      'DUPLICATE_CLAIM',
      'INVALID_CLAIM',
      'USER_REGISTER',
      'USER_LOGIN',
      'USER_LOGIN_FAILED',
      'AUTH_UNAUTHORIZED'
    ],
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
