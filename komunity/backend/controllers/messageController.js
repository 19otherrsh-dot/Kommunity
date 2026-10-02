const { query, getClient } = require('../db');
const { getIo } = require('../socket');

const getConversations = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.id, c.updated_at,
              u.id AS other_user_id, u.full_name, u.avatar_url,
              m.content AS last_message, m.created_at AS last_message_at
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id != cp.user_id
       JOIN users u ON u.id = other_cp.user_id
       LEFT JOIN LATERAL (
         SELECT content, created_at FROM messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at DESC LIMIT 1
       ) m ON true
       WHERE cp.user_id = $1
       ORDER BY COALESCE(m.created_at, c.updated_at) DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    
    // Verify participation
    const check = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Not authorized' });

    // Mark as read
    await query(
      'UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );

    const messages = await query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    );
    res.json(messages.rows);
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // The recipient could be sent as `recipientId` to create a new conversation, 
    // or we just send to an existing `conversationId`
    let { conversationId, recipientId, content } = req.body;
    
    if (!content) throw new Error('Content is required');

    if (!conversationId && recipientId) {
      // Find existing conversation between these two
      const existing = await client.query(
        `SELECT cp1.conversation_id 
         FROM conversation_participants cp1
         JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
         WHERE cp1.user_id = $1 AND cp2.user_id = $2`,
        [req.user.id, recipientId]
      );

      if (existing.rows.length) {
        conversationId = existing.rows[0].conversation_id;
      } else {
        // Create new conversation
        const conv = await client.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
        conversationId = conv.rows[0].id;
        
        await client.query(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
          [conversationId, req.user.id, recipientId]
        );
      }
    }

    if (!conversationId) return res.status(400).json({ error: 'conversationId or recipientId required' });

    // Verify participation
    const check = await client.query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Not authorized' });

    // Insert message
    const msgResult = await client.query(
      'INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
      [conversationId, req.user.id, content]
    );
    const message = msgResult.rows[0];

    // Update conversation updated_at
    await client.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    // Find other participant to emit event
    const other = await client.query(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2',
      [conversationId, req.user.id]
    );

    await client.query('COMMIT');

    // Emit via socket.io
    if (other.rows.length) {
      const recipient = other.rows[0].user_id;
      try {
        const io = getIo();
        io.to(recipient).emit('new_message', message);
      } catch (err) {
        console.error('Socket emission failed:', err);
      }
    }

    res.status(201).json(message);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

module.exports = { getConversations, getMessages, sendMessage };
