/**
 * Cross-Circle Viewing Context Middleware
 * 
 * Resolves which warrior's data to query. Priority:
 *   1. ?viewAs=<warriorId> query param (client context switcher)
 *   2. User.activeViewingId (persisted context from last switch)
 *   3. User.linkedOwnerId (backward compat for legacy single-warrior members)
 *   4. Self (warriors viewing their own data)
 * 
 * Sets: req.viewingContext = { targetUserId, isViewingOther, targetName }
 */

const User = require('../models/User');
const CareCircle = require('../models/CareCircle');

/**
 * Standalone helper — can be called from inside routes without being middleware.
 * Returns { targetUserId, isViewingOther, targetName }
 */
async function resolveViewingContext(userId, viewAsParam = null) {
  const user = await User.findById(userId).select('role linkedOwnerId activeViewingId name');
  if (!user) return { targetUserId: userId, isViewingOther: false, targetName: null };

  // 1. Explicit viewAs query param — validate CareCircle membership
  const candidateId = viewAsParam || (user.activeViewingId?.toString()) || (user.linkedOwnerId?.toString());

  if (candidateId && candidateId !== userId) {
    // Validate: caller must be an active/paused member of that warrior's circle
    const membership = await CareCircle.findOne({
      ownerId: candidateId,
      memberId: userId,
      status: { $in: ['active', 'paused'] }
    });

    if (membership) {
      const target = await User.findById(candidateId).select('name profileEmoji');
      return {
        targetUserId: candidateId,
        isViewingOther: true,
        targetName: target?.name || 'Warrior',
        targetEmoji: target?.profileEmoji || '💪',
      };
    }
    // If membership not found, fall through to self
  }

  // Default: viewing own data
  return {
    targetUserId: userId,
    isViewingOther: false,
    targetName: user.name,
  };
}

/**
 * Express middleware — attaches req.viewingContext
 * Use on any route that needs to know "whose data are we looking at?"
 */
function viewingContextMiddleware(req, res, next) {
  const userId = req.user?.userId;
  if (!userId) return next();

  const viewAs = req.query.viewAs || req.headers['x-view-as'] || null;

  resolveViewingContext(userId, viewAs)
    .then(ctx => {
      req.viewingContext = ctx;
      next();
    })
    .catch(err => {
      console.error('ViewingContext error:', err);
      req.viewingContext = { targetUserId: userId, isViewingOther: false, targetName: null };
      next();
    });
}

module.exports = { resolveViewingContext, viewingContextMiddleware };
