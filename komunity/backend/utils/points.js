const { query } = require('../db');

/**
 * Award gamification points to a user for an action.
 * Respects daily caps and auto-levels the user.
 * 
 * Can accept either a pg client (for use inside transactions) or fall back to pool queries.
 * 
 * @param {object} dbClient - A pg client (from getClient()) for transactional use, or null to use pool
 * @param {string} communityId - UUID of the community
 * @param {string} userId - UUID of the user receiving points
 * @param {string} action - 'post', 'comment', 'lesson_complete', 'event_attend', 'like_received'
 * @param {string|null} referenceId - UUID of the related entity (post, lesson, event, etc.)
 */
const awardPoints = async (dbClient, communityId, userId, action, referenceId = null) => {
  const exec = dbClient ? dbClient.query.bind(dbClient) : query;

  const ruleResult = await exec(
    'SELECT points, daily_cap FROM point_rules WHERE community_id = $1 AND action = $2 AND is_active = TRUE',
    [communityId, action]
  );
  if (!ruleResult.rows.length) return 0;

  const { points, daily_cap } = ruleResult.rows[0];

  if (daily_cap) {
    const todayPoints = await exec(
      `SELECT COALESCE(SUM(points), 0) AS total FROM point_transactions
       WHERE community_id = $1 AND user_id = $2 AND action = $3
       AND created_at > NOW() - INTERVAL '1 day'`,
      [communityId, userId, action]
    );
    if (Number(todayPoints.rows[0].total) >= daily_cap) return 0; // Cap reached
  }

  await exec(
    'INSERT INTO point_transactions (community_id, user_id, action, points, reference_id) VALUES ($1, $2, $3, $4, $5)',
    [communityId, userId, action, points, referenceId]
  );

  await exec(
    'UPDATE community_members SET points = points + $1 WHERE community_id = $2 AND user_id = $3',
    [points, communityId, userId]
  );

  // Level-up check (every 100 points = 1 level, capped at 10).
  // RETURNING lets us detect a level increase to notify the member.
  const levelResult = await exec(
    `UPDATE community_members
     SET level = LEAST(FLOOR(points / 100) + 1, 10)
     WHERE community_id = $1 AND user_id = $2
     RETURNING level AS new_level,
               LEAST(FLOOR((points - $3) / 100) + 1, 10) AS old_level`,
    [communityId, userId, points]
  );

  const row = levelResult.rows?.[0];
  if (row && row.new_level > row.old_level) {
    // Lazy require to avoid a circular dependency (notificationController -> db -> points)
    try {
      const { sendNotification } = require('../controllers/notificationController');
      sendNotification({
        userId,
        communityId,
        type: 'level_up',
        title: `You reached Level ${row.new_level}! 🎉`,
        body: 'Keep engaging to climb the leaderboard and unlock more.',
      }).catch(() => {});
    } catch (_) { /* notifications are best-effort */ }
  }

  return points;
};

/**
 * Check and award any badges the user has now qualified for.
 * Should be called after awardPoints.
 */
const checkAndAwardBadges = async (dbClient, communityId, userId) => {
  const exec = dbClient ? dbClient.query.bind(dbClient) : query;

  // Get user's current stats
  const memberResult = await exec(
    'SELECT points, level FROM community_members WHERE community_id = $1 AND user_id = $2',
    [communityId, userId]
  );
  if (!memberResult.rows.length) return [];

  const { points, level } = memberResult.rows[0];

  // Find badges the user qualifies for but hasn't earned yet
  const eligibleBadges = await exec(
    `SELECT b.id, b.name FROM badges b
     WHERE b.community_id = $1
       AND b.points_required <= $2
       AND b.level_required <= $3
       AND b.id NOT IN (
         SELECT badge_id FROM user_badges WHERE user_id = $4
       )`,
    [communityId, points, level, userId]
  );

  const awarded = [];
  for (const badge of eligibleBadges.rows) {
    await exec(
      'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, badge.id]
    );
    awarded.push(badge);
  }

  return awarded;
};

module.exports = { awardPoints, checkAndAwardBadges };
