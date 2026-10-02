const { query } = require('../db');
const { hashKey } = require('../controllers/apiKeyController');

/**
 * Authenticates public API (/api/v1) requests via an API key.
 * Accepts `Authorization: Bearer kmn_live_...` or `X-API-Key: kmn_live_...`.
 * On success, attaches req.apiCommunityId (the key's community scope).
 */
const apiKeyAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const key = bearer || req.headers['x-api-key'];
    if (!key || !key.startsWith('kmn_')) {
      return res.status(401).json({ error: 'Missing or invalid API key' });
    }

    const prefix = key.slice(0, 12);
    const result = await query(
      'SELECT id, community_id, key_hash, revoked FROM api_keys WHERE key_prefix = $1',
      [prefix]
    );

    const match = result.rows.find(r => !r.revoked && r.key_hash === hashKey(key));
    if (!match) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    // Best-effort last-used timestamp (don't block the request)
    query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [match.id]).catch(() => {});

    req.apiCommunityId = match.community_id;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { apiKeyAuth };
