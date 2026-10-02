const admin = require('firebase-admin');
const { query } = require('../db');
const sgMail = require('@sendgrid/mail');
const { getIo } = require('../socket');
const { enqueue } = require('../queue');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Initialize Firebase Admin if credentials are provided
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('🔥 Firebase Admin initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

/**
 * Fetch paginated notifications for the authenticated user
 */
const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    // Get unread count
    const unreadCount = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      unread_count: parseInt(unreadCount.rows[0].count, 10)
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Mark a specific notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE notifications SET is_read = true 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

/**
 * Mark all notifications as read for the authenticated user
 */
const markAllAsRead = async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

/**
 * Internal utility function to create a notification in DB and send push via Firebase.
 */
const sendNotification = async ({ userId, type, title, body, referenceId = null, communityId = null }) => {
  try {
    // 1. Save to Database
    const insertResult = await query(
      `INSERT INTO notifications (user_id, community_id, type, title, body, reference_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, communityId, type, title, body, referenceId]
    );
    const newNotif = insertResult.rows[0];

    // 1.5 Emit Socket event
    try {
      const io = getIo();
      io.to(userId).emit('new_notification', newNotif);
    } catch (err) {
      console.error('Socket emission failed for notification:', err.message);
    }

    // 2. Fetch User Settings, Email, & FCM Token
    const userResult = await query('SELECT email, notification_settings, fcm_token FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length) {
      const user = userResult.rows[0];
      const settings = user.notification_settings || {};
      
      // 3. Send Email based on settings
      if (process.env.SENDGRID_API_KEY && user.email) {
        let shouldEmail = false;
        if (type === 'comment_reply' && settings.email_replies) shouldEmail = true;
        if (type === 'post_like' && settings.email_replies) shouldEmail = true;
        if (type === 'mention' && settings.email_mentions) shouldEmail = true;

        if (shouldEmail) {
          // Resolve the community slug so the email links to a real route (/c/:slug)
          let link = process.env.FRONTEND_URL || '';
          if (communityId) {
            const slugRes = await query('SELECT slug FROM communities WHERE id = $1', [communityId]);
            if (slugRes.rows.length) link = `${process.env.FRONTEND_URL}/c/${slugRes.rows[0].slug}`;
          }
          await sgMail.send({
            to: user.email,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@komunity.app',
            subject: title,
            text: body,
            html: `<p>${body}</p><br/><a href="${link}">View in Komunity</a>`
          });
        }
      }
    }

    // 4. Send Push Notification if FCM is configured and token exists
    if (admin.apps.length > 0 && userResult.rows.length > 0 && userResult.rows[0].fcm_token) {
      await admin.messaging().send({
        token: userResult.rows[0].fcm_token,
        notification: {
          title,
          body,
        },
        data: {
          type,
          referenceId: referenceId || '',
          communityId: communityId || ''
        }
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

/**
 * POST /api/notifications/trigger-digest?frequency=weekly|daily
 * Cron endpoint that emails activity digests to users who have opted in.
 * Respects each user's notification_settings.email_digest preference.
 */
const triggerDigest = async (req, res, next) => {
  try {
    const frequency = req.query.frequency === 'daily' ? 'daily' : 'weekly';
    const intervalDays = frequency === 'daily' ? 1 : 7;

    // Only users whose digest preference matches this run
    const users = await query(
      `SELECT id, email, full_name FROM users
       WHERE COALESCE(notification_settings->>'email_digest', 'weekly') = $1`,
      [frequency]
    );

    // Enqueue one job per user — the worker builds + sends each digest off the
    // request path (with retries), so this endpoint returns immediately.
    await Promise.all(users.rows.map(u =>
      enqueue('emails', 'digest', {
        userId: u.id,
        email: u.email,
        name: u.full_name,
        frequency,
        intervalDays,
      })
    ));

    res.json({ message: 'Digest jobs queued', frequency, queued: users.rows.length });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  markAsRead,
  markAllAsRead,
  sendNotification,
  triggerDigest
};
