const express = require('express');
const auth = require('../middleware/auth');
const Challenge = require('../models/Challenge');
const GlucoseReading = require('../models/GlucoseReading');
const MoodEntry = require('../models/MoodEntry');
const CareCircle = require('../models/CareCircle');
const User = require('../models/User');

const router = express.Router();

// ============================================================
// CHALLENGES — Social gamification & goal-setting
// Personal wellness goals. Not medical advice.
// ============================================================

// Challenge templates for quick-create
const CHALLENGE_TEMPLATES = [
  { key: 'tir_70_7d', title: '70% TIR Week', emoji: '🎯', type: 'tir', target: { value: 70, unit: '%' }, durationDays: 7, description: 'Stay above 70% Time in Range for a full week' },
  { key: 'tir_80_7d', title: '80% TIR Week', emoji: '🏆', type: 'tir', target: { value: 80, unit: '%' }, durationDays: 7, description: 'Crush it with 80%+ Time in Range all week' },
  { key: 'streak_7d', title: '7-Day Log Streak', emoji: '🔥', type: 'logging', target: { value: 7, unit: 'days' }, durationDays: 7, description: 'Log at least 1 reading every day for 7 days' },
  { key: 'streak_14d', title: '14-Day Log Streak', emoji: '💎', type: 'logging', target: { value: 14, unit: 'days' }, durationDays: 14, description: 'Two weeks of consistent logging' },
  { key: 'mood_7d', title: 'Mood Check Week', emoji: '😊', type: 'mood', target: { value: 7, unit: 'entries' }, durationDays: 7, description: 'Log your mood every day for a week' },
  { key: 'tir_70_30d', title: '30-Day TIR Challenge', emoji: '⭐', type: 'tir', target: { value: 70, unit: '%' }, durationDays: 30, description: 'Maintain 70%+ TIR for a full month' },
  { key: 'log_100', title: 'Century Logger', emoji: '💯', type: 'logging', target: { value: 100, unit: 'readings' }, durationDays: 30, description: 'Log 100 readings in 30 days' },
];

// @route   GET /api/challenges/templates
// @desc    Get available challenge templates
// @access  Private
router.get('/templates', auth, (req, res) => {
  res.json({ templates: CHALLENGE_TEMPLATES });
});

// @route   GET /api/challenges
// @desc    Get user's challenges (active + recent completed)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { resolveViewingContext } = require('../middleware/viewingContext');
    const ctx = await resolveViewingContext(userId, req.query.viewAs);

    const challenges = await Challenge.find({ ownerId: ctx.targetUserId })
      .sort({ createdAt: -1 })
      .limit(20);

    // Separate active vs completed
    const active = challenges.filter(c => c.status === 'active');
    const completed = challenges.filter(c => c.status === 'completed');
    const failed = challenges.filter(c => c.status === 'failed');

    res.json({
      challenges,
      stats: {
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: challenges.length,
        winRate: (completed.length + failed.length) > 0
          ? Math.round((completed.length / (completed.length + failed.length)) * 100)
          : 0,
      }
    });
  } catch (err) {
    console.error('Get challenges error:', err?.message || err);
    // Return empty instead of 500 so client doesn't crash
    res.json({
      challenges: [],
      stats: { active: 0, completed: 0, failed: 0, total: 0, winRate: 0 }
    });
  }
});

