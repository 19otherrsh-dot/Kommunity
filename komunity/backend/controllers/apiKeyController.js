const crypto = require('crypto');
const { query } = require('../db');

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

// Admin: create a new API key for a community. The full key is shown ONCE.
const createKey = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'A key name is required' });

    const secret = crypto.randomBytes(24).toString('hex');
    const fullKey = `kmn_live_${secret}`;
    const prefix = fullKey.slice(0, 12); // kmn_live_xxx — enough to look up

    const result = await query(
      `INSERT INTO api_keys (community_id, created_by, name, key_prefix, key_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, key_prefix, created_at`,
      [communityId, req.user.id, name, prefix, hashKey(fullKey)]
    );

    // Return the plaintext key exactly once
    res.status(201).json({ ...result.rows[0], key: fullKey });
  } catch (err) {
    next(err);
  }
};

const listKeys = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT id, name, key_prefix, last_used_at, revoked, created_at
       FROM api_keys WHERE community_id = $1 ORDER BY created_at DESC`,
      [communityId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const revokeKey = async (req, res, next) => {
  try {
    const { communityId, keyId } = req.params;
    await query('UPDATE api_keys SET revoked = TRUE WHERE id = $1 AND community_id = $2', [keyId, communityId]);
    res.json({ message: 'API key revoked' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createKey, listKeys, revokeKey, hashKey };
