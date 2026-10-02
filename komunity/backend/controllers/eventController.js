// controllers/eventController.js
const { query } = require('../db');

const list = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { upcoming = true } = req.query;
    const filter = upcoming === 'true' ? 'AND e.starts_at >= NOW()' : '';
    const result = await query(
      `SELECT e.*, u.full_name AS creator_name, u.avatar_url AS creator_avatar,
              EXISTS(SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = $2) AS rsvped
       FROM events e JOIN users u ON u.id = e.creator_id
       WHERE e.community_id = $1 AND e.is_cancelled = FALSE ${filter}
       ORDER BY e.starts_at ASC`,
      [communityId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const result = await query(
      `SELECT e.*, u.full_name AS creator_name,
              EXISTS(SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = $2) AS rsvped
       FROM events e JOIN users u ON u.id = e.creator_id WHERE e.id = $1`,
      [eventId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { title, description, starts_at, ends_at, timezone, max_attendees, cover_image, is_webinar } = req.body;
    const result = await query(
      `INSERT INTO events (community_id, creator_id, title, description, starts_at, ends_at, timezone, max_attendees, cover_image, is_webinar)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [communityId, req.user.id, title, description, starts_at, ends_at, timezone ?? 'UTC', max_attendees ?? 50, cover_image, is_webinar ?? false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { title, description, starts_at, ends_at, cover_image } = req.body;
    const result = await query(
      `UPDATE events SET title = COALESCE($1,title), description = COALESCE($2,description),
       starts_at = COALESCE($3,starts_at), ends_at = COALESCE($4,ends_at),
       cover_image = COALESCE($5,cover_image) WHERE id = $6 RETURNING *`,
      [title, description, starts_at, ends_at, cover_image, eventId]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const cancel = async (req, res, next) => {
  try {
    await query('UPDATE events SET is_cancelled = TRUE WHERE id = $1', [req.params.eventId]);
    res.json({ message: 'Event cancelled' });
  } catch (err) { next(err); }
};

const rsvp = async (req, res, next) => {
  try {
    const { eventId, communityId } = req.params;
    const insertResult = await query(
      'INSERT INTO event_rsvps (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
      [eventId, req.user.id]
    );

    // Only increment and award points if a new RSVP was actually created
    if (insertResult.rows.length > 0) {
      await query('UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = $1', [eventId]);

      // Award event_attend points (#5)
      const { awardPoints, checkAndAwardBadges } = require('../utils/points');
      await awardPoints(null, communityId, req.user.id, 'event_attend', eventId);
      await checkAndAwardBadges(null, communityId, req.user.id);
    }

    res.json({ rsvped: true });
  } catch (err) { next(err); }
};

const unrsvp = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    await query('DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2', [eventId, req.user.id]);
    await query('UPDATE events SET rsvp_count = GREATEST(rsvp_count - 1, 0) WHERE id = $1', [eventId]);
    res.json({ rsvped: false });
  } catch (err) { next(err); }
};

const createRoom = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (!event.rows.length) return res.status(404).json({ error: 'Event not found' });

    // Create Daily.co room
    const properties = {
      max_participants: event.rows[0].max_attendees,
      exp: Math.floor(new Date(event.rows[0].ends_at).getTime() / 1000) + 3600,
      enable_recording: 'cloud',
    };

    if (event.rows[0].is_webinar) {
      properties.owner_only_broadcast = true;
      properties.enable_chat = true;
    }

    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `komunity-event-${eventId}`,
        properties,
      }),
    });
    const room = await response.json();
    await query('UPDATE events SET daily_room_url = $1 WHERE id = $2', [room.url, eventId]);
    res.json({ room_url: room.url });
  } catch (err) { next(err); }
};

module.exports = { list, get, create, update, cancel, rsvp, unrsvp, createRoom };
