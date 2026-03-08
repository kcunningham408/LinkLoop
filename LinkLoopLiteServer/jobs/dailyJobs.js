/**
 * dailyJobs.js
 * Scheduled tasks that run once per day:
 *   1. Supply countdown — decrement daysLeft, push when low
 *   2. Daily glucose summary — recap to circle members
 *   3. Daily insights push — AI-powered insight to warriors at 7 PM EST
 */

const cron = require('node-cron');
const Groq = require('groq-sdk');
const User = require('../models/User');
const Supply = require('../models/Supply');
const GlucoseReading = require('../models/GlucoseReading');
const CareCircle = require('../models/CareCircle');
const MoodEntry = require('../models/MoodEntry');
const { sendPushToUsers } = require('./pushNotifications');

// ── Supply countdown — runs daily at 8 AM UTC ─────────────────────
async function checkSupplyLevels() {
  console.log('[DailyJobs] Checking supply levels...');
  try {
    // Find all supplies with daysLeft > 0
    const supplies = await Supply.find({ daysLeft: { $gt: 0 } });

    for (const supply of supplies) {
      supply.daysLeft = Math.max(0, supply.daysLeft - 1);
      await supply.save();

      // Notify at 7 days, 3 days, 1 day, and 0 days
      if ([7, 3, 1, 0].includes(supply.daysLeft)) {
        const label = supply.daysLeft === 0
          ? `${supply.emoji || '📦'} ${supply.name} has run out!`
          : `${supply.emoji || '📦'} ${supply.name} — ${supply.daysLeft} day${supply.daysLeft !== 1 ? 's' : ''} left`;

        sendPushToUsers(
          [supply.userId.toString()],
          '📦 Supply Reminder',
          label,
          { type: 'supply_low', supplyId: supply._id.toString() }
        ).catch(err => console.error('[DailyJobs] Supply push error:', err.message));
      }
    }

    console.log(`[DailyJobs] Updated ${supplies.length} supply items.`);
  } catch (err) {
    console.error('[DailyJobs] Supply check error:', err.message);
  }
}

// ── Daily glucose summary — runs daily at 8 PM UTC ────────────────
async function sendDailySummaries() {
  console.log('[DailyJobs] Sending daily summaries...');
  try {
    // Find all warriors who have at least one active circle member
    const activeCircles = await CareCircle.find({ status: 'active' }).select('ownerId memberId');
    const warriorIds = [...new Set(activeCircles.map(c => c.ownerId.toString()))];

    for (const warriorId of warriorIds) {
      const warrior = await User.findById(warriorId).select('name settings');
      if (!warrior) continue;

      // Get today's readings (last 24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const readings = await GlucoseReading.find({
        userId: warriorId,
        timestamp: { $gte: since },
      });

      if (readings.length === 0) continue; // nothing to report

      const values = readings.map(r => r.value);
      const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      const low = warrior.settings?.lowThreshold || 70;
      const high = warrior.settings?.highThreshold || 180;
      const inRange = values.filter(v => v >= low && v <= high).length;
      const tir = Math.round((inRange / values.length) * 100);
      const lowCount = values.filter(v => v < low).length;
      const highCount = values.filter(v => v > high).length;

      const summary = `📊 ${warrior.name}'s Daily Recap: ${tir}% in range, avg ${avg} mg/dL` +
        (lowCount > 0 ? `, ${lowCount} low${lowCount > 1 ? 's' : ''}` : '') +
        (highCount > 0 ? `, ${highCount} high${highCount > 1 ? 's' : ''}` : '') +
        ` (${readings.length} readings)`;

      // Get active circle members for this warrior
      const members = activeCircles
        .filter(c => c.ownerId.toString() === warriorId && c.memberId)
        .map(c => c.memberId.toString());

      // Also send to the warrior themselves
      const notifyIds = [...new Set([warriorId, ...members])];

      sendPushToUsers(
        notifyIds,
        `📊 Daily Recap — ${warrior.name}`,
        summary,
        { type: 'daily_summary' }
      ).catch(err => console.error(`[DailyJobs] Summary push error for ${warriorId}:`, err.message));
    }

    console.log(`[DailyJobs] Sent summaries for ${warriorIds.length} warrior(s).`);
  } catch (err) {
    console.error('[DailyJobs] Daily summary error:', err.message);
  }
}

// ── Start cron jobs ────────────────────────────────────────────────
function startDailyJobs() {
  // Supply countdown — 8 AM UTC (3 AM EST / 12 AM PST)
  cron.schedule('0 8 * * *', checkSupplyLevels);
  console.log('⏱  Supply countdown cron started (daily 8 AM UTC)');

  // Daily summary — 1 AM UTC (8 PM EST / 5 PM PST)
  cron.schedule('0 1 * * *', sendDailySummaries);
  console.log('⏱  Daily summary cron started (daily 1 AM UTC / 8 PM EST)');

  // Daily insights push — runs EVERY HOUR, sends to warriors whose local time is 7 PM
  cron.schedule('0 * * * *', sendDailyInsightsPush);
  console.log('⏱  Daily insights push cron started (hourly — delivers at 7 PM local per user)');
}

