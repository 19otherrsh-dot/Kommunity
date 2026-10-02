const { query, getClient } = require('../db');
const { getIo } = require('../socket');

// ─── List spaces for a community ──────────────────────────────────────────────
const listSpaces = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const memberLevel = req.membership?.level ?? 1;
    const memberTierPrice = Number(req.membership?.tier_price ?? 0);

    const result = await query(
      `SELECT s.*, t.price as min_tier_price 
       FROM spaces s
       LEFT JOIN community_tiers t ON t.id = s.min_tier_id
       WHERE s.community_id = $1 AND s.is_archived = FALSE
       ORDER BY s.position ASC, s.created_at ASC`,
      [communityId]
    );

    const spaces = result.rows.map(space => {
      const levelLocked = memberLevel < (space.min_level_required ?? 1);
      const tierLocked = space.min_tier_price !== null && memberTierPrice < Number(space.min_tier_price);
      return {
        ...space,
        is_locked: levelLocked || tierLocked,
        is_tier_locked: tierLocked,
        is_level_locked: levelLocked,
      };
    });

    res.json(spaces);
  } catch (err) {
    next(err);
  }
};

// ─── Get a single space by slug ───────────────────────────────────────────────
const getSpace = async (req, res, next) => {
  try {
    const { communityId, spaceSlug } = req.params;
    const memberLevel = req.membership?.level ?? 1;
    const memberTierPrice = Number(req.membership?.tier_price ?? 0);

    const result = await query(
      `SELECT s.*, t.price as min_tier_price 
       FROM spaces s
       LEFT JOIN community_tiers t ON t.id = s.min_tier_id
       WHERE s.community_id = $1 AND s.slug = $2 AND s.is_archived = FALSE`,
      [communityId, spaceSlug]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Space not found' });

    const space = result.rows[0];
    const levelLocked = memberLevel < (space.min_level_required ?? 1);
    const tierLocked = space.min_tier_price !== null && memberTierPrice < Number(space.min_tier_price);

    res.json({
      ...space,
      is_locked: levelLocked || tierLocked,
      is_tier_locked: tierLocked,
      is_level_locked: levelLocked,
      your_level: memberLevel,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Create a new space (admin) ───────────────────────────────────────────────
const createSpace = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { name, description, icon_emoji, type, min_level_required, min_tier_id } = req.body;

    // Auto-generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100);

    // Get next position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM spaces WHERE community_id = $1',
      [communityId]
    );

    const result = await query(
      `INSERT INTO spaces (community_id, slug, name, description, icon_emoji, type, min_level_required, min_tier_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [communityId, slug, name, description, icon_emoji ?? '💬', type ?? 'feed', min_level_required ?? 1, min_tier_id || null, posResult.rows[0].next_pos]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A space with this name already exists in this community' });
    }
    next(err);
  }
};

// ─── Update a space (admin) ───────────────────────────────────────────────────
const updateSpace = async (req, res, next) => {
  try {
    const { spaceId } = req.params;
    const { name, description, icon_emoji, type, min_level_required, min_tier_id } = req.body;

    const result = await query(
      `UPDATE spaces SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        icon_emoji = COALESCE($3, icon_emoji),
        type = COALESCE($4, type),
        min_level_required = COALESCE($5, min_level_required),
        min_tier_id = $6
       WHERE id = $7 RETURNING *`,
      [name, description, icon_emoji, type, min_level_required, min_tier_id || null, spaceId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Space not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// ─── Delete a space (admin) ───────────────────────────────────────────────────
const deleteSpace = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { communityId, spaceId } = req.params;

    // Cannot delete default space
    const space = await client.query('SELECT * FROM spaces WHERE id = $1', [spaceId]);
    if (!space.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Space not found' });
    }
    if (space.rows[0].is_default) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot delete the default space' });
    }

    // Move posts from this space to the default space
    const defaultSpace = await client.query(
      'SELECT id FROM spaces WHERE community_id = $1 AND is_default = TRUE',
      [communityId]
    );
    if (defaultSpace.rows.length) {
      await client.query(
        'UPDATE posts SET space_id = $1 WHERE space_id = $2',
        [defaultSpace.rows[0].id, spaceId]
      );
    }

    await client.query('DELETE FROM spaces WHERE id = $1', [spaceId]);
    await client.query('COMMIT');
    res.json({ message: 'Space deleted. Posts moved to General.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─── Reorder spaces (admin) ──────────────────────────────────────────────────
const reorderSpaces = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const item of req.body.order) {
      await client.query('UPDATE spaces SET position = $1 WHERE id = $2', [item.position, item.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Reordered' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─── Group chat messages (chat-type spaces) ──────────────────────────────────
const resolveSpaceId = async (communityId, spaceIdOrSlug) => {
  // Accept either a UUID or a slug for convenience
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(spaceIdOrSlug);
  const res = await query(
    `SELECT id, min_level_required, min_tier_id FROM spaces WHERE community_id = $1 AND ${isUuid ? 'id' : 'slug'} = $2`,
    [communityId, spaceIdOrSlug]
  );
  return res.rows[0] || null;
};

const listMessages = async (req, res, next) => {
  try {
    const { communityId, spaceId } = req.params;
    const { before, limit = 50 } = req.query;
    const space = await resolveSpaceId(communityId, spaceId);
    if (!space) return res.status(404).json({ error: 'Space not found' });

    const params = [space.id, Math.min(Number(limit), 100)];
    let beforeClause = '';
    if (before) { params.push(before); beforeClause = `AND m.created_at < $3`; }

    const result = await query(
      `SELECT m.id, m.content, m.created_at, m.user_id,
              u.full_name AS author_name, u.avatar_url AS author_avatar
       FROM space_messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.space_id = $1 ${beforeClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params
    );
    // Return chronological (oldest first) for easy rendering
    res.json(result.rows.reverse());
  } catch (err) {
    next(err);
  }
};

const postMessage = async (req, res, next) => {
  try {
    const { communityId, spaceId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Message content is required' });

    const space = await resolveSpaceId(communityId, spaceId);
    if (!space) return res.status(404).json({ error: 'Space not found' });

    // Enforce the space's level gate
    const memberLevel = req.membership?.level ?? 1;
    if (memberLevel < (space.min_level_required ?? 1)) {
      return res.status(403).json({ error: 'Your level is too low to chat in this space' });
    }

    const insert = await query(
      `INSERT INTO space_messages (space_id, community_id, user_id, content)
       VALUES ($1, $2, $3, $4) RETURNING id, content, created_at, user_id`,
      [space.id, communityId, req.user.id, content.trim().slice(0, 4000)]
    );
    const message = {
      ...insert.rows[0],
      author_name: req.user.full_name,
      author_avatar: req.user.avatar_url,
    };

    // Broadcast to everyone currently in this space's room
    try {
      getIo().to(`space:${space.id}`).emit('space_message', message);
    } catch (err) {
      console.error('Chat socket emit failed:', err.message);
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

module.exports = { listSpaces, getSpace, createSpace, updateSpace, deleteSpace, reorderSpaces, listMessages, postMessage };
