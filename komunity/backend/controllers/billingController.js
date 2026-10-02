const { query } = require('../db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { computeCommission } = require('../utils/money');
const PLATFORM_FEE_HOBBY = 0.10;
const PLATFORM_FEE_PRO = 0.029;

/**
 * Accrue an affiliate commission into the ledger for a successful payment.
 * Idempotent on (stripe_payment_id, referrer_id). Amount = payment * commission%.
 */
const accrueCommission = async ({ communityId, referrerId, referredUserId, amountPaidCents, currency = 'usd', source = 'subscription', stripePaymentId }) => {
  if (!communityId || !referrerId || referrerId === referredUserId || !amountPaidCents) return;

  const commRes = await query('SELECT affiliate_commission_percent FROM communities WHERE id = $1', [communityId]);
  const percent = Number(commRes.rows[0]?.affiliate_commission_percent || 0);

  const amount = computeCommission(amountPaidCents, percent);
  if (amount <= 0) return;

  await query(
    `INSERT INTO affiliate_commissions
       (community_id, referrer_id, referred_user_id, amount, currency, source, stripe_payment_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (stripe_payment_id, referrer_id) DO NOTHING`,
    [communityId, referrerId, referredUserId || null, amount.toFixed(2), currency, source, stripePaymentId]
  );
};

const createCheckout = async (req, res, next) => {
  try {
    const { communityId, tierId, interval = 'month', referrerId } = req.body;
    const comm = await query('SELECT * FROM communities WHERE id = $1', [communityId]);
    if (!comm.rows.length) return res.status(404).json({ error: 'Community not found' });
    const community = comm.rows[0];

    const annual = interval === 'year';
    let stripePriceId = annual ? community.stripe_annual_price_id : community.stripe_price_id;
    let trialDays = community.trial_period_days || 0;
    if (tierId) {
      const tier = await query(
        'SELECT stripe_price_id, stripe_annual_price_id, trial_period_days FROM community_tiers WHERE id = $1 AND community_id = $2',
        [tierId, communityId]
      );
      if (!tier.rows.length) return res.status(400).json({ error: 'Invalid tier' });
      stripePriceId = annual ? tier.rows[0].stripe_annual_price_id : tier.rows[0].stripe_price_id;
      trialDays = tier.rows[0].trial_period_days || 0;
      if (!stripePriceId) {
        return res.status(400).json({ error: annual ? 'This tier has no annual price' : 'Invalid tier or tier is free' });
      }
    } else if (!stripePriceId) {
      return res.status(400).json({ error: annual ? 'Community has no annual price' : 'Community has no default price' });
    }

    // Payouts require the creator to have completed Stripe Connect onboarding.
    if (!community.stripe_account_id || !community.charges_enabled) {
      return res.status(409).json({
        error: 'This community is not yet able to accept payments. The creator must finish payout setup.',
        code: 'connect_not_ready',
      });
    }

    const feePercent = community.plan === 'pro' ? PLATFORM_FEE_PRO * 100 : PLATFORM_FEE_HOBBY * 100;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true, // let members redeem coupon/promo codes created in Stripe
      line_items: [{
        price: stripePriceId,
        quantity: 1,
      }],
      subscription_data: {
        application_fee_percent: feePercent,
        transfer_data: { destination: community.stripe_account_id },
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        metadata: {
          community_id: communityId,
          user_id: req.user.id,
          tier_id: tierId || '',
          // Carry the referrer so recurring invoices can accrue affiliate commissions
          referrer_id: (referrerId && referrerId !== req.user.id) ? referrerId : '',
        },
      },
      success_url: `${process.env.FRONTEND_URL}/c/${community.slug}?joined=true`,
      cancel_url: `${process.env.FRONTEND_URL}/c/${community.slug}`,
      customer_email: req.user.email,
    });

    res.json({ checkout_url: session.url });
  } catch (err) { next(err); }
};

