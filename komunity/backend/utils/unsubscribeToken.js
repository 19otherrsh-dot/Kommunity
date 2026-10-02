const crypto = require('crypto');

// Unsubscribe links must work without login, so they carry a signed (not expiring)
// token identifying the user + community. HMAC-SHA256, no secret in the URL.
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'dev-unsubscribe-secret';

function sign(userId, communityId = 'all') {
  const payload = Buffer.from(`${userId}.${communityId}`).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  const [userId, communityId] = Buffer.from(payload, 'base64url').toString().split('.');
  if (!userId) return null;
  return { userId, communityId: communityId || 'all' };
}

module.exports = { sign, verify };
