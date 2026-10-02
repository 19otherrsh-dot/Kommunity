const { query } = require('../db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Admin only
const getConfig = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      'SELECT affiliate_commission_percent FROM communities WHERE id = $1',
      [communityId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateConfig = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { affiliate_commission_percent } = req.body;
    const result = await query(
      'UPDATE communities SET affiliate_commission_percent = $1 WHERE id = $2 RETURNING affiliate_commission_percent',
      [affiliate_commission_percent, communityId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT r.referrer_id, u.full_name, u.avatar_url, COUNT(r.id) as referral_count, SUM(r.reward_points) as total_earned
       FROM referrals r
       JOIN users u ON u.id = r.referrer_id
       WHERE r.community_id = $1 AND r.status = 'completed'
       GROUP BY r.referrer_id, u.full_name, u.avatar_url
       ORDER BY referral_count DESC
       LIMIT 50`,
      [communityId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Any member
const getMyStats = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT COUNT(id) as referral_count, COALESCE(SUM(reward_points), 0) as total_earned
       FROM referrals
       WHERE community_id = $1 AND referrer_id = $2 AND status = 'completed'`,
      [communityId, req.user.id]
    );
    
    const recentRes = await query(
      `SELECT r.created_at, u.full_name, u.avatar_url
       FROM referrals r
       JOIN users u ON u.id = r.referred_user_id
       WHERE r.community_id = $1 AND r.referrer_id = $2 AND r.status = 'completed'
       ORDER BY r.created_at DESC LIMIT 5`,
      [communityId, req.user.id]
    );

    const comm = await query(
      'SELECT affiliate_commission_percent FROM communities WHERE id = $1',
      [communityId]
    );

    // Monetary commission earnings (from the affiliate_commissions ledger)
    const moneyRes = await query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)    AS commission_paid,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS commission_pending,
         COALESCE(SUM(amount) FILTER (WHERE status IN ('paid','pending')), 0) AS commission_total
       FROM affiliate_commissions
       WHERE community_id = $1 AND referrer_id = $2`,
      [communityId, req.user.id]
    );

    res.json({
      stats: result.rows[0],
      recent: recentRes.rows,
      commissionPercent: comm.rows[0].affiliate_commission_percent,
      earnings: moneyRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// Admin: commissions owed to affiliates, grouped by referrer
const getOwedCommissions = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT r.referrer_id, u.full_name, u.email, u.avatar_url,
              COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'pending'), 0) AS pending_amount,
              COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'paid'), 0)    AS paid_amount,
              COUNT(*) FILTER (WHERE r.status = 'pending')                   AS pending_count
       FROM affiliate_commissions r
       JOIN users u ON u.id = r.referrer_id
       WHERE r.community_id = $1
       GROUP BY r.referrer_id, u.full_name, u.email, u.avatar_url
       HAVING COALESCE(SUM(r.amount) FILTER (WHERE r.status = 'pending'), 0) > 0
       ORDER BY pending_amount DESC`,
      [communityId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Admin: pay out a referrer's pending commissions.
// If the affiliate has completed Stripe Connect onboarding, money is sent
// automatically via a Stripe Transfer; otherwise it's marked paid (manual/off-platform).
const markCommissionsPaid = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { referrerId } = req.body;
    if (!referrerId) return res.status(400).json({ error: 'referrerId is required' });

    // Sum the pending amount + currency for this affiliate in this community
    const pending = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total, MIN(currency) AS currency, COUNT(*) AS count
       FROM affiliate_commissions
       WHERE community_id = $1 AND referrer_id = $2 AND status = 'pending'`,
      [communityId, referrerId]
    );
    const total = Number(pending.rows[0].total);
    const currency = pending.rows[0].currency || 'usd';
    if (total <= 0) return res.json({ message: 'Nothing to pay out', count: 0 });

    // Attempt an automatic Stripe Transfer if the affiliate is onboarded
    const affiliate = await query('SELECT stripe_account_id, payouts_enabled FROM users WHERE id = $1', [referrerId]);
    const acct = affiliate.rows[0];
    let transferId = null;

    if (acct?.stripe_account_id && acct.payouts_enabled && process.env.STRIPE_SECRET_KEY) {
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(total * 100),
          currency,
          destination: acct.stripe_account_id,
          metadata: { community_id: communityId, referrer_id: referrerId, type: 'affiliate_commission' },
        });
        transferId = transfer.id;
      } catch (stripeErr) {
        return res.status(402).json({ error: `Stripe transfer failed: ${stripeErr.message}` });
      }
    }

    const result = await query(
      `UPDATE affiliate_commissions
       SET status = 'paid', paid_at = NOW(), stripe_transfer_id = COALESCE($3, stripe_transfer_id)
       WHERE community_id = $1 AND referrer_id = $2 AND status = 'pending'
       RETURNING id`,
      [communityId, referrerId, transferId]
    );

    res.json({
      message: transferId
        ? `Transferred ${currency.toUpperCase()} ${total.toFixed(2)} and marked ${result.rows.length} commission(s) paid`
        : `Marked ${result.rows.length} commission(s) as paid (manual payout — affiliate not onboarded)`,
      count: result.rows.length,
      transfer_id: transferId,
      auto: Boolean(transferId),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConfig, updateConfig, getLeaderboard, getMyStats, getOwedCommissions, markCommissionsPaid };
