/**
 * Parse a Cookie header into an object (pure). Returns {} for missing/empty input.
 */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

module.exports = { parseCookies };
