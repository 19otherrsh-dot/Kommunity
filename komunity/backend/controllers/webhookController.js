const { query } = require('../db');
const { verifyMuxSignature, verifyDailySignature } = require('../utils/webhookVerify');

const list = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      'SELECT id, endpoint_url, events, is_active, consecutive_failures, created_at FROM webhooks WHERE community_id = $1 ORDER BY created_at DESC',
      [communityId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Recent delivery attempts for a webhook (admin visibility into the retry system)
const listDeliveries = async (req, res, next) => {
  try {
    const { communityId, webhookId } = req.params;
    const result = await query(
      `SELECT d.event, d.status, d.status_code, d.error, d.created_at
       FROM webhook_deliveries d
       JOIN webhooks w ON w.id = d.webhook_id
       WHERE d.webhook_id = $1 AND w.community_id = $2
       ORDER BY d.created_at DESC LIMIT 25`,
      [webhookId, communityId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { endpoint_url, events, secret } = req.body;
    
    if (!endpoint_url) return res.status(400).json({ error: 'endpoint_url is required' });

    const result = await query(
      `INSERT INTO webhooks (community_id, endpoint_url, events, secret) 
       VALUES ($1, $2, $3, $4) RETURNING id, endpoint_url, events, is_active, created_at`,
      [communityId, endpoint_url, events ? JSON.stringify(events) : '[]', secret]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { communityId, webhookId } = req.params;
    const { endpoint_url, events, secret, is_active } = req.body;
    
    const result = await query(
      `UPDATE webhooks SET 
        endpoint_url = COALESCE($1, endpoint_url),
        events = COALESCE($2, events),
        secret = COALESCE($3, secret),
        is_active = COALESCE($4, is_active)
       WHERE id = $5 AND community_id = $6
       RETURNING id, endpoint_url, events, is_active, created_at`,
      [endpoint_url, events ? JSON.stringify(events) : null, secret, is_active, webhookId, communityId]
    );
    
    if (!result.rows.length) return res.status(404).json({ error: 'Webhook not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { communityId, webhookId } = req.params;
    await query('DELETE FROM webhooks WHERE id = $1 AND community_id = $2', [webhookId, communityId]);
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    next(err);
  }
};

const muxWebhook = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    if (!verifyMuxSignature(rawBody, req.headers['mux-signature'], process.env.MUX_WEBHOOK_SECRET)) {
      return res.status(400).json({ error: 'Invalid Mux signature' });
    }

    const event = JSON.parse(rawBody);

    // When an asset finishes encoding, publish the lesson it belongs to.
    if (event.type === 'video.asset.ready') {
      const asset = event.data;
      const playbackId = asset.playback_ids?.[0]?.id;
      const uploadId = asset.upload_id;
      const duration = asset.duration ? Math.round(asset.duration) : 0;

      if (playbackId && uploadId) {
        // Lessons are created with mux_asset_id = the upload id; swap in the real
        // playback id + asset id and publish the lesson now that video is ready.
        await query(
          `UPDATE lessons
             SET video_url = $1, mux_asset_id = $2, duration_seconds = $3, is_published = TRUE, updated_at = NOW()
           WHERE mux_asset_id = $4`,
          [playbackId, asset.id, duration, uploadId]
        );
        console.log(`[Mux] Asset ready: published lesson for upload ${uploadId}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Mux webhook] error:', err.message);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
};

const dailyWebhook = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    if (!verifyDailySignature(rawBody, req.headers['x-webhook-signature'], process.env.DAILY_WEBHOOK_SECRET)) {
      return res.status(400).json({ error: 'Invalid Daily signature' });
    }

    const event = JSON.parse(rawBody);

    // When a recording is ready, attach it to the matching event.
    if (event.type === 'recording.ready-to-download' || event.type === 'recording.finished') {
      const payload = event.payload || {};
      const roomName = payload.room_name;
      const recordingUrl = payload.download_link || payload.s3_key || payload.recording_id || null;

      if (roomName && recordingUrl) {
        await query(
          `UPDATE events SET recording_url = $1
           WHERE daily_room_url LIKE '%' || $2`,
          [recordingUrl, '/' + roomName]
        );
        console.log(`[Daily] Recording attached for room ${roomName}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Daily webhook] error:', err.message);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
};

module.exports = { list, listDeliveries, create, update, remove, muxWebhook, dailyWebhook };
