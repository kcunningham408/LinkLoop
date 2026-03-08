const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const router = express.Router();

// Normalize phone: strip non-digits, ensure 10+ digits
const normalizePhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  // Store last 10 digits with +1 prefix for US
  return '+1' + digits.slice(-10);
};

// Build user response object
const userResponse = (user) => ({
  id: user._id,
  email: user.email || null,
  phone: user.phone || null,
  name: user.name,
  role: user.role,
  linkedOwnerId: user.linkedOwnerId || null,
  activeViewingId: user.activeViewingId || null,
  profileEmoji: user.profileEmoji,
  settings: user.settings,
  createdAt: user.createdAt
});

// @route   POST /api/auth/register
// @desc    Register a new user with email OR phone
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { email, phone, password, name, role } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone number is required' });
    }

    // Normalize phone if provided
    const normalizedPhone = normalizePhone(phone);
    if (phone && !normalizedPhone) {
      return res.status(400).json({ message: 'Invalid phone number — must be at least 10 digits' });
    }

    // Check if user already exists by email or phone
    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingEmail) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
    }
    if (normalizedPhone) {
      const existingPhone = await User.findOne({ phone: normalizedPhone });
      if (existingPhone) {
        return res.status(400).json({ message: 'An account with this phone number already exists' });
      }
    }

    // Create new user
    const userData = {
      password,
      name: name.trim(),
      role: role || 'warrior'
    };
    if (email) userData.email = email.toLowerCase().trim();
    if (normalizedPhone) userData.phone = normalizedPhone;

    const user = new User(userData);
    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: userResponse(user)
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user with email OR phone + password
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone number is required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Find user by email or phone
    let user;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else {
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ message: 'Invalid phone number' });
      }
      user = await User.findOne({ phone: normalizedPhone });
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: userResponse(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Generate a 6-digit reset code (returned in response — in production, email it)
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone number is required' });
    }

    let user;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone) user = await User.findOne({ phone: normalizedPhone });
    }

    if (!user) {
      // Don't reveal if account exists — always return success
      return res.json({ message: 'If an account exists, a reset code has been sent.' });
    }

    // Generate 6-digit code
    const resetCode = crypto.randomInt(100000, 999999).toString();
    user.resetToken = resetCode;
    user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // In production, you'd email/text this code. For now, return it in the response.
    // TODO: Integrate email service (SendGrid, SES, etc.)
    console.log(`[Auth] Password reset code for ${user.email || user.phone}: ${resetCode}`);

    res.json({
      message: 'If an account exists, a reset code has been sent.',
      // Remove this line before production — it's here for dev/testing only
      _devResetCode: process.env.NODE_ENV !== 'production' ? resetCode : undefined,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using the 6-digit code
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, phone, resetCode, newPassword } = req.body;
    if (!resetCode || !newPassword) {
      return res.status(400).json({ message: 'Reset code and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    let user;
    if (email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone) user = await User.findOne({ phone: normalizedPhone });
    }

    if (!user || user.resetToken !== resetCode) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });
    }

    user.password = newPassword; // will be hashed by pre-save hook
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    // Auto-login: return a fresh token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      message: 'Password reset successfully',
      token,
      user: userResponse(user),
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── Apple Watch Pairing ───────────────────────────────────────────

const auth = require('../middleware/auth');

// @route   POST /api/auth/watch-pair
// @desc    Generate a 6-digit code the Watch can use to authenticate
// @access  Private (iPhone sends its JWT)
router.post('/watch-pair', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate a 6-digit numeric code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.watchPairCode = code;
    user.watchPairExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    res.json({ code, expiresIn: 600 });
  } catch (err) {
    console.error('Watch pair error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/watch-claim
// @desc    Watch sends a 6-digit code and receives a JWT
// @access  Public (no auth needed — the code IS the auth)
router.post('/watch-claim', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ message: 'Invalid code' });
    }

    const user = await User.findOne({
      watchPairCode: code,
      watchPairExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired code' });
    }

    // Clear the code so it can't be reused
    user.watchPairCode = null;
    user.watchPairExpiry = null;
    await user.save();

    // Issue a JWT for the Watch (long-lived, same as mobile)
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '90d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        linkedOwnerId: user.linkedOwnerId || null,
        activeViewingId: user.activeViewingId || null,
        lowThreshold: user.settings?.lowThreshold || 70,
        highThreshold: user.settings?.highThreshold || 180,
      }
    });
  } catch (err) {
    console.error('Watch claim error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
