const { query } = require('../db');
const unsub = require('../utils/unsubscribeToken');

// Apply an unsubscribe from a signed token. Returns null if the token is invalid.
const applyUnsubscribe = async (token) => {
  const data = unsub.verify(token);
  if (!data) return null;
  const { userId, communityId } = data;

  const userRes = await query('SELECT email FROM users WHERE id = $1', [userId]);
  if (!userRes.rows.length) return null;
  const email = userRes.rows[0].email;

  if (communityId === 'all') {
    await query(
      `INSERT INTO email_suppressions (email, community_id, reason) VALUES ($1, NULL, 'unsubscribe')
       ON CONFLICT DO NOTHING`,
      [email]
    );
    await query('UPDATE community_members SET wants_newsletter = FALSE WHERE user_id = $1', [userId]);
    return { email, scope: 'all' };
  }

  await query(
    `INSERT INTO email_suppressions (email, community_id, reason) VALUES ($1, $2, 'unsubscribe')
     ON CONFLICT (email, community_id) DO NOTHING`,
    [email, communityId]
  );
  await query(
    'UPDATE community_members SET wants_newsletter = FALSE WHERE user_id = $1 AND community_id = $2',
    [userId, communityId]
  );
  const c = await query('SELECT name FROM communities WHERE id = $1', [communityId]);
  return { email, scope: 'community', communityName: c.rows[0]?.name };
};

const page = (title, message) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="font-family:sans-serif;background:#0f0f14;color:#e8e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
  <div style="max-width:440px;text-align:center;padding:32px">
    <h1 style="font-size:22px;margin-bottom:8px">${title}</h1>
    <p style="color:#9ca3af;line-height:1.5">${message}</p>
  </div>
</body></html>`;

// GET /api/unsubscribe?token=... — human-facing confirmation page
const unsubscribe = async (req, res, next) => {
  try {
    const result = await applyUnsubscribe(req.query.token);
    if (!result) {
      return res.status(400).send(page('Invalid link', 'This unsubscribe link is invalid or has expired.'));
    }
    const scope = result.scope === 'all'
      ? 'all Komunity community newsletters'
      : `the ${result.communityName || 'community'} newsletter`;
    res.send(page('You’re unsubscribed', `${result.email} has been removed from ${scope}. You can re-enable emails anytime in your settings.`));
  } catch (err) {
    next(err);
  }
};

// POST /api/unsubscribe?token=... — RFC 8058 one-click unsubscribe (from email clients)
const oneClickUnsubscribe = async (req, res, next) => {
  try {
    await applyUnsubscribe(req.query.token);
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { unsubscribe, oneClickUnsubscribe, applyUnsubscribe };
