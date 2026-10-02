const { query, getClient } = require('../db');
const webhookService = require('../utils/webhookService');

const sendWelcomeDM = async (client, community, userId) => {
  if (!community.welcome_message_enabled || !community.welcome_message) return;
  
  // Check if conversation already exists between owner and user
  const convResult = await client.query(
    `SELECT c.id FROM conversations c
     JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = $1
     JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = $2
     GROUP BY c.id HAVING COUNT(c.id) = 2`,
    [community.owner_id, userId]
  );

  let conversationId;
  if (convResult.rows.length > 0) {
    conversationId = convResult.rows[0].id;
  } else {
    const newConv = await client.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
    conversationId = newConv.rows[0].id;
    await client.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
      [conversationId, community.owner_id, userId]
    );
  }

  // Insert the welcome message
  await client.query(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)',
    [conversationId, community.owner_id, community.welcome_message]
  );
  
  // Update conversation timestamp
  await client.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
};

const DEFAULT_POINT_RULES = [
  { action: 'post', points: 5, daily_cap: 20 },
  { action: 'comment', points: 2, daily_cap: 30 },
  { action: 'lesson_complete', points: 10, daily_cap: null },
  { action: 'event_attend', points: 15, daily_cap: null },
  { action: 'like_received', points: 1, daily_cap: 50 },
];

