const crypto = require('crypto');

// Mux signs `${timestamp}.${rawBody}` with HMAC-SHA256; header is `t=..,v1=..`.
function verifyMuxSignature(rawBody, header, secret) {
  if (!secret) return true; // no secret configured (dev) — skip verification
  if (!header) return false;
  const parts = Object.fromEntries(String(header).split(',').map(kv => kv.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  } catch { return false; }
}

// Daily signs the raw body with HMAC-SHA256, base64-encoded.
function verifyDailySignature(rawBody, header, secret) {
  if (!secret) return true; // no secret configured (dev) — skip verification
  if (!header) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(header)));
  } catch { return false; }
}

module.exports = { verifyMuxSignature, verifyDailySignature };
