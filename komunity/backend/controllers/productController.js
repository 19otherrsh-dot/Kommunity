const { query } = require('../db');
const { getSignedDownloadUrl } = require('./uploadController');

// ─── List products (members) ──────────────────────────────────────────────────
const listProducts = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT p.id, p.name, p.description, p.price, p.currency, p.thumbnail_url,
              p.is_published, p.purchase_count, p.created_at,
              EXISTS(SELECT 1 FROM product_purchases pp WHERE pp.product_id = p.id AND pp.user_id = $2) AS is_purchased
       FROM products p
       WHERE p.community_id = $1 AND p.is_published = TRUE
       ORDER BY p.created_at DESC`,
      [communityId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// Admin listing includes drafts
const listAllProducts = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const result = await query(
      `SELECT p.*, EXISTS(SELECT 1 FROM product_purchases pp WHERE pp.product_id = p.id AND pp.user_id = $2) AS is_purchased
       FROM products p WHERE p.community_id = $1 ORDER BY p.created_at DESC`,
      [communityId, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { name, description, price, currency, file_url, file_key, thumbnail_url, is_published } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const commRes = await query('SELECT currency FROM communities WHERE id = $1', [communityId]);
    const cur = (currency || commRes.rows[0]?.currency || 'usd').toLowerCase();

    const result = await query(
      `INSERT INTO products (community_id, creator_id, name, description, price, currency, file_url, file_key, thumbnail_url, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [communityId, req.user.id, name, description || null, price || 0, cur, file_url || null, file_key || null, thumbnail_url || null, Boolean(is_published)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { communityId, productId } = req.params;
    const { name, description, price, file_url, file_key, thumbnail_url, is_published } = req.body;
    const result = await query(
      `UPDATE products SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        file_url = COALESCE($4, file_url),
        file_key = COALESCE($5, file_key),
        thumbnail_url = COALESCE($6, thumbnail_url),
        is_published = COALESCE($7, is_published),
        updated_at = NOW()
       WHERE id = $8 AND community_id = $9 RETURNING *`,
      [name, description, price, file_url, file_key, thumbnail_url,
       typeof is_published === 'boolean' ? is_published : null, productId, communityId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { communityId, productId } = req.params;
    await query('DELETE FROM products WHERE id = $1 AND community_id = $2', [productId, communityId]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Secure download (purchasers, owners of free products, or admins) ──────────
const getDownload = async (req, res, next) => {
  try {
    const { communityId, productId } = req.params;
    const prodRes = await query(
      'SELECT id, name, price, file_url, file_key FROM products WHERE id = $1 AND community_id = $2',
      [productId, communityId]
    );
    if (!prodRes.rows.length) return res.status(404).json({ error: 'Product not found' });
    const product = prodRes.rows[0];

    const isAdmin = ['admin', 'moderator'].includes(req.membership?.role);
    const isFree = Number(product.price) <= 0;
    let allowed = isAdmin || isFree;
    if (!allowed) {
      const purchase = await query(
        'SELECT 1 FROM product_purchases WHERE product_id = $1 AND user_id = $2',
        [productId, req.user.id]
      );
      allowed = purchase.rows.length > 0;
    }
    if (!allowed) return res.status(403).json({ error: 'Purchase required to download this product' });

    // Prefer a short-lived presigned URL (private bucket); fall back to a stored URL
    const filename = `${product.name}`.replace(/[^a-z0-9.\-_]/gi, '_');
    const signed = await getSignedDownloadUrl(product.file_key, filename);
    const url = signed || product.file_url;
    if (!url) return res.status(404).json({ error: 'This product has no downloadable file' });

    res.json({ url });
  } catch (err) {
    next(err);
  }
};

module.exports = { listProducts, listAllProducts, createProduct, updateProduct, deleteProduct, getDownload };
