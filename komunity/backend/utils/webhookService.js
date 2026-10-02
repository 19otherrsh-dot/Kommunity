const { query } = require('../db');
const { enqueue } = require('../queue');

/**
 * Dispatches a webhook event to all active endpoints registered for a community.
 * Each delivery is enqueued as a background job with automatic retries + backoff
 * (falls back to inline delivery when the queue is unavailable).
 * @param {string} communityId - The ID of the community
 * @param {string} eventType - The event type (e.g. 'member.joined', 'post.created')
 * @param {object} payload - The payload data for the webhook
 */
const dispatchEvent = async (communityId, eventType, payload) => {
  try {
    const result = await query(
      `SELECT id, endpoint_url, events, secret
       FROM webhooks
       WHERE community_id = $1 AND is_active = TRUE`,
      [communityId]
    );

    const webhooks = result.rows.filter(wh =>
      !wh.events || wh.events.length === 0 || wh.events.includes(eventType)
    );
    if (webhooks.length === 0) return;

    const requestBody = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    await Promise.all(webhooks.map(wh =>
      enqueue('webhooks', 'deliver', {
        webhook_id: wh.id,
        community_id: communityId,
        event: eventType,
        endpoint_url: wh.endpoint_url,
        secret: wh.secret,
        requestBody,
      })
    ));
  } catch (error) {
    console.error(`[Webhook Error] Failed to enqueue webhooks for ${communityId}:`, error);
  }
};

module.exports = {
  dispatchEvent
};