// ── Daily insights push — AI-powered evening insight for warriors ──
// Runs every hour. For each warrior, checks if their timezone's local hour is 19 (7 PM).
// This way every warrior gets the notification at 7 PM *their* time, not one fixed UTC offset.
async function sendDailyInsightsPush() {
  const nowUTC = new Date();
  console.log(`[DailyInsights] Hourly check at ${nowUTC.toISOString()}`);

  try {
    // Get Groq client
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'PASTE_YOUR_KEY_HERE') {
      return; // silently skip if not configured
    }
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Find all warriors with a push token and daily insights enabled
    const warriors = await User.find({
      role: 'warrior',
      pushToken: { $ne: null, $exists: true },
      'pushPreferences.dailyInsights': { $ne: false },
    }).select('_id name settings pushToken timezone');

    if (warriors.length === 0) return;

    // Filter to warriors whose local time is currently 7 PM (hour 19)
    const eligibleWarriors = warriors.filter(w => {
      try {
        const tz = w.timezone || 'America/New_York';
        const localHour = parseInt(
          new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(nowUTC)
        );
        return localHour === 19;
      } catch {
        return false; // invalid timezone — skip
      }
    });

    if (eligibleWarriors.length === 0) return;

    console.log(`[DailyInsights] ${eligibleWarriors.length} warrior(s) at 7 PM local — generating insights...`);
    let sentCount = 0;

    for (const warrior of eligibleWarriors) {
      try {
        // Get today's readings (last 24h)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [readings, moodEntries] = await Promise.all([
          GlucoseReading.find({ userId: warrior._id, timestamp: { $gte: since } }).sort({ timestamp: -1 }),
          MoodEntry.find({ userId: warrior._id, timestamp: { $gte: since } }).sort({ timestamp: -1 }).limit(5),
        ]);

        if (readings.length < 2) continue; // need some data

        const values = readings.map(r => r.value);
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        const low = warrior.settings?.lowThreshold || 70;
        const high = warrior.settings?.highThreshold || 180;
        const inRange = values.filter(v => v >= low && v <= high).length;
        const tir = Math.round((inRange / values.length) * 100);
        const lowCount = values.filter(v => v < low).length;
        const highCount = values.filter(v => v > high).length;
        const name = warrior.name || 'there';

        // Build a quick mood context
        let moodContext = '';
        if (moodEntries.length > 0) {
          const moodLabels = { great: 'Great', good: 'Good', okay: 'Okay', tired: 'Tired', stressed: 'Stressed', sick: 'Sick', low_energy: 'Low Energy', anxious: 'Anxious' };
          const lastMood = moodEntries[0];
          moodContext = `\nRecent mood: ${moodLabels[lastMood.label] || lastMood.label} ${lastMood.emoji}${lastMood.note ? ` ("${lastMood.note}")` : ''}`;
        }

        const prompt = `Write a 1-sentence evening glucose recap for ${name}. This will be a push notification so it must be very short — under 120 characters ideally.

DATA (last 24h): ${readings.length} readings, avg ${avg} mg/dL, ${tir}% in range (${low}-${high}), ${lowCount} lows, ${highCount} highs${moodContext}

RULES:
- ONE sentence, conversational and warm
- Reference their actual numbers (TIR% or avg)
- If day was good, celebrate briefly. If tough, be encouraging.
- 1 emoji at start
- NO medical advice, NO suggestions, NO actions
- NO bullet points
- Do NOT mention the app name

Return ONLY the notification text, nothing else.`;

        const completion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: 'You write ultra-short push notification text (1 sentence) for a glucose wellness app. Never give medical advice. Just a warm, data-informed evening recap.' },
            { role: 'user', content: prompt },
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          max_tokens: 80,
        });

        let insightText = completion.choices[0]?.message?.content?.trim();
        if (!insightText) {
          insightText = `📊 Today: ${tir}% in range with an avg of ${avg} mg/dL — nice work, ${name}!`;
        }

        await sendPushToUsers(
          [warrior._id.toString()],
          '✨ Your Daily Insight',
          insightText,
          { type: 'daily_insight' }
        );
        sentCount++;

        // Small delay between API calls to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      } catch (userErr) {
        console.error(`[DailyInsights] Push error for ${warrior._id}:`, userErr.message);
      }
    }

    console.log(`[DailyInsights] Sent insights to ${sentCount}/${eligibleWarriors.length} warrior(s).`);
  } catch (err) {
    console.error('[DailyInsights] Job error:', err.message);
  }
}

module.exports = { startDailyJobs };
