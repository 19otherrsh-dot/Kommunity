const jwt = require('jsonwebtoken');
const { query } = require('../db');

/**
 * Middleware: Verifies JWT and attaches user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    // Prefer the httpOnly cookie; fall back to the Authorization header (socket/API clients)
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const token = req.cookies?.access_token || headerToken;
    if (!token) {
      return res.status(401).json({ error: 'Missing authentication' });
    }

    // Check if token is in Redis blocklist
    const { redisClient } = require('../db/redis');
    if (redisClient.isOpen) {
      const isBlocked = await redisClient.get(`blocklist:${token}`);
      if (isBlocked) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query('SELECT id, email, full_name, role, avatar_url, notification_settings FROM users WHERE id = $1', [payload.sub]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware: Verifies user is a member of the community
 * Requires authenticate() to run first and req.params.communityId to be set
 */
const requireMember = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT cm.id, cm.role, cm.level, cm.points, cm.tier_id, cm.status, t.price as tier_price
       FROM community_members cm
       LEFT JOIN community_tiers t ON t.id = cm.tier_id
       WHERE cm.community_id = $1 AND cm.user_id = $2`,
      [communityId, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(403).json({ error: 'You are not a member of this community' });
    }
    const membership = result.rows[0];
    // Pending applicants, banned, and rejected members must not access member-gated resources
    if (membership.status && membership.status !== 'active') {
      const messages = {
        pending: 'Your membership is pending approval',
        banned: 'You have been banned from this community',
        rejected: 'Your application to this community was rejected',
      };
      return res.status(403).json({ error: messages[membership.status] || 'Your membership is not active' });
    }
    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: Verifies user is a moderator or admin of the community
 */
const requireModerator = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT id, role FROM community_members 
       WHERE community_id = $1 AND user_id = $2 AND role IN ('moderator', 'admin')`,
      [communityId, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.membership = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: Verifies user is the community owner (admin)
 */
const requireAdmin = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT id FROM communities WHERE id = $1 AND owner_id = $2`,
      [communityId, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(403).json({ error: 'Only the community owner can perform this action' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, requireMember, requireModerator, requireAdmin };
