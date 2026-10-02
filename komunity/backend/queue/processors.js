const axios = require('axios');
const crypto = require('crypto');
const { query } = require('../db');

// ─── Outbound webhook delivery (logged + auto-disabled on repeated failure) ───
const DISABLE_THRESHOLD = 10; // consecutive failing events before auto-disabling

async function logDelivery(webhookId, communityId, event, status, statusCode, error) {
  if (!webhookId) return;
  await query(
    `INSERT INTO webhook_deliveries (webhook_id, community_id, event, status, status_code, error)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [webhookId, communityId || null, event || null, status, statusCode || null, error ? String(error).slice(0, 500) : null]
  ).catch(() => {});
}

async function deliverWebhook(data, job) {
  const { webhook_id, community_id, event, endpoint_url, secret, requestBody } = data;
  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['X-Komunity-Signature'] = crypto.createHmac('sha256', secret).update(requestBody).digest('hex');
  }

  try {
    const resp = await axios.post(endpoint_url, requestBody, { headers, timeout: 5000 });
    await logDelivery(webhook_id, community_id, event, 'success', resp.status);
    if (webhook_id) await query('UPDATE webhooks SET consecutive_failures = 0 WHERE id = $1', [webhook_id]).catch(() => {});
  } catch (err) {
    const statusCode = err.response?.status;
    await logDelivery(webhook_id, community_id, event, 'failed', statusCode, err.message);

    // Only count a failing *event* (final attempt) toward auto-disable, not each retry
    const attemptsMade = (job?.attemptsMade ?? 0) + 1;
    const maxAttempts = job?.opts?.attempts ?? 1;
    if (webhook_id && attemptsMade >= maxAttempts) {
      const r = await query(
        `UPDATE webhooks SET consecutive_failures = consecutive_failures + 1 WHERE id = $1 RETURNING consecutive_failures`,
        [webhook_id]
      ).catch(() => null);
      const failures = r?.rows?.[0]?.consecutive_failures ?? 0;
      if (failures >= DISABLE_THRESHOLD) {
        await query('UPDATE webhooks SET is_active = FALSE WHERE id = $1', [webhook_id]).catch(() => {});
        console.warn(`[webhook] auto-disabled ${webhook_id} after ${failures} consecutive failures`);
      }
    }
    throw err; // let BullMQ retry
  }
}

// ─── Per-user activity digest (heavy work moved off the request path) ─────────
async function sendUserDigest({ userId, email, name, frequency, intervalDays }) {
  const emailService = require('../utils/emailService');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const topPosts = await query(
    `SELECT p.id, p.content, p.like_count, p.comment_count, c.name AS community_name, c.slug AS community_slug
     FROM posts p
     JOIN community_members cm ON cm.community_id = p.community_id AND cm.status = 'active'
     JOIN communities c ON c.id = p.community_id
     WHERE cm.user_id = $1 AND p.created_at > NOW() - ($2 || ' days')::interval
     ORDER BY (p.like_count + p.comment_count * 2) DESC
     LIMIT 5`,
    [userId, String(intervalDays)]
  );
  if (!topPosts.rows.length) return;

  const rows = topPosts.rows.map(post => {
    const preview = (post.content || '').replace(/<[^>]*>?/gm, '').slice(0, 120);
    const postUrl = `${frontendUrl}/c/${post.community_slug}/posts/${post.id}`;
    return `
      <div style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
        <p style="margin:0 0 4px;color:#6366f1;font-size:12px;font-weight:bold;">${post.community_name}</p>
        <a href="${postUrl}" style="color:#111;font-size:15px;text-decoration:none;">${preview}…</a>
        <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">❤️ ${post.like_count} · 💬 ${post.comment_count}</p>
      </div>`;
  }).join('');

  const html = `
    <h2 style="color:#333;">Your ${frequency} Komunity digest</h2>
    <p style="color:#666;font-size:14px;">Here's what's been happening in your communities, ${name}.</p>
    ${rows}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">You can change your digest frequency in your profile settings.</p>`;

  await emailService.sendMarketingEmail({
    userId, email, name,
    communityId: 'all',
    community: { id: 'all', name: 'your Komunity communities' },
    subject: `Top posts in your communities this ${frequency === 'daily' ? 'day' : 'week'}`,
    html,
  });
}

// One processor per queue; it dispatches on the job name.
const processors = {
  webhooks: async (job) => {
    if (job.name === 'deliver') return deliverWebhook(job.data, job);
  },
  emails: async (job) => {
    if (job.name === 'digest') return sendUserDigest(job.data);
  },
};

module.exports = { processors };
