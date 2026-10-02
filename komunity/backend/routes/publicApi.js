const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const { query } = require('../db');

// Public, key-authenticated REST API (Zapier / external integrations).
// Every route is scoped to the API key's community (req.apiCommunityId).
router.use(apiKeyAuth);

// GET /api/v1/me — identify the community this key belongs to
router.get('/me', async (req, res, next) => {
  try {
    const r = await query('SELECT id, name, slug, member_count FROM communities WHERE id = $1', [req.apiCommunityId]);
    res.json(r.rows[0] || {});
  } catch (err) { next(err); }
});

// GET /api/v1/members — list members
router.get('/members', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const r = await query(
      `SELECT u.id, u.full_name, u.email, cm.role, cm.points, cm.level, cm.status, cm.joined_at
       FROM community_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = $1
       ORDER BY cm.joined_at DESC LIMIT $2 OFFSET $3`,
      [req.apiCommunityId, Math.min(Number(limit), 100), Number(offset)]
    );
    res.json({ data: r.rows });
  } catch (err) { next(err); }
});

// GET /api/v1/posts — list recent posts
router.get('/posts', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const r = await query(
      `SELECT p.id, p.content, p.like_count, p.comment_count, p.created_at,
              u.full_name AS author_name
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.community_id = $1
       ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [req.apiCommunityId, Math.min(Number(limit), 100), Number(offset)]
    );
    res.json({ data: r.rows });
  } catch (err) { next(err); }
});

// GET /api/v1/events — list upcoming events
router.get('/events', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT id, title, description, starts_at, ends_at, rsvp_count, daily_room_url
       FROM events WHERE community_id = $1 AND is_cancelled = FALSE
       ORDER BY starts_at ASC LIMIT 100`,
      [req.apiCommunityId]
    );
    res.json({ data: r.rows });
  } catch (err) { next(err); }
});

module.exports = router;