// @route   POST /api/challenges
// @desc    Create a new challenge
// @access  Private (warriors only)
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('role');
    if (user?.role === 'member') {
      return res.status(403).json({ message: 'Only warriors can create challenges' });
    }

    // Check active challenge limit (max 3 active at a time)
    const activeCount = await Challenge.countDocuments({ ownerId: userId, status: 'active' });
    if (activeCount >= 3) {
      return res.status(400).json({ message: 'You can have up to 3 active challenges at a time' });
    }

    const { title, description, emoji, type, target, durationDays } = req.body;

    if (!title || !type || !target?.value || !durationDays) {
      return res.status(400).json({ message: 'Title, type, target, and duration are required' });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const challenge = new Challenge({
      ownerId: userId,
      title: title.slice(0, 80),
      description: (description || '').slice(0, 200),
      emoji: emoji || '🏆',
      type,
      target: { value: target.value, unit: target.unit || '%' },
      durationDays,
      startDate,
      endDate,
      status: 'active',
    });

    await challenge.save();
    res.status(201).json({ challenge });
  } catch (err) {
    console.error('Create challenge error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/check
// @desc    Update challenge progress based on current data
// @access  Private
router.post('/:id/check', auth, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge || challenge.status !== 'active') {
      return res.status(404).json({ message: 'Active challenge not found' });
    }

    const now = new Date();
    const userId = challenge.ownerId;

    // Check if challenge expired
    if (now > challenge.endDate) {
      challenge.status = 'failed';
      await challenge.save();
      return res.json({ challenge, message: 'Challenge time expired' });
    }

    const startDate = challenge.startDate;
    const low = 70, high = 180;

    // Fetch user settings for thresholds
    const user = await User.findById(userId).select('settings');
    const userLow = user?.settings?.lowThreshold || low;
    const userHigh = user?.settings?.highThreshold || high;

    let current = 0;
    let dailyLog = [];

    if (challenge.type === 'tir') {
      // Calculate average daily TIR since challenge start
      const readings = await GlucoseReading.find({
        userId, timestamp: { $gte: startDate }
      }).sort({ timestamp: -1 });

      if (readings.length > 0) {
        // Group by day
        const dayMap = {};
        readings.forEach(r => {
          const day = new Date(r.timestamp).toISOString().split('T')[0];
          if (!dayMap[day]) dayMap[day] = [];
          dayMap[day].push(r.value);
        });

        const dayEntries = Object.entries(dayMap);
        let totalTir = 0;
        dailyLog = dayEntries.map(([date, values]) => {
          const inRange = values.filter(v => v >= userLow && v <= userHigh).length;
          const tir = Math.round((inRange / values.length) * 100);
          totalTir += tir;
          return { date, value: tir };
        });
        current = dayEntries.length > 0 ? Math.round(totalTir / dayEntries.length) : 0;
      }

      if (current >= challenge.target.value) {
        // Need at least durationDays/2 days of data to complete
        const daysWithData = dailyLog.length;
        if (daysWithData >= Math.ceil(challenge.durationDays / 2)) {
          // Check if ALL days meet the target
          const allDaysMeetTarget = dailyLog.every(d => d.value >= challenge.target.value);
          if (allDaysMeetTarget && daysWithData >= challenge.durationDays) {
            challenge.status = 'completed';
            challenge.completedAt = now;
          }
        }
      }
    } else if (challenge.type === 'logging') {
      if (challenge.target.unit === 'days') {
        // Count consecutive days with at least 1 reading
        const readings = await GlucoseReading.find({
          userId, timestamp: { $gte: startDate }
        });
        const daySet = new Set();
        readings.forEach(r => {
          daySet.add(new Date(r.timestamp).toISOString().split('T')[0]);
        });
        current = daySet.size;
        dailyLog = Array.from(daySet).sort().map(date => ({ date, value: 1 }));

        if (current >= challenge.target.value) {
          challenge.status = 'completed';
          challenge.completedAt = now;
        }
      } else {
        // Total reading count
        const count = await GlucoseReading.countDocuments({
          userId, timestamp: { $gte: startDate }
        });
        current = count;
        if (current >= challenge.target.value) {
          challenge.status = 'completed';
          challenge.completedAt = now;
        }
      }
    } else if (challenge.type === 'mood') {
      const count = await MoodEntry.countDocuments({
        userId, timestamp: { $gte: startDate }
      });
      current = count;
      if (current >= challenge.target.value) {
        challenge.status = 'completed';
        challenge.completedAt = now;
      }
    }

    challenge.progress.current = current;
    challenge.progress.lastChecked = now;
    challenge.progress.dailyLog = dailyLog;
    await challenge.save();

    res.json({ challenge });
  } catch (err) {
    console.error('Check challenge error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/challenges/:id/cheer
// @desc    Add a cheer to a challenge (Care Circle members)
// @access  Private
router.post('/:id/cheer', auth, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId).select('name profileEmoji');

    // Check that user is in the warrior's Care Circle (or is the warrior themselves)
    if (challenge.ownerId.toString() !== userId) {
      const inCircle = await CareCircle.findOne({
        ownerId: challenge.ownerId,
        memberId: userId,
        status: 'active'
      });
      if (!inCircle) {
        return res.status(403).json({ message: 'You must be in the Care Circle to cheer' });
      }
    }

    // Max 1 cheer per user per challenge
    const alreadyCheered = challenge.cheers.find(c => c.userId?.toString() === userId);
    if (alreadyCheered) {
      return res.status(400).json({ message: 'You already cheered this challenge!' });
    }

    const { emoji, message } = req.body;
    challenge.cheers.push({
      userId,
      name: user?.name || 'Someone',
      emoji: emoji || '🎉',
      message: (message || '').slice(0, 100),
    });
    await challenge.save();

    res.json({ challenge });
  } catch (err) {
    console.error('Cheer challenge error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/challenges/:id
// @desc    Cancel a challenge
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const challenge = await Challenge.findOne({
      _id: req.params.id,
      ownerId: req.user.userId
    });
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }
    challenge.status = 'cancelled';
    await challenge.save();
    res.json({ message: 'Challenge cancelled' });
  } catch (err) {
    console.error('Delete challenge error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
