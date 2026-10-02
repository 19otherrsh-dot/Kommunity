const sgMail = require('@sendgrid/mail');
const { query } = require('../db');
const unsub = require('./unsubscribeToken');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM = process.env.SENDGRID_FROM_EMAIL || 'noreply@komunity.app';
// The unsubscribe endpoint is served by the backend (same origin in single-origin prod).
const APP_URL = process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:4000';

// ─── Transactional (no unsubscribe — password resets, notifications, etc.) ────
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[DEV MODE - Email skipped]\nTo: ${to}\nSubject: ${subject}\nBody: ${html}`);
    return;
  }
  try {
    await sgMail.send({ to, from: FROM, subject, html });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

// ─── Marketing email helpers (unsubscribe + suppression) ──────────────────────

// Remove recipients who are globally suppressed or opted out of this community.
// communityId may be a UUID (community-scoped) or 'all'/null (cross-community digest).
const filterSuppressed = async (members, communityId) => {
  const emails = members.map(m => m.email);
  if (!emails.length) return members;
  const scoped = communityId && communityId !== 'all';
  const r = await query(
    scoped
      ? `SELECT email FROM email_suppressions WHERE email = ANY($1) AND (community_id IS NULL OR community_id = $2)`
      : `SELECT email FROM email_suppressions WHERE email = ANY($1) AND community_id IS NULL`,
    scoped ? [emails, communityId] : [emails]
  );
  const suppressed = new Set(r.rows.map(x => x.email));
  return members.filter(m => !suppressed.has(m.email));
};

const unsubscribeUrl = (userId, communityId) =>
  `${APP_URL}/api/unsubscribe?token=${unsub.sign(userId, communityId)}`;

const unsubscribeFooter = (url, community) => `
  <p style="color: #9ca3af; font-size: 12px; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
    You received this because you're a member of ${community.name}.
    <a href="${url}" style="color: #6b7280;">Unsubscribe</a> from these emails.
  </p>`;

const listUnsubHeaders = (url) => ({
  'List-Unsubscribe': `<${url}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});

// Build one message per recipient so each carries a unique unsubscribe link/header.
const buildMarketingMessages = (members, community, subject, bodyHtml) =>
  members.map(m => {
    const url = unsubscribeUrl(m.id, community.id);
    return {
      to: { email: m.email, name: m.full_name },
      from: { email: FROM, name: community.name },
      subject,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">${bodyHtml}${unsubscribeFooter(url, community)}</div>`,
      headers: listUnsubHeaders(url),
    };
  });

const CHUNK_SIZE = 950;
const sendMarketing = async (members, community, subject, bodyHtml) => {
  let sent = 0;
  for (let i = 0; i < members.length; i += CHUNK_SIZE) {
    const chunk = members.slice(i, i + CHUNK_SIZE);
    await sgMail.send(buildMarketingMessages(chunk, community, subject, bodyHtml), true);
    sent += chunk.length;
  }
  return sent;
};

// ─── New post → newsletter broadcast ──────────────────────────────────────────
const sendCommunityBroadcast = async (community, post, authorName) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.full_name
       FROM community_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = $1 AND cm.status = 'active' AND cm.wants_newsletter = TRUE`,
      [community.id]
    );
    const members = await filterSuppressed(result.rows, community.id);

    if (!members.length || !process.env.SENDGRID_API_KEY) {
      if (!process.env.SENDGRID_API_KEY) {
        console.log(`[DEV MODE - Broadcast skipped] Would send to ${members.length} members for post ${post.id}`);
      }
      await query("UPDATE posts SET email_broadcast_status = 'completed' WHERE id = $1", [post.id]);
      return;
    }

    const postUrl = `${process.env.FRONTEND_URL || APP_URL}/c/${community.slug}/posts/${post.id}`;
    const excerpt = post.content.substring(0, 300) + (post.content.length > 300 ? '...' : '');
    const body = `
      <h2 style="color: #333;">New Post in ${community.name}</h2>
      <p style="color: #666; font-size: 14px;"><strong>${authorName}</strong> just posted an update:</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #111; font-size: 16px; line-height: 1.5; white-space: pre-wrap;">${excerpt}</p>
      </div>
      <a href="${postUrl}" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        View Full Post &amp; Reply
      </a>`;

    await sendMarketing(members, community, `New post in ${community.name}`, body);
    await query("UPDATE posts SET email_broadcast_status = 'completed' WHERE id = $1", [post.id]);
  } catch (error) {
    console.error('Failed to send community broadcast:', error);
    await query("UPDATE posts SET email_broadcast_status = 'failed' WHERE id = $1", [post.id]);
  }
};

// ─── Admin custom broadcast ───────────────────────────────────────────────────
const sendCustomBroadcast = async (community, subject, content) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.full_name
       FROM community_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = $1 AND cm.status = 'active' AND cm.wants_newsletter = TRUE`,
      [community.id]
    );
    const members = await filterSuppressed(result.rows, community.id);
    if (!members.length) return 0;

    if (!process.env.SENDGRID_API_KEY) {
      console.log(`[DEV MODE - Custom Broadcast skipped] Would send to ${members.length} members for community ${community.name}`);
      return members.length;
    }

    return await sendMarketing(members, community, subject, content);
  } catch (error) {
    console.error('Failed to send custom broadcast:', error);
    throw error;
  }
};

// ─── Single marketing email (used by the digest job) ──────────────────────────
// Returns true if sent, false if suppressed/skipped.
const sendMarketingEmail = async ({ userId, email, name, communityId, community, subject, html }) => {
  const [remaining] = await filterSuppressed([{ id: userId, email, full_name: name }], communityId);
  if (!remaining) return false;
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[DEV MODE - Marketing email skipped] To: ${email} | ${subject}`);
    return true;
  }
  const [msg] = buildMarketingMessages([{ id: userId, email, full_name: name }], community, subject, html);
  await sgMail.send(msg);
  return true;
};

module.exports = {
  sendEmail,
  sendCommunityBroadcast,
  sendCustomBroadcast,
  sendMarketingEmail,
};
