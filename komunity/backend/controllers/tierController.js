const { query } = require('../db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const listTiers = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      'SELECT * FROM community_tiers WHERE community_id = $1 ORDER BY price ASC',
      [communityId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

const createTier = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { name, description, price, features, annual_price = 0, trial_period_days = 0 } = req.body;

    // Verify user owns the community
    const comm = await query('SELECT owner_id, name, currency FROM communities WHERE id = $1', [communityId]);
    if (!comm.rows.length || comm.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to manage tiers for this community' });
    }
    const currency = (comm.rows[0].currency || 'usd').toLowerCase();

    let stripe_product_id = null;
    let stripe_price_id = null;
    let stripe_annual_price_id = null;

    if (price > 0 && process.env.STRIPE_SECRET_KEY) {
      const product = await stripe.products.create({
        name: `${comm.rows[0].name} - ${name} Tier`,
        description: description || `Access to the ${name} tier`,
        metadata: { community_id: communityId },
      });
      stripe_product_id = product.id;

      const stripePrice = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(price * 100),
        currency,
        recurring: { interval: 'month' },
      });
      stripe_price_id = stripePrice.id;

      // Optional annual price on the same product
      if (annual_price > 0) {
        const annualPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(annual_price * 100),
          currency,
          recurring: { interval: 'year' },
        });
        stripe_annual_price_id = annualPrice.id;
      }
    }

    const result = await query(
      `INSERT INTO community_tiers (community_id, name, description, price, stripe_product_id, stripe_price_id, features, annual_price, stripe_annual_price_id, trial_period_days, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [communityId, name, description, price, stripe_product_id, stripe_price_id, JSON.stringify(features || []), annual_price || 0, stripe_annual_price_id, trial_period_days || 0, currency]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

const updateTier = async (req, res, next) => {
  try {
    const { communityId, tierId } = req.params;
    const { name, description, features } = req.body; // Price cannot be changed once created (Stripe limitation)

    const comm = await query('SELECT owner_id FROM communities WHERE id = $1', [communityId]);
    if (!comm.rows.length || comm.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await query(
      `UPDATE community_tiers SET name = $1, description = $2, features = $3 
       WHERE id = $4 AND community_id = $5 RETURNING *`,
      [name, description, JSON.stringify(features || []), tierId, communityId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Tier not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const deleteTier = async (req, res, next) => {
  try {
    const { communityId, tierId } = req.params;

    const comm = await query('SELECT owner_id FROM communities WHERE id = $1', [communityId]);
    if (!comm.rows.length || comm.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Guard: prevent deleting a tier that has active subscribers
    const activeMembers = await query(
      'SELECT COUNT(*) FROM community_members WHERE tier_id = $1 AND community_id = $2 AND status = $3',
      [tierId, communityId, 'active']
    );
    if (parseInt(activeMembers.rows[0].count, 10) > 0) {
      return res.status(409).json({
        error: `Cannot delete this tier — ${activeMembers.rows[0].count} active member(s) are subscribed. Move or cancel them first.`
      });
    }

    // Optional: Archive tier instead of hard delete, or check if it has members.
    // For simplicity, we just delete it. In Stripe, we should probably archive the product/price.
    const tier = await query('SELECT stripe_product_id, stripe_price_id FROM community_tiers WHERE id = $1 AND community_id = $2', [tierId, communityId]);
    if (tier.rows.length && tier.rows[0].stripe_product_id && process.env.STRIPE_SECRET_KEY) {
      try {
        await stripe.products.update(tier.rows[0].stripe_product_id, { active: false });
        if (tier.rows[0].stripe_price_id) {
          await stripe.prices.update(tier.rows[0].stripe_price_id, { active: false });
        }
      } catch (stripeErr) {
        console.error('Failed to archive stripe product:', stripeErr);
      }
    }

    const result = await query('DELETE FROM community_tiers WHERE id = $1 AND community_id = $2 RETURNING id', [tierId, communityId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Tier not found' });

    res.json({ message: 'Tier deleted' });
  } catch (err) { next(err); }
};

module.exports = { listTiers, createTier, updateTier, deleteTier };
