const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const { query } = require('../db');
const { redisClient } = require('../db/redis');
const crypto = require('crypto');
const emailService = require('../utils/emailService');

const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// httpOnly cookie keeps the JWT out of reach of XSS/JS. Sent automatically with
// every same-site request (frontend uses withCredentials). The token is still
// returned in the JSON body for the socket.io handshake and API clients.
const AUTH_COOKIE = 'access_token';
// Secure cookies require HTTPS. Default to secure in production, but allow an
// explicit override (COOKIE_SECURE=false) for single-origin HTTP testing.
const cookieSecure = () =>
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
const authCookieOptions = () => ({
  httpOnly: true,
  secure: cookieSecure(),
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
});
const setAuthCookie = (res, token) => res.cookie(AUTH_COOKIE, token, authCookieOptions());
const clearAuthCookie = (res) => res.clearCookie(AUTH_COOKIE, { path: '/' });

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, full_name, ref } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already in use' });

    const password_hash = await bcrypt.hash(password, 12);
    let referred_by_id = null;
    if (ref) {
      const refCheck = await query('SELECT id FROM users WHERE id = $1', [ref]);
      if (refCheck.rows.length > 0) {
        referred_by_id = ref;
      }
    }

    const result = await query(
      'INSERT INTO users (email, password_hash, full_name, referred_by_id) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, created_at',
      [email, password_hash, full_name, referred_by_id]
    );

    const user = result.rows[0];
    const token = signToken(user.id);
    setAuthCookie(res, token);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user.id);
    setAuthCookie(res, token);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    // Accept the current token from the httpOnly cookie or the Authorization header
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
    const token = req.cookies?.[AUTH_COOKIE] || headerToken;
    if (!token) return res.status(401).json({ error: 'No token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const newToken = signToken(payload.sub);
    setAuthCookie(res, newToken);
    res.json({ token: newToken });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;
    const token = req.cookies?.[AUTH_COOKIE] || headerToken;
    if (token) {
      const payload = jwt.decode(token);
      if (payload && payload.exp && redisClient.isOpen) {
        const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          // Blocklist this token until it would have expired
          await redisClient.setEx(`blocklist:${token}`, expiresIn, 'revoked');
        }
      }
    }
    clearAuthCookie(res);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    // req.user is already attached by authenticate middleware
    // Enrich with community memberships
    const memberships = await query(
      `SELECT cm.community_id, cm.role, cm.points, cm.level, c.name, c.slug, c.icon_image
       FROM community_members cm
       JOIN communities c ON c.id = cm.community_id
       WHERE cm.user_id = $1`,
      [req.user.id]
    );
    res.json({ ...req.user, memberships: memberships.rows });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { full_name, bio, avatar_url, website_url, twitter_url, linkedin_url, notification_settings } = req.body;
    const result = await query(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        bio = COALESCE($2, bio),
        avatar_url = COALESCE($3, avatar_url),
        website_url = COALESCE($4, website_url),
        twitter_url = COALESCE($5, twitter_url),
        linkedin_url = COALESCE($6, linkedin_url),
        notification_settings = COALESCE($7, notification_settings),
        updated_at = NOW()
       WHERE id = $8
       RETURNING id, email, full_name, bio, avatar_url, website_url, twitter_url, linkedin_url, role, notification_settings`,
      [full_name, bio, avatar_url, website_url, twitter_url, linkedin_url, notification_settings, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const userResult = await query('SELECT id, full_name FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      // Return success anyway to prevent email enumeration
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = userResult.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [hashedToken, expiresAt, user.id]
    );

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;

    await emailService.sendEmail({
      to: email,
      subject: 'Reset your Komunity Password',
      html: `
        <p>Hi ${user.full_name},</p>
        <p>You requested a password reset. Click the link below to reset it:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
      `,
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token, and new password are required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const userResult = await query(
      'SELECT id FROM users WHERE email = $1 AND reset_token = $2 AND reset_token_expires > NOW()',
      [email, hashedToken]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token is invalid or has expired' });
    }

    const user = userResult.rows[0];
    const password_hash = await bcrypt.hash(newPassword, 12);

    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
      [password_hash, user.id]
    );

    res.json({ message: 'Password reset successfully. Please log in again.' });
  } catch (err) {
    next(err);
  }
};

const admin = require('firebase-admin');

// Initialize Firebase Admin safely if credentials exist
try {
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } else if (!admin.apps.length) {
    // Attempt default initialization
    admin.initializeApp();
  }
} catch (e) {
  console.log('Firebase admin init error:', e.message);
}

const socialLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    // Verify token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { email, name, picture, uid } = decodedToken;

    // Check if user exists
    let result = await query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (result.rows.length === 0) {
      // Create user
      const placeholderPassword = await bcrypt.hash(uuidv4(), 12); // random secure password
      const insertResult = await query(
        'INSERT INTO users (email, password_hash, full_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, avatar_url, role, created_at',
        [email, placeholderPassword, name || 'User', picture]
      );
      user = insertResult.rows[0];
    } else {
      user = result.rows[0];
      const { password_hash, ...safeUser } = user;
      user = safeUser;
    }

    const appToken = signToken(user.id);
    setAuthCookie(res, appToken);
    res.json({ token: appToken, user });
  } catch (err) {
    next(err);
  }
};

const saveFcmToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'FCM token is required' });

    await query('UPDATE users SET fcm_token = $1 WHERE id = $2', [token, req.user.id]);
    res.json({ message: 'FCM token saved successfully' });
  } catch (err) {
    next(err);
  }
};

const getPlatformAffiliates = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Get total referred users
    const referredUsersRes = await query(
      'SELECT id, full_name, email, created_at FROM users WHERE referred_by_id = $1',
      [userId]
    );
    const referredUsers = referredUsersRes.rows;
    const referredUserIds = referredUsers.map(u => u.id);

    // 2. Get communities created by those referred users and calculate estimated MRR
    let communities = [];
    let estimated_mrr = 0;
    
    if (referredUserIds.length > 0) {
      const commRes = await query(
        `SELECT id, name, slug, member_count, monthly_price, plan, created_at, owner_id
         FROM communities
         WHERE owner_id = ANY($1::uuid[]) AND is_active = TRUE`,
        [referredUserIds]
      );
      communities = commRes.rows;

      communities.forEach(comm => {
        const platformFeeRate = comm.plan === 'pro' ? 0.029 : 0.10;
        const commMRR = (comm.member_count || 0) * Number(comm.monthly_price || 0);
        const platformFee = commMRR * platformFeeRate;
        // Referrer gets 40% of the platform fee
        const partnerCut = platformFee * 0.40;
        estimated_mrr += partnerCut;
      });
    }

    res.json({
      total_referred_users: referredUsers.length,
      total_referred_communities: communities.length,
      estimated_mrr,
      referred_users: referredUsers,
      communities,
      referral_link: `${process.env.FRONTEND_URL}/register?ref=${userId}`
    });
  } catch (err) {
    next(err);
  }
};

// ─── Email preferences (digest frequency + per-community newsletter opt-in) ───
const getEmailPreferences = async (req, res, next) => {
  try {
    const userRes = await query('SELECT email, notification_settings FROM users WHERE id = $1', [req.user.id]);
    const email = userRes.rows[0]?.email;
    const digest = userRes.rows[0]?.notification_settings?.email_digest || 'weekly';

    // Communities the user belongs to, with effective newsletter state
    // (subscribed = wants_newsletter AND not suppressed globally or for that community)
    const comms = await query(
      `SELECT c.id, c.name, c.slug, cm.wants_newsletter,
              EXISTS(
                SELECT 1 FROM email_suppressions s
                WHERE s.email = $2 AND (s.community_id IS NULL OR s.community_id = c.id)
              ) AS suppressed
       FROM community_members cm
       JOIN communities c ON c.id = cm.community_id
       WHERE cm.user_id = $1 AND cm.status = 'active'
       ORDER BY c.name`,
      [req.user.id, email]
    );

    res.json({
      digest,
      communities: comms.rows.map(c => ({
        id: c.id, name: c.name, slug: c.slug,
        subscribed: c.wants_newsletter && !c.suppressed,
      })),
    });
  } catch (err) {
    next(err);
  }
};

const updateEmailPreferences = async (req, res, next) => {
  try {
    const { digest, community_id, subscribed } = req.body;

    if (digest !== undefined) {
      if (!['weekly', 'daily', 'off'].includes(digest)) {
        return res.status(400).json({ error: 'digest must be weekly, daily, or off' });
      }
      await query(
        `UPDATE users SET notification_settings = jsonb_set(COALESCE(notification_settings, '{}'), '{email_digest}', to_jsonb($1::text)) WHERE id = $2`,
        [digest, req.user.id]
      );
    }

    if (community_id !== undefined && subscribed !== undefined) {
      const emailRes = await query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      const email = emailRes.rows[0]?.email;
      await query(
        'UPDATE community_members SET wants_newsletter = $1 WHERE user_id = $2 AND community_id = $3',
        [Boolean(subscribed), req.user.id, community_id]
      );
      if (subscribed) {
        // Explicit opt-in clears any prior suppression (community-scoped or global)
        await query(
          `DELETE FROM email_suppressions WHERE email = $1 AND (community_id = $2 OR community_id IS NULL)`,
          [email, community_id]
        );
      } else {
        await query(
          `INSERT INTO email_suppressions (email, community_id, reason) VALUES ($1, $2, 'preference')
           ON CONFLICT (email, community_id) DO NOTHING`,
          [email, community_id]
        );
      }
    }

    res.json({ message: 'Email preferences updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, me, updateProfile, forgotPassword, resetPassword, socialLogin, saveFcmToken, getPlatformAffiliates, getEmailPreferences, updateEmailPreferences };
