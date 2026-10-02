const { query } = require('../db');

const search = async (req, res, next) => {
  try {
    const { q, communitySlug } = req.query;
    if (!q) return res.json({ posts: [], courses: [], members: [] });

    const searchTerm = `%${q}%`;

    let membersQuery = `
      SELECT u.id, u.full_name as title, u.avatar_url as image, 'member' as type, c.slug as community_slug
      FROM users u
      LEFT JOIN community_members cm ON cm.user_id = u.id
      LEFT JOIN communities c ON c.id = cm.community_id
      WHERE u.full_name ILIKE $1
    `;
    let membersParams = [searchTerm];

    if (communitySlug) {
      membersQuery = `
        SELECT u.id, u.full_name as title, u.avatar_url as image, 'member' as type, c.slug as community_slug
        FROM users u
        JOIN community_members cm ON cm.user_id = u.id
        JOIN communities c ON c.id = cm.community_id
        WHERE c.slug = $2 AND u.full_name ILIKE $1
      `;
      membersParams = [searchTerm, communitySlug];
    }

    // Posts use the full-text index (idx_posts_content_fts) and rank by relevance.
    // websearch_to_tsquery parses natural queries safely (quotes, OR, -exclude).
    const postsQuery = communitySlug
      ? `SELECT p.id, LEFT(p.content, 100) as title, u.avatar_url as image, 'post' as type, c.slug as community_slug,
                ts_rank(to_tsvector('english', p.content), websearch_to_tsquery('english', $1)) AS rank
         FROM posts p JOIN users u ON u.id = p.author_id JOIN communities c ON c.id = p.community_id
         WHERE c.slug = $2 AND to_tsvector('english', p.content) @@ websearch_to_tsquery('english', $1)
         ORDER BY rank DESC LIMIT 10`
      : `SELECT p.id, LEFT(p.content, 100) as title, u.avatar_url as image, 'post' as type, c.slug as community_slug,
                ts_rank(to_tsvector('english', p.content), websearch_to_tsquery('english', $1)) AS rank
         FROM posts p JOIN users u ON u.id = p.author_id JOIN communities c ON c.id = p.community_id
         WHERE to_tsvector('english', p.content) @@ websearch_to_tsquery('english', $1)
         ORDER BY rank DESC LIMIT 10`;

    const coursesQuery = communitySlug
      ? `SELECT co.id, co.title, co.thumbnail_url as image, 'course' as type, c.slug as community_slug 
         FROM courses co JOIN communities c ON c.id = co.community_id 
         WHERE c.slug = $2 AND (co.title ILIKE $1 OR co.description ILIKE $1) LIMIT 10`
      : `SELECT co.id, co.title, co.thumbnail_url as image, 'course' as type, c.slug as community_slug 
         FROM courses co JOIN communities c ON c.id = co.community_id 
         WHERE co.title ILIKE $1 OR co.description ILIKE $1 LIMIT 10`;

    const [members, posts, courses] = await Promise.all([
      query(membersQuery + ' LIMIT 10', membersParams),
      query(postsQuery, communitySlug ? [q, communitySlug] : [q]),
      query(coursesQuery, communitySlug ? [searchTerm, communitySlug] : [searchTerm])
    ]);

    res.json({
      members: members.rows,
      posts: posts.rows,
      courses: courses.rows
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { search };
