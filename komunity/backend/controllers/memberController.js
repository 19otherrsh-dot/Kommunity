const { query, getClient } = require('../db');

const list = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { search, page = 1, limit = 40 } = req.query;
    const offset = (page - 1) * limit;
    const searchFilter = search ? `AND u.full_name ILIKE $3` : '';
    const params = [communityId, limit, ...(search ? [`%${search}%`] : []), offset];

    const result = await query(
      `SELECT u.id, u.full_name, u.avatar_url, u.bio, cm.role, cm.points, cm.level, cm.joined_at
       FROM community_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = $1 ${searchFilter}
       ORDER BY cm.points DESC
       LIMIT $2 OFFSET ${search ? '$4' : '$3'}`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const { communityId, userId } = req.params;
    const result = await query(
      `SELECT u.id, u.full_name, u.avatar_url, u.bio, u.website_url, u.twitter_url, u.linkedin_url,
              cm.role, cm.points, cm.level, cm.joined_at
       FROM community_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = $1 AND cm.user_id = $2`,
      [communityId, userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Member not found' });

    const badges = await query(
      `SELECT b.*, ub.earned_at FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1 AND b.community_id = $2`,
      [userId, communityId]
    );
    res.json({ ...result.rows[0], badges: badges.rows });
  } catch (err) { next(err); }
};

module.exports = { list, get };
