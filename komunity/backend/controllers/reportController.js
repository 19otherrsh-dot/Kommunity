const { query } = require('../db');

/**
 * Member reports a post or comment for moderator review.
 * POST /api/communities/:communityId/reports  { target_type, target_id, reason }
 */
const createReport = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { target_type, target_id, reason } = req.body;

    if (!['post', 'comment'].includes(target_type)) {
      return res.status(400).json({ error: 'target_type must be "post" or "comment"' });
    }
    if (!target_id) return res.status(400).json({ error: 'target_id is required' });

    // Verify the reported content actually belongs to this community
    let exists;
    if (target_type === 'post') {
      exists = await query('SELECT 1 FROM posts WHERE id = $1 AND community_id = $2', [target_id, communityId]);
    } else {
      exists = await query(
        `SELECT 1 FROM comments c JOIN posts p ON p.id = c.post_id
         WHERE c.id = $1 AND p.community_id = $2`,
        [target_id, communityId]
      );
    }
    if (!exists.rows.length) return res.status(404).json({ error: 'Content not found in this community' });

    const result = await query(
      `INSERT INTO content_reports (community_id, reporter_id, target_type, target_id, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [communityId, req.user.id, target_type, target_id, reason || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

/**
 * Moderator queue: list reports for a community.
 * GET /api/communities/:communityId/reports?status=open
 */
const listReports = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { status = 'open' } = req.query;

    const result = await query(
      `SELECT r.*,
              reporter.full_name AS reporter_name,
              CASE WHEN r.target_type = 'post'
                   THEN (SELECT content FROM posts WHERE id = r.target_id)
                   ELSE (SELECT content FROM comments WHERE id = r.target_id)
              END AS target_content
       FROM content_reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       WHERE r.community_id = $1 AND ($2 = 'all' OR r.status = $2)
       ORDER BY r.created_at DESC`,
      [communityId, status]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Moderator resolves a report. action: 'dismiss' | 'remove_content'
 * PATCH /api/communities/:communityId/reports/:reportId  { action }
 */
const resolveReport = async (req, res, next) => {
  try {
    const { communityId, reportId } = req.params;
    const { action } = req.body;

    const reportRes = await query(
      'SELECT * FROM content_reports WHERE id = $1 AND community_id = $2',
      [reportId, communityId]
    );
    if (!reportRes.rows.length) return res.status(404).json({ error: 'Report not found' });
    const report = reportRes.rows[0];

    if (action === 'remove_content') {
      if (report.target_type === 'post') {
        await query('DELETE FROM posts WHERE id = $1 AND community_id = $2', [report.target_id, communityId]);
      } else {
        // Keep the parent post's comment_count consistent
        const c = await query('SELECT post_id FROM comments WHERE id = $1', [report.target_id]);
        await query('DELETE FROM comments WHERE id = $1', [report.target_id]);
        if (c.rows.length) {
          await query('UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1', [c.rows[0].post_id]);
        }
      }
    }

    const newStatus = action === 'remove_content' ? 'resolved' : 'dismissed';
    await query(
      `UPDATE content_reports SET status = $1, resolved_by = $2, resolved_at = NOW() WHERE id = $3`,
      [newStatus, req.user.id, reportId]
    );

    res.json({ message: `Report ${newStatus}`, status: newStatus });
  } catch (err) {
    next(err);
  }
};

module.exports = { createReport, listReports, resolveReport };
