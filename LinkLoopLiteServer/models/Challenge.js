const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  // The warrior who created the challenge
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Challenge definition
  title: {
    type: String,
    required: true,
    maxlength: 80
  },
  description: {
    type: String,
    maxlength: 200,
    default: ''
  },
  emoji: {
    type: String,
    default: '🏆'
  },
  // What kind of challenge
  type: {
    type: String,
    enum: ['tir', 'streak', 'logging', 'mood', 'custom'],
    required: true
  },
  // Target values
  target: {
    value: { type: Number, required: true },       // e.g. 70 (for TIR%), 7 (for streak days), 10 (for log count)
    unit: { type: String, default: '%' },           // %, days, readings, entries
  },
  // Duration
  durationDays: {
    type: Number,
    required: true,
    min: 1,
    max: 90
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  // Current progress (updated by the checker)
  progress: {
    current: { type: Number, default: 0 },
    lastChecked: { type: Date, default: null },
    dailyLog: [{ date: String, value: Number }]     // e.g. [{ date: '2026-03-06', value: 82 }]
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'failed', 'cancelled'],
    default: 'active'
  },
  completedAt: {
    type: Date,
    default: null
  },
  // Social — cheers from Care Circle members
  cheers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    emoji: { type: String, default: '🎉' },
    message: { type: String, maxlength: 100, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

challengeSchema.index({ ownerId: 1, status: 1 });
challengeSchema.index({ endDate: 1, status: 1 });

module.exports = mongoose.model('Challenge', challengeSchema);