const list = async (req, res, next) => {
  try {
    const { search, category, sort = 'trending', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClauses = ['c.is_public = TRUE', 'c.is_active = TRUE'];
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`(c.name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      whereClauses.push(`c.category ILIKE $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    params.push(limit, offset);
    const limitIdx = paramIndex;
    const offsetIdx = paramIndex + 1;

    let orderClause = 'ORDER BY c.member_count DESC';
    if (sort === 'newest') {
      orderClause = 'ORDER BY c.created_at DESC';
    } else if (sort === 'trending') {
      // In a real app, this would use a complex formula including recent activity. 
      // For now, we sort by member_count and created_at.
      orderClause = 'ORDER BY c.member_count DESC, c.created_at DESC';
    }

    const result = await query(
      `SELECT c.id, c.slug, c.name, c.description, c.cover_image, c.icon_image,
              c.monthly_price, c.member_count, c.is_public, c.created_at, c.category, c.join_mode,
              u.full_name AS owner_name, u.avatar_url AS owner_avatar
       FROM communities c
       JOIN users u ON u.id = c.owner_id
       WHERE ${whereClauses.join(' AND ')}
       ${orderClause}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    res.json({ communities: result.rows, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT c.*, u.full_name AS owner_name, u.avatar_url AS owner_avatar
       FROM communities c JOIN users u ON u.id = c.owner_id
       WHERE c.id::text = $1 OR c.slug = $1`,
      [communityId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Community not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getByDomain = async (req, res, next) => {
  try {
    const { domain } = req.params;
    const result = await query(
      `SELECT c.*, u.full_name AS owner_name, u.avatar_url AS owner_avatar
       FROM communities c JOIN users u ON u.id = c.owner_id
       WHERE c.custom_domain = $1`,
      [domain]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Community not found for this domain' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { name, description, slug, category = 'General', is_public = true, monthly_price = 0, welcome_message_enabled = false, welcome_message = null } = req.body;

    const community = await client.query(
      `INSERT INTO communities (owner_id, name, slug, description, category, is_public, monthly_price, welcome_message_enabled, welcome_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, name, slug, description, category, is_public, monthly_price, welcome_message_enabled, welcome_message]
    );
    const comm = community.rows[0];

    // Add owner as admin member
    await client.query(
      `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [comm.id, req.user.id]
    );

    // Seed default point rules
    for (const rule of DEFAULT_POINT_RULES) {
      await client.query(
        `INSERT INTO point_rules (community_id, action, points, daily_cap) VALUES ($1, $2, $3, $4)`,
        [comm.id, rule.action, rule.points, rule.daily_cap]
      );
    }

    // Create default "General" space
    await client.query(
      `INSERT INTO spaces (community_id, slug, name, icon_emoji, is_default, position)
       VALUES ($1, 'general', 'General', '💬', TRUE, 0)`,
      [comm.id]
    );

    await client.query('COMMIT');
    res.status(201).json(comm);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const join = async (req, res, next) => {
  const client = await getClient();
  try {
    const { communityId } = req.params;
    const { wantsNewsletter = true, intakeAnswers = [], referrerId = null } = req.body;

    await client.query('BEGIN');
    
    const comm = await client.query('SELECT * FROM communities WHERE id = $1', [communityId]);
    if (!comm.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Community not found' });
    }
    const community = comm.rows[0];

    if (community.monthly_price > 0) {
      await client.query('ROLLBACK');
      return res.status(402).json({
        error: 'Payment required',
        checkout_required: true,
        community_id: communityId,
      });
    }

    let initialStatus = 'active';
    if (community.join_mode === 'application') {
      initialStatus = 'pending';
    }

    const insertResult = await client.query(
      `INSERT INTO community_members (community_id, user_id, wants_newsletter, status, intake_answers) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (community_id, user_id) DO NOTHING
       RETURNING id`,
      [communityId, req.user.id, wantsNewsletter, initialStatus, intakeAnswers ? JSON.stringify(intakeAnswers) : null]
    );

    if (insertResult.rows.length > 0) {
      await client.query('UPDATE communities SET member_count = member_count + 1 WHERE id = $1', [communityId]);
      
      if (initialStatus === 'active') {
        await sendWelcomeDM(client, community, req.user.id);
      }

      // Handle Referral
      if (referrerId && referrerId !== req.user.id) {
        const referrerCheck = await client.query(
          'SELECT id FROM community_members WHERE community_id = $1 AND user_id = $2',
          [communityId, referrerId]
        );
        
        if (referrerCheck.rows.length > 0) {
          await client.query(
            `INSERT INTO referrals (community_id, referrer_id, referred_user_id, status, reward_points) 
             VALUES ($1, $2, $3, $4, 50)
             ON CONFLICT DO NOTHING`,
            [communityId, referrerId, req.user.id, initialStatus === 'pending' ? 'pending' : 'completed']
          );

          if (initialStatus === 'active') {
            await client.query(
              'UPDATE community_members SET points = points + 50 WHERE community_id = $1 AND user_id = $2',
              [communityId, referrerId]
            );
            await client.query(
              `INSERT INTO point_transactions (community_id, user_id, action, points)
               VALUES ($1, $2, 'referral', 50)`,
              [communityId, referrerId]
            );
          }
        }
      }
    }

    await client.query('COMMIT');

    if (initialStatus === 'pending') {
      // Fire an outbound webhook so creators can pipe applications (incl. intake
      // answers, often used to capture emails) into Zapier/GoHighLevel/CRMs.
      webhookService.dispatchEvent(communityId, 'member.application_submitted', {
        user_id: req.user.id,
        intake_answers: intakeAnswers || [],
        wants_newsletter: wantsNewsletter,
      }).catch(err => console.error(err));
      res.json({ message: 'Application submitted', status: 'pending' });
    } else {
      webhookService.dispatchEvent(communityId, 'member.joined', {
        user_id: req.user.id,
        wants_newsletter: wantsNewsletter
      }).catch(err => console.error(err));
      res.json({ message: 'Joined successfully', status: 'active' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const leave = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    await query(
      'DELETE FROM community_members WHERE community_id = $1 AND user_id = $2',
      [communityId, req.user.id]
    );
    await query('UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1', [communityId]);
    webhookService.dispatchEvent(communityId, 'member.left', {
      user_id: req.user.id,
    }).catch(err => console.error(err));
    res.json({ message: 'Left community' });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const {
      name, description, cover_image, icon_image, is_public, join_mode,
      intake_questions, welcome_message_enabled, welcome_message, custom_domain,
      theme_config, token_gate_enabled, token_contract_address, token_network, min_token_balance,
      currency
    } = req.body;
    
    // Check if custom_domain is already taken
    if (custom_domain) {
      const existing = await query('SELECT id FROM communities WHERE custom_domain = $1 AND id != $2', [custom_domain, communityId]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Custom domain is already in use' });
      }
    }

    const result = await query(
      `UPDATE communities SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        cover_image = COALESCE($3, cover_image),
        icon_image = COALESCE($4, icon_image),
        is_public = COALESCE($5, is_public),
        join_mode = COALESCE($6, join_mode),
        intake_questions = COALESCE($7, intake_questions),
        welcome_message_enabled = COALESCE($8, welcome_message_enabled),
        welcome_message = COALESCE($9, welcome_message),
        custom_domain = $10,
        theme_config = COALESCE($11, theme_config),
        token_gate_enabled = COALESCE($12, token_gate_enabled),
        token_contract_address = COALESCE($13, token_contract_address),
        token_network = COALESCE($14, token_network),
        min_token_balance = COALESCE($15, min_token_balance),
        currency = COALESCE($16, currency),
        updated_at = NOW()
       WHERE id = $17 RETURNING *`,
      [
        name,
        description,
        cover_image,
        icon_image,
        is_public,
        join_mode,
        intake_questions ? JSON.stringify(intake_questions) : null,
        welcome_message_enabled,
        welcome_message,
        custom_domain || null,
        theme_config ? JSON.stringify(theme_config) : null,
        token_gate_enabled,
        token_contract_address,
        token_network,
        min_token_balance,
        currency ? currency.toLowerCase() : null,
        communityId
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    await query('UPDATE communities SET is_active = FALSE WHERE id = $1', [communityId]);
    res.json({ message: 'Community archived' });
  } catch (err) {
    next(err);
  }
};

const updateMemberRole = async (req, res, next) => {
  try {
    const { communityId, userId } = req.params;
    const { role } = req.body;
    if (!['member', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    await query(
      'UPDATE community_members SET role = $1 WHERE community_id = $2 AND user_id = $3',
      [role, communityId, userId]
    );
    res.json({ message: 'Role updated' });
  } catch (err) {
    next(err);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const { communityId, userId } = req.params;
    await query('DELETE FROM community_members WHERE community_id = $1 AND user_id = $2', [communityId, userId]);
    await query('UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1', [communityId]);
    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};

const listPendingMembers = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, cm.joined_at, cm.intake_answers
       FROM community_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = $1 AND cm.status = 'pending'
       ORDER BY cm.joined_at ASC`,
      [communityId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const updateMemberStatus = async (req, res, next) => {
  try {
    const { communityId, userId } = req.params;
    const { status } = req.body;
    if (!['active', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await query(
      `UPDATE community_members SET status = $1 WHERE community_id = $2 AND user_id = $3`,
      [status, communityId, userId]
    );

    if (status === 'active') {
      webhookService.dispatchEvent(communityId, 'member.joined', {
        user_id: userId,
        status: 'approved'
      }).catch(err => console.error(err));

      // Complete any pending referral for this user
      const client = await getClient();
      try {
        await client.query('BEGIN');
        
        const commResult = await client.query('SELECT owner_id, welcome_message_enabled, welcome_message FROM communities WHERE id = $1', [communityId]);
        if (commResult.rows.length > 0) {
           await sendWelcomeDM(client, commResult.rows[0], userId);
        }
        
        const refRes = await client.query(
          `UPDATE referrals SET status = 'completed' 
           WHERE community_id = $1 AND referred_user_id = $2 AND status = 'pending'
           RETURNING referrer_id`,
          [communityId, userId]
        );
        if (refRes.rows.length > 0) {
          const referrerId = refRes.rows[0].referrer_id;
          const { awardPoints } = require('../utils/points');
          await awardPoints(client, communityId, referrerId, 'referral', userId);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed to complete referral:', err);
      } finally {
        client.release();
      }
    }

    res.json({ message: `Member ${status}` });
  } catch (err) {
    next(err);
  }
};

const exportMembers = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    
    // Require admin access is already handled by middleware in routes, 
    // but just in case, verify community exists.
    const comm = await query('SELECT name FROM communities WHERE id = $1', [communityId]);
    if (!comm.rows.length) return res.status(404).json({ error: 'Community not found' });

    const result = await query(
      `SELECT u.full_name, u.email, cm.role, cm.points, cm.level, 
              ct.name AS tier_name, cm.wants_newsletter, cm.joined_at
       FROM community_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN community_tiers ct ON ct.id = cm.tier_id
       WHERE cm.community_id = $1
       ORDER BY cm.joined_at DESC`,
      [communityId]
    );

    // Generate simple CSV
    const fields = ['Name', 'Email', 'Role', 'Points', 'Level', 'Tier', 'Wants Newsletter', 'Joined At'];
    const csvRows = [fields.join(',')];
    
    for (const row of result.rows) {
      const values = [
        `"${row.full_name.replace(/"/g, '""')}"`,
        `"${row.email}"`,
        row.role,
        row.points,
        row.level,
        row.tier_name ? `"${row.tier_name}"` : 'Free',
        row.wants_newsletter ? 'Yes' : 'No',
        row.joined_at.toISOString()
      ];
      csvRows.push(values.join(','));
    }

    const csvData = csvRows.join('\n');
    const safeName = comm.rows[0].name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="members-${safeName}.csv"`);
    res.send(csvData);
  } catch (err) {
    next(err);
  }
};

const sendBroadcast = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { subject, content } = req.body;
    
    if (!subject || !content) {
      return res.status(400).json({ error: 'Subject and content are required' });
    }

    const commRes = await query('SELECT id, name FROM communities WHERE id = $1', [communityId]);
    if (!commRes.rows.length) return res.status(404).json({ error: 'Community not found' });
    
    const { sendCustomBroadcast } = require('../utils/emailService');
    const sentCount = await sendCustomBroadcast(commRes.rows[0], subject, content);

    res.json({ message: `Broadcast sent to ${sentCount} members`, sentCount });
  } catch (err) {
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  const client = await getClient();
  try {
    const { communityId } = req.params;

    // 1. Growth over last 30 days
    const growthRes = await client.query(`
      WITH days AS (
        SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, '1 day')::date AS date
      )
      SELECT
        to_char(days.date, 'Mon DD') as date,
        (SELECT COUNT(*) FROM community_members j
           WHERE j.community_id = $1 AND DATE(j.joined_at) = days.date) as new_members,
        (SELECT COUNT(*) FROM community_members c
           WHERE c.community_id = $1 AND c.subscription_status = 'cancelled'
             AND DATE(c.cancelled_at) = days.date) as churned_members
      FROM days
      ORDER BY days.date
    `, [communityId]);

    // 2. Engagement over last 30 days
    const engagementRes = await client.query(`
      WITH days AS (
        SELECT generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE, '1 day')::date AS date
      )
      SELECT 
        to_char(days.date, 'Mon DD') as date,
        (SELECT COUNT(*) FROM posts p WHERE DATE(p.created_at) = days.date AND p.community_id = $1) as posts,
        (SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id WHERE DATE(c.created_at) = days.date AND p.community_id = $1) as comments
      FROM days
      ORDER BY days.date
    `, [communityId]);

    // 3. Top Members
    const topMembersRes = await client.query(`
      SELECT u.id, u.full_name, u.avatar_url, cm.points, cm.level
      FROM community_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.community_id = $1 AND cm.status = 'active'
      ORDER BY cm.points DESC
      LIMIT 5
    `, [communityId]);
    
    // 4. Popular Spaces
    const topSpacesRes = await client.query(`
      SELECT s.id, s.name, s.icon_emoji, COUNT(p.id) as post_count
      FROM spaces s
      LEFT JOIN posts p ON p.space_id = s.id
      WHERE s.community_id = $1
      GROUP BY s.id
      ORDER BY post_count DESC
      LIMIT 5
    `, [communityId]);

    res.json({
      growth: growthRes.rows,
      engagement: engagementRes.rows,
      topMembers: topMembersRes.rows,
      topSpaces: topSpacesRes.rows
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

module.exports = { list, get, getByDomain, create, join, leave, update, remove, updateMemberRole, removeMember, exportMembers, listPendingMembers, updateMemberStatus, sendBroadcast, getAnalytics };