const createCourseCheckout = async (req, res, next) => {
  try {
    const { communityId, courseId } = req.body;
    const courseRes = await query(
      `SELECT co.id, co.title, co.price, c.slug AS community_slug,
              c.stripe_account_id, c.charges_enabled, c.plan, c.currency
       FROM courses co JOIN communities c ON c.id = co.community_id
       WHERE co.id = $1 AND co.community_id = $2`,
      [courseId, communityId]
    );
    if (!courseRes.rows.length) return res.status(404).json({ error: 'Course not found' });
    const course = courseRes.rows[0];

    if (!course.price || Number(course.price) <= 0) {
      return res.status(400).json({ error: 'This course does not have a one-time price' });
    }

    if (!course.stripe_account_id || !course.charges_enabled) {
      return res.status(409).json({
        error: 'This community is not yet able to accept payments. The creator must finish payout setup.',
        code: 'connect_not_ready',
      });
    }

    const feeRate = course.plan === 'pro' ? PLATFORM_FEE_PRO : PLATFORM_FEE_HOBBY;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true, // let buyers redeem coupon/promo codes created in Stripe
      line_items: [{
        price_data: {
          currency: course.currency || 'usd',
          product_data: { name: course.title },
          unit_amount: Math.round(Number(course.price) * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: Math.round(Number(course.price) * 100 * feeRate),
        transfer_data: { destination: course.stripe_account_id },
        metadata: {
          type: 'course_purchase',
          community_id: communityId,
          user_id: req.user.id,
          course_id: course.id,
        }
      },
      metadata: {
        type: 'course_purchase',
        community_id: communityId,
        user_id: req.user.id,
        course_id: course.id,
      },
      success_url: `${process.env.FRONTEND_URL}/c/${course.community_slug}/courses/${courseId}?purchased=true`,
      cancel_url: `${process.env.FRONTEND_URL}/c/${course.community_slug}/courses`,
      customer_email: req.user.email,
    });

    res.json({ checkout_url: session.url });
  } catch (err) { next(err); }
};

const createProductCheckout = async (req, res, next) => {
  try {
    const { communityId, productId } = req.body;
    const prodRes = await query(
      `SELECT pr.id, pr.name, pr.price, pr.currency, c.slug AS community_slug,
              c.stripe_account_id, c.charges_enabled, c.plan
       FROM products pr JOIN communities c ON c.id = pr.community_id
       WHERE pr.id = $1 AND pr.community_id = $2 AND pr.is_published = TRUE`,
      [productId, communityId]
    );
    if (!prodRes.rows.length) return res.status(404).json({ error: 'Product not found' });
    const product = prodRes.rows[0];

    if (!product.price || Number(product.price) <= 0) {
      return res.status(400).json({ error: 'This product is free — no checkout needed' });
    }
    if (!product.stripe_account_id || !product.charges_enabled) {
      return res.status(409).json({
        error: 'This community is not yet able to accept payments. The creator must finish payout setup.',
        code: 'connect_not_ready',
      });
    }

    const feeRate = product.plan === 'pro' ? PLATFORM_FEE_PRO : PLATFORM_FEE_HOBBY;
    const meta = { type: 'product_purchase', community_id: communityId, user_id: req.user.id, product_id: product.id };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: product.currency || 'usd',
          product_data: { name: product.name },
          unit_amount: Math.round(Number(product.price) * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: Math.round(Number(product.price) * 100 * feeRate),
        transfer_data: { destination: product.stripe_account_id },
        metadata: meta,
      },
      metadata: meta,
      success_url: `${process.env.FRONTEND_URL}/c/${product.community_slug}/store?purchased=${product.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/c/${product.community_slug}/store`,
      customer_email: req.user.email,
    });

    res.json({ checkout_url: session.url });
  } catch (err) { next(err); }
};

const createPortalSession = async (req, res, next) => {
  try {
    const user = await query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.user.id]);
    const customerId = user.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: 'No billing account found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });
    res.json({ portal_url: session.url });
  } catch (err) { next(err); }
};

const webhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        let metadata = session.metadata;

        // Handle one-off course purchase
        if (metadata && metadata.type === 'course_purchase') {
          const { user_id, course_id } = metadata;
          if (user_id && course_id) {
            await query(
              'INSERT INTO course_purchases (course_id, user_id, amount_paid) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [course_id, user_id, session.amount_total / 100]
            );
          }
          break;
        }

        // Handle one-off product purchase
        if (metadata && metadata.type === 'product_purchase') {
          const { user_id, product_id } = metadata;
          if (user_id && product_id) {
            const inserted = await query(
              'INSERT INTO product_purchases (product_id, user_id, amount_paid) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id',
              [product_id, user_id, session.amount_total / 100]
            );
            if (inserted.rows.length) {
              await query('UPDATE products SET purchase_count = purchase_count + 1 WHERE id = $1', [product_id]);
            }
          }
          break;
        }

        // Otherwise handle community subscription
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        
        if (!metadata || !metadata.community_id) {
          const subscription = await stripe.subscriptions.retrieve(subId);
          metadata = subscription.metadata;
        }

        const { community_id, user_id, tier_id, referrer_id } = metadata || {};
        if (!community_id || !user_id) break;

        const tierIdVal = tier_id ? tier_id : null;

        await query(
          `INSERT INTO community_members (community_id, user_id, stripe_subscription_id, subscription_status, tier_id)
           VALUES ($1, $2, $3, 'active', $4) ON CONFLICT (community_id, user_id)
           DO UPDATE SET stripe_subscription_id = $3, subscription_status = 'active', tier_id = $4`,
          [community_id, user_id, subId, tierIdVal]
        );

        await query(`
          UPDATE communities SET member_count = (
            SELECT COUNT(*) FROM community_members WHERE community_id = $1
          ) WHERE id = $1
        `, [community_id]);

        // Record the referral for paid joins so it appears on the affiliate dashboard.
        // (Commission accrual itself happens on invoice.paid.)
        if (referrer_id && referrer_id !== user_id) {
          await query(
            `INSERT INTO referrals (community_id, referrer_id, referred_user_id, status)
             VALUES ($1, $2, $3, 'completed')
             ON CONFLICT (community_id, referred_user_id) DO NOTHING`,
            [community_id, referrer_id, user_id]
          );
        }

        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await query(
          `UPDATE community_members SET subscription_status = 'cancelled', tier_id = NULL, cancelled_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await query(
          `UPDATE community_members SET subscription_status = 'past_due'
           WHERE stripe_subscription_id = $1`,
          [invoice.subscription]
        );
        break;
      }
      case 'invoice.paid': {
        // Accrue affiliate commission on every successful subscription payment
        // (initial + recurring). Referrer is read from the subscription metadata,
        // so accrual is independent of our DB write ordering.
        const invoice = event.data.object;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const meta = subscription.metadata || {};
        if (meta.referrer_id && meta.community_id) {
          await accrueCommission({
            communityId: meta.community_id,
            referrerId: meta.referrer_id,
            referredUserId: meta.user_id,
            amountPaidCents: invoice.amount_paid,
            currency: invoice.currency || 'usd',
            source: 'subscription',
            stripePaymentId: invoice.id,
          });
        }
        break;
      }
      case 'account.updated': {
        // Connected account finished (or changed) onboarding — sync payout readiness
        // for both community payouts and affiliate (user) payouts.
        const account = event.data.object;
        const ready = Boolean(account.charges_enabled && account.payouts_enabled);
        await query(`UPDATE communities SET charges_enabled = $1 WHERE stripe_account_id = $2`, [ready, account.id]);
        await query(`UPDATE users SET payouts_enabled = $1 WHERE stripe_account_id = $2`, [Boolean(account.payouts_enabled), account.id]);
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
};

const mySubscriptions = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cm.*, c.name, c.slug, c.icon_image, c.monthly_price
       FROM community_members cm JOIN communities c ON c.id = cm.community_id
       WHERE cm.user_id = $1 AND cm.subscription_status = 'active'`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

const creatorDashboard = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.id, c.name, c.slug, c.member_count, c.monthly_price,
              COUNT(DISTINCT cm.id) FILTER (WHERE cm.subscription_status = 'active') AS active_members,
              COUNT(DISTINCT cm.id) FILTER (WHERE cm.subscription_status = 'cancelled') AS churned_members,
              (COUNT(DISTINCT cm.id) FILTER (WHERE cm.subscription_status = 'active') * c.monthly_price) AS mrr,
              (SELECT COUNT(*) FROM posts WHERE community_id = c.id) AS total_posts,
              (SELECT COUNT(*) FROM comments cm2 
               JOIN posts p ON p.id = cm2.post_id 
               WHERE p.community_id = c.id) AS total_comments
       FROM communities c
       LEFT JOIN community_members cm ON cm.community_id = c.id
       WHERE c.owner_id = $1 GROUP BY c.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

/**
 * Start (or resume) Stripe Connect onboarding for a community the caller owns.
 * Creates an Express connected account if one doesn't exist, then returns an
 * account onboarding link for the creator to complete payout setup.
 */
const createConnectOnboarding = async (req, res, next) => {
  try {
    const { communityId } = req.body;
    const commRes = await query('SELECT id, owner_id, stripe_account_id, slug FROM communities WHERE id = $1', [communityId]);
    if (!commRes.rows.length) return res.status(404).json({ error: 'Community not found' });
    const community = commRes.rows[0];

    if (community.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the community owner can set up payouts' });
    }

    let accountId = community.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: req.user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: { name: community.slug },
        metadata: { community_id: communityId },
      });
      accountId = account.id;
      await query('UPDATE communities SET stripe_account_id = $1 WHERE id = $2', [accountId, communityId]);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/c/${community.slug}/admin?connect=refresh`,
      return_url: `${process.env.FRONTEND_URL}/c/${community.slug}/admin?connect=return`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) { next(err); }
};

/**
 * Return the current Connect payout-readiness for a community the caller owns.
 * Pulls live status from Stripe and caches charges_enabled on the community.
 */
const getConnectStatus = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const commRes = await query('SELECT id, owner_id, stripe_account_id, charges_enabled FROM communities WHERE id = $1', [communityId]);
    if (!commRes.rows.length) return res.status(404).json({ error: 'Community not found' });
    const community = commRes.rows[0];

    if (community.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the community owner can view payout status' });
    }

    if (!community.stripe_account_id) {
      return res.json({ connected: false, charges_enabled: false, payouts_enabled: false });
    }

    const account = await stripe.accounts.retrieve(community.stripe_account_id);
    const ready = Boolean(account.charges_enabled && account.payouts_enabled);

    if (ready !== community.charges_enabled) {
      await query('UPDATE communities SET charges_enabled = $1 WHERE id = $2', [ready, communityId]);
    }

    res.json({
      connected: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements_due: account.requirements?.currently_due || [],
    });
  } catch (err) { next(err); }
};

/**
 * Start/resume Stripe Connect onboarding for the logged-in user as an *affiliate*,
 * so they can receive commission payouts via Stripe Transfers.
 */
const createAffiliateOnboarding = async (req, res, next) => {
  try {
    const userRes = await query('SELECT stripe_account_id FROM users WHERE id = $1', [req.user.id]);
    let accountId = userRes.rows[0]?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: req.user.email,
        capabilities: { transfers: { requested: true } },
        metadata: { user_id: req.user.id, role: 'affiliate' },
      });
      accountId = account.id;
      await query('UPDATE users SET stripe_account_id = $1 WHERE id = $2', [accountId, req.user.id]);
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.FRONTEND_URL}/settings?affiliate_connect=refresh`,
      return_url: `${process.env.FRONTEND_URL}/settings?affiliate_connect=return`,
      type: 'account_onboarding',
    });
    res.json({ url: accountLink.url });
  } catch (err) { next(err); }
};

const getAffiliateConnectStatus = async (req, res, next) => {
  try {
    const userRes = await query('SELECT stripe_account_id, payouts_enabled FROM users WHERE id = $1', [req.user.id]);
    const acct = userRes.rows[0];
    if (!acct?.stripe_account_id) return res.json({ connected: false, payouts_enabled: false });

    const account = await stripe.accounts.retrieve(acct.stripe_account_id);
    const payouts = Boolean(account.payouts_enabled);
    if (payouts !== acct.payouts_enabled) {
      await query('UPDATE users SET payouts_enabled = $1 WHERE id = $2', [payouts, req.user.id]);
    }
    res.json({ connected: true, payouts_enabled: payouts, details_submitted: account.details_submitted });
  } catch (err) { next(err); }
};

module.exports = { createCheckout, createCourseCheckout, createProductCheckout, createPortalSession, webhook, mySubscriptions, creatorDashboard, createConnectOnboarding, getConnectStatus, createAffiliateOnboarding, getAffiliateConnectStatus };
