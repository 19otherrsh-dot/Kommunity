const { query } = require('../db');

const getDashboardStats = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    
    // Ensure the requester is the owner of the community
    const commCheck = await query('SELECT owner_id, monthly_price FROM communities WHERE id = $1', [communityId]);
    if (!commCheck.rows.length) return res.status(404).json({ error: 'Community not found' });
    if (commCheck.rows[0].owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const monthly_price = commCheck.rows[0].monthly_price;

    // Get basic stats
    const statsResult = await query(
      `SELECT 
        COUNT(*) AS total_members,
        COUNT(*) FILTER (WHERE subscription_status = 'active') AS active_members,
        COUNT(*) FILTER (WHERE subscription_status = 'cancelled') AS churned_members
       FROM community_members 
       WHERE community_id = $1`,
      [communityId]
    );
    
    const stats = statsResult.rows[0];
    const mrr = stats.active_members * monthly_price;

    // Get time-series growth (last 30 days)
    const growthResult = await query(
      `SELECT DATE_TRUNC('day', joined_at) AS date, COUNT(*) AS count
       FROM community_members
       WHERE community_id = $1 AND joined_at >= NOW() - INTERVAL '30 days'
       GROUP BY date
       ORDER BY date ASC`,
      [communityId]
    );

    // Get engagement stats
    const engagementResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM posts WHERE community_id = $1) AS total_posts,
        (SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.community_id = $1) AS total_comments,
        (SELECT COUNT(*) FROM events WHERE community_id = $1) AS total_events
      `, [communityId]
    );

    res.json({
      overview: {
        total_members: parseInt(stats.total_members) || 0,
        active_members: parseInt(stats.active_members) || 0,
        churned_members: parseInt(stats.churned_members) || 0,
        mrr: mrr || 0
      },
      engagement: engagementResult.rows[0],
      growth: growthResult.rows
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardStats };
