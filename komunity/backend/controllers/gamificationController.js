const { query, getClient } = require('../db');

const leaderboard = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT u.id, u.full_name, u.avatar_url, cm.points, cm.level,
              RANK() OVER (ORDER BY cm.points DESC) AS rank
       FROM community_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = $1
       ORDER BY cm.points DESC LIMIT 50`,
      [communityId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

const getPointRules = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM point_rules WHERE community_id = $1', [req.params.communityId]);
    res.json(result.rows);
  } catch (err) { next(err); }
};

const updatePointRules = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const rule of req.body.rules) {
      await client.query(
        `UPDATE point_rules SET points = $1, daily_cap = $2 WHERE community_id = $3 AND action = $4`,
        [rule.points, rule.daily_cap, req.params.communityId, rule.action]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Point rules updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const getBadges = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM badges WHERE community_id = $1 ORDER BY points_required ASC', [req.params.communityId]);
    res.json(result.rows);
  } catch (err) { next(err); }
};

const createBadge = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { name, description, icon_emoji, points_required, level_required } = req.body;
    const result = await query(
      'INSERT INTO badges (community_id, name, description, icon_emoji, points_required, level_required) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [communityId, name, description, icon_emoji, points_required ?? 0, level_required ?? 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

module.exports = { leaderboard, getPointRules, updatePointRules, getBadges, createBadge };
