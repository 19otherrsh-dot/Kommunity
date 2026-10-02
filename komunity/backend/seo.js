const fs = require('fs');
const path = require('path');
const express = require('express');
const { query } = require('./db');

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Locate the built frontend (production single-origin deploys). Returns null in dev.
function resolveDistDir() {
  const candidates = [
    process.env.FRONTEND_DIST,
    path.resolve(__dirname, '../frontend/dist'),
    path.resolve(__dirname, './public'),
  ].filter(Boolean);
  return candidates.find(d => {
    try { return fs.existsSync(path.join(d, 'index.html')); } catch { return false; }
  }) || null;
}

// Replace title/description and inject OG/Twitter/JSON-LD into the document head.
function injectMeta(html, { title, description, image, url, jsonLd }) {
  const d = esc(description || '');
  const t = esc(title || 'Komunity');
  const block = [
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    url ? `<meta property="og:url" content="${esc(url)}" />` : '',
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
    jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '',
  ].filter(Boolean).join('\n    ');

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/, `<meta name="description" content="${d}" />`);

  if (out.includes('<!--SEO-->')) {
    out = out.replace(/<!--SEO-->[\s\S]*?<!--\/SEO-->/, `<!--SEO-->\n    ${block}\n    <!--/SEO-->`);
  } else {
    out = out.replace('</head>', `    ${block}\n  </head>`);
  }
  return out;
}

/**
 * Serve the built SPA with server-side meta injection so public community pages
 * are fully crawlable. No-op (logs) when no build is present (dev uses Vite).
 */
function mountFrontend(app) {
  const distDir = resolveDistDir();
  if (!distDir) {
    console.log('[SEO] No frontend build found — SPA serving disabled (dev served by Vite).');
    return;
  }

  const indexPath = path.join(distDir, 'index.html');
  const readIndex = () => fs.readFileSync(indexPath, 'utf8');
  const siteUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

  // robots.txt — allow crawling, point at the sitemap
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${siteUrl || ''}/sitemap.xml\n`);
  });

  // sitemap.xml — list public community landing pages
  app.get('/sitemap.xml', async (req, res, next) => {
    try {
      const r = await query(
        `SELECT slug, updated_at FROM communities WHERE is_public = TRUE AND is_active = TRUE ORDER BY member_count DESC LIMIT 5000`
      );
      const urls = [
        `${siteUrl}/discover`,
        ...r.rows.map(c => `${siteUrl}/c/${c.slug}/about`),
      ];
      const body = urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n');
      res.type('application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`
      );
    } catch (err) { next(err); }
  });

  // Static assets (JS/CSS/images) — never auto-serve index for these
  app.use(express.static(distDir, { index: false }));

  // SPA fallback + per-route meta injection for crawlers
  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api')) return next();

    let html = readIndex();
    try {
      // Public community landing: /c/:slug or /c/:slug/about
      const m = req.path.match(/^\/c\/([^/]+)(?:\/about)?\/?$/);
      if (m) {
        const r = await query(
          `SELECT name, description, icon_image, cover_image, member_count
           FROM communities WHERE slug = $1 AND is_public = TRUE AND is_active = TRUE`,
          [m[1]]
        );
        if (r.rows.length) {
          const c = r.rows[0];
          const desc = (c.description || `Join ${c.name} on Komunity.`).slice(0, 300);
          html = injectMeta(html, {
            title: `${c.name} — Komunity`,
            description: desc,
            image: c.cover_image || c.icon_image,
            url: `${siteUrl}${req.path}`,
            jsonLd: {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: c.name,
              description: desc,
              url: `${siteUrl}/c/${m[1]}/about`,
              ...(c.icon_image ? { logo: c.icon_image } : {}),
            },
          });
        }
      }
    } catch (err) {
      console.error('[SEO] meta injection failed:', err.message);
    }
    res.set('Content-Type', 'text/html').send(html);
  });

  console.log(`[SEO] Serving SPA with meta injection from ${distDir}`);
}

module.exports = { mountFrontend };
