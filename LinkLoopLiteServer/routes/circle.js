const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const CareCircle = require('../models/CareCircle');
const User = require('../models/User');
const { sendPushToUsers } = require('../jobs/pushNotifications');

const router = express.Router();

// @route   GET /api/circle
router.get('/', auth, async (req, res) => {
  try {
    const members = await CareCircle.find({ ownerId: req.user.userId })
      .populate('memberId', 'name email phone profileEmoji');

    // Auto-clean orphaned records: if memberId was set but the user was deleted,
    // populate returns null. Reset those back to pending so the warrior can re-invite.
    const cleaned = [];
    for (const m of members) {
      if (m.status === 'active' && m.memberId === null) {
        // The member account was deleted — reset to pending so warrior sees it correctly
        m.status = 'pending';
        m.inviteCode = null; // old code was consumed
        await m.save();
      }
      cleaned.push(m);
    }

    res.json(cleaned);
  } catch (err) {
    console.error('Get circle error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/circle/invite
router.post('/invite', auth, async (req, res) => {
  try {
    const { memberName, memberEmoji, relationship, permissions } = req.body;

    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const invitation = new CareCircle({
      ownerId: req.user.userId,
      memberId: null,          // populated when someone joins via the code
      memberName,
      memberEmoji: memberEmoji || '👤',
      relationship,
      permissions,
      inviteCode,
      status: 'pending'
    });

    await invitation.save();

    res.status(201).json({ message: 'Invite created', inviteCode, invitation });
  } catch (err) {
    console.error('Create invite error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/circle/join
router.post('/join', auth, async (req, res) => {
  try {
    const { inviteCode } = req.body;

    const invitation = await CareCircle.findOne({
      inviteCode: inviteCode.toUpperCase(),
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invalid or expired invite code' });
    }

    // Prevent joining your own circle
    if (invitation.ownerId.toString() === req.user.userId) {
      return res.status(400).json({ message: "You can't join your own circle" });
    }

    // Check if already a member of this warrior's circle
    const existingMembership = await CareCircle.findOne({
      ownerId: invitation.ownerId,
      memberId: req.user.userId,
      status: { $in: ['active', 'paused'] }
    });
    if (existingMembership) {
      return res.status(400).json({ message: "You're already in this warrior's circle" });
    }

    invitation.memberId = req.user.userId;
    invitation.status = 'active';
    invitation.inviteCode = null; // consumed — clear so it can't be reused
    await invitation.save();

    // Cross-Circle: determine the user's new role
    // - If they were a warrior with their own data, they become 'hybrid'
    // - If they were already a member or hybrid, stay as-is
    // - Always set activeViewingId to this warrior if they don't have one yet
    const joiningUser = await User.findById(req.user.userId).select('role linkedOwnerId activeViewingId');
    const updates = {};

    if (joiningUser.role === 'warrior') {
      // First time joining any circle — become hybrid (they have their own data AND view others)
      updates.role = 'hybrid';
    } else if (joiningUser.role === 'member' && !joiningUser.linkedOwnerId) {
      // Pure member with no prior link — link them to this warrior
      updates.linkedOwnerId = invitation.ownerId;
    }
    // For members already linked or hybrids, don't change role or linkedOwnerId

    // Set activeViewingId if they don't have one yet
    if (!joiningUser.activeViewingId) {
      updates.activeViewingId = invitation.ownerId;
    }
    // Also maintain backward-compat linkedOwnerId for legacy clients
    if (!joiningUser.linkedOwnerId) {
      updates.linkedOwnerId = invitation.ownerId;
    }

    if (Object.keys(updates).length > 0) {
      await User.findByIdAndUpdate(req.user.userId, updates);
    }

    const owner = await User.findById(invitation.ownerId).select('name profileEmoji');

    // Notify other circle members that someone new joined
    const joiner = await User.findById(req.user.userId).select('name');
    const joinerName = joiner?.name || 'Someone';
    const otherMembers = await CareCircle.find({
      ownerId: invitation.ownerId,
      status: { $in: ['active', 'paused'] },
      memberId: { $ne: req.user.userId },
    }).select('memberId');
    const notifyIds = otherMembers
      .filter(m => m.memberId)
      .map(m => m.memberId.toString());
    // Also notify the warrior (circle owner)
    notifyIds.push(invitation.ownerId.toString());
    if (notifyIds.length > 0) {
      sendPushToUsers(
        notifyIds,
        '∞ New Circle Member',
        `${joinerName} just joined the Care Circle!`,
        { type: 'circle_joined' }
      ).catch(err => console.error('[Push] Circle join notification error:', err));
    }

    res.json({
      message: 'Successfully joined Care Circle',
      owner: { name: owner.name, emoji: owner.profileEmoji }
    });
  } catch (err) {
    console.error('Join circle error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/circle/my-status
// @desc    Member pauses/unpauses their alert notifications for a specific circle
// @access  Private (member/hybrid)
// ⚠️  Must be registered BEFORE the /:id wildcard route below
router.put('/my-status', auth, async (req, res) => {
  try {
    const { paused, ownerId } = req.body;

    // Cross-Circle: if ownerId is specified, pause for that specific circle
    // Otherwise fall back to activeViewingId, then linkedOwnerId (backward compat)
    let query = { memberId: req.user.userId, status: { $in: ['active', 'paused'] } };
    if (ownerId) {
      query.ownerId = ownerId;
    } else {
      const user = await User.findById(req.user.userId).select('activeViewingId linkedOwnerId');
      if (user?.activeViewingId) {
        query.ownerId = user.activeViewingId;
      } else if (user?.linkedOwnerId) {
        query.ownerId = user.linkedOwnerId;
      }
    }

    const membership = await CareCircle.findOne(query);

    if (!membership) {
      return res.status(404).json({ message: 'No active circle membership found' });
    }

    membership.status = paused ? 'paused' : 'active';
    await membership.save();

    res.json({ message: paused ? 'Alerts paused' : 'Alerts resumed', status: membership.status });
  } catch (err) {
    console.error('Pause membership error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/circle/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { permissions, status } = req.body;

    const member = await CareCircle.findOne({ _id: req.params.id, ownerId: req.user.userId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (permissions) member.permissions = { ...member.permissions, ...permissions };
    if (status) member.status = status;
    await member.save();

    res.json({ message: 'Member updated', member });
  } catch (err) {
    console.error('Update circle member error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/circle/my-membership
// @desc    Member gets their membership info — returns ALL circles they belong to
// @access  Private (member/hybrid)
router.get('/my-membership', auth, async (req, res) => {
  try {
    const memberships = await CareCircle.find({
      memberId: req.user.userId,
      status: { $in: ['active', 'paused'] }
    }).populate('ownerId', 'name profileEmoji');

    if (!memberships.length) {
      return res.status(404).json({ message: 'No circle membership found' });
    }

    const user = await User.findById(req.user.userId).select('activeViewingId');

    const circles = memberships.map(m => ({
      id: m._id,
      ownerId: m.ownerId?._id,
      status: m.status,
      relationship: m.relationship,
      permissions: m.permissions,
      warrior: m.ownerId ? {
        name: m.ownerId.name,
        emoji: m.ownerId.profileEmoji,
      } : null,
      isActiveView: user?.activeViewingId?.toString() === m.ownerId?._id?.toString(),
    }));

    // Backward compat: also return the first one as the top-level response
    const primary = circles.find(c => c.isActiveView) || circles[0];
    res.json({
      ...primary,
      circles,  // full list for cross-circle UI
    });
  } catch (err) {
    console.error('Get membership error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/circle/roster
// @desc    Member sees who else is in a warrior's circle (read-only)
// @access  Private (member/hybrid)
router.get('/roster', auth, async (req, res) => {
  try {
    const { resolveViewingContext } = require('../middleware/viewingContext');
    const viewAs = req.query.viewAs || null;
    const ctx = await resolveViewingContext(req.user.userId, viewAs);

    // Only members/hybrids viewing someone else can see a roster
    if (!ctx.isViewingOther) {
      return res.status(403).json({ message: 'Only circle members can view the roster' });
    }

    // Verify they're actually in this warrior's circle
    const membership = await CareCircle.findOne({
      ownerId: ctx.targetUserId,
      memberId: req.user.userId,
      status: { $in: ['active', 'paused'] }
    });
    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this circle' });
    }

    // Fetch the warrior (circle owner) so they appear in the roster
    const owner = await User.findById(ctx.targetUserId).select('name profileEmoji');

    const members = await CareCircle.find({
      ownerId: ctx.targetUserId,
      status: { $in: ['active', 'paused'] },
    }).populate('memberId', 'name profileEmoji');

    // Build roster: warrior first, then all circle members
    const roster = [];

    if (owner) {
      roster.push({
        name: owner.name || 'Warrior',
        emoji: owner.profileEmoji || '💪',
        relationship: 'warrior',
        isYou: false,
        isWarrior: true,
      });
    }

    for (const m of members) {
      roster.push({
        name: m.memberId?.name || m.memberName,
        emoji: m.memberId?.profileEmoji || m.memberEmoji,
        relationship: m.relationship,
        isYou: m.memberId?._id.toString() === req.user.userId,
        isWarrior: false,
      });
    }

    res.json(roster);
  } catch (err) {
    console.error('Get roster error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/circle/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const member = await CareCircle.findOneAndDelete({ _id: req.params.id, ownerId: req.user.userId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // If an actual user was linked, figure out their new role
    if (member.memberId) {
      // Check if they're still in any OTHER circles
      const otherCircles = await CareCircle.find({
        memberId: member.memberId,
        ownerId: { $ne: req.user.userId },
        status: { $in: ['active', 'paused'] }
      });

      const removedUser = await User.findById(member.memberId).select('role activeViewingId linkedOwnerId');
      const updates = {};

      if (otherCircles.length === 0) {
        // No circles left — if hybrid, revert to warrior; if member, revert to warrior
        if (removedUser?.role === 'hybrid' || removedUser?.role === 'member') {
          updates.role = 'warrior';
        }
        updates.linkedOwnerId = null;
        updates.activeViewingId = null;
      } else {
        // Still in other circles — if their activeViewingId was pointing to this warrior, switch to another
        if (removedUser?.activeViewingId?.toString() === req.user.userId) {
          updates.activeViewingId = otherCircles[0].ownerId;
        }
        // If linkedOwnerId pointed to this warrior, update it too (backward compat)
        if (removedUser?.linkedOwnerId?.toString() === req.user.userId) {
          updates.linkedOwnerId = otherCircles[0].ownerId;
        }
        // If they were a pure member and still have circles, stay member
        // If they were hybrid, stay hybrid
      }

      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(member.memberId, updates);
      }

      // Send push notification so the member knows immediately
      const warrior = await User.findById(req.user.userId).select('name');
      const warriorName = warrior?.name || 'Your warrior';
      sendPushToUsers(
        [member.memberId.toString()],
        'Removed from Care Circle',
        `${warriorName} has removed you from their Care Circle. You no longer have access to their glucose data.`,
        { type: 'circle_removed' }
      ).catch(err => console.error('[Push] Circle removal notification error:', err));

      // Notify remaining circle members
      const removedName = removedUser?.name || 'A member';
      const remaining = await CareCircle.find({
        ownerId: req.user.userId,
        status: { $in: ['active', 'paused'] },
        memberId: { $ne: member.memberId },
      }).select('memberId');
      const remainingIds = remaining
        .filter(m => m.memberId)
        .map(m => m.memberId.toString());
      if (remainingIds.length > 0) {
        sendPushToUsers(
          remainingIds,
          '∞ Circle Update',
          `${removedName} has left the Care Circle.`,
          { type: 'circle_left' }
        ).catch(err => console.error('[Push] Circle leave notification error:', err));
      }
    }

    res.json({ message: 'Member removed from Care Circle' });
  } catch (err) {
    console.error('Delete circle member error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/circle/my-circles
// @desc    Returns all circles the user belongs to (for context switcher)
// @access  Private
router.get('/my-circles', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('role activeViewingId name profileEmoji');

    const memberships = await CareCircle.find({
      memberId: req.user.userId,
      status: { $in: ['active', 'paused'] }
    }).populate('ownerId', 'name profileEmoji');

    const circles = memberships.map(m => ({
      circleId: m._id,
      ownerId: m.ownerId?._id,
      warriorName: m.ownerId?.name || 'Unknown',
      warriorEmoji: m.ownerId?.profileEmoji || '💪',
      relationship: m.relationship,
      status: m.status,
      isActiveView: user?.activeViewingId?.toString() === m.ownerId?._id?.toString(),
    }));

    // If the user is a warrior or hybrid, include their own "self" option
    const isSelf = ['warrior', 'hybrid'].includes(user?.role);
    res.json({
      self: isSelf ? {
        userId: req.user.userId,
        name: user.name,
        emoji: user.profileEmoji,
        isActiveView: !user.activeViewingId || user.activeViewingId.toString() === req.user.userId,
      } : null,
      circles,
    });
  } catch (err) {
    console.error('Get my circles error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/circle/switch-context
// @desc    Switch which warrior's data the user is currently viewing
// @access  Private
router.post('/switch-context', auth, async (req, res) => {
  try {
    const { targetId } = req.body;  // null = switch back to own data

    const user = await User.findById(req.user.userId).select('role');

    if (!targetId || targetId === req.user.userId) {
      // Switch to own data (only valid for warriors/hybrids)
      if (!['warrior', 'hybrid'].includes(user?.role)) {
        return res.status(400).json({ message: 'Pure members must view a warrior\'s data' });
      }
      await User.findByIdAndUpdate(req.user.userId, { activeViewingId: null });
      return res.json({ message: 'Switched to own data', activeViewingId: null });
    }

    // Verify the user is actually in this warrior's circle
    const membership = await CareCircle.findOne({
      ownerId: targetId,
      memberId: req.user.userId,
      status: { $in: ['active', 'paused'] }
    });
    if (!membership) {
      return res.status(403).json({ message: 'You are not a member of this warrior\'s circle' });
    }

    await User.findByIdAndUpdate(req.user.userId, { activeViewingId: targetId });

    const target = await User.findById(targetId).select('name profileEmoji');
    res.json({
      message: `Now viewing ${target?.name || 'warrior'}'s data`,
      activeViewingId: targetId,
      targetName: target?.name,
      targetEmoji: target?.profileEmoji,
    });
  } catch (err) {
    console.error('Switch context error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
