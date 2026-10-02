const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const Mux = require('@mux/mux-node');

// Check if S3 credentials exist before initializing
const s3Config = {
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
};

// Initialize S3 client only if credentials are provided
const s3Client = process.env.S3_ACCESS_KEY ? new S3Client(s3Config) : null;

const getPresignedUrl = async (req, res, next) => {
  try {
    if (!s3Client) {
      return res.status(503).json({ error: 'Storage service is not configured.' });
    }

    const { filename, contentType } = req.body;
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/zip'];
    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Generate a secure unique path: /uploads/{userId}/{uuid}-{filename}
    // Clean filename to avoid issues
    const cleanFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `uploads/${req.user.id}/${uuidv4()}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: req.body.size, // Pass from frontend if available
    });

    // URL expires in 1 hour (3600 seconds)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Calculate final public URL based on endpoint/bucket
    // If using Cloudflare R2 or a custom domain, process.env.S3_PUBLIC_URL can be set
    const publicUrl = process.env.S3_PUBLIC_URL 
      ? `${process.env.S3_PUBLIC_URL}/${key}`
      : `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${key}`;

    res.json({ upload_url: signedUrl, public_url: publicUrl, key });
  } catch (err) {
    next(err);
  }
};

const getMuxUploadUrl = async (req, res, next) => {
  try {
    if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
      return res.status(503).json({ error: 'Mux is not configured.' });
    }
    
    // v14 uses new Mux(config) 
    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET
    });

    const upload = await mux.video.uploads.create({
      cors_origin: process.env.FRONTEND_URL || '*',
      new_asset_settings: {
        playback_policy: ['public'],
        video_quality: 'basic'
      }
    });

    res.json({ upload_url: upload.url, upload_id: upload.id });
  } catch (err) {
    next(err);
  }
};

const getMuxUploadStatus = async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
      return res.status(503).json({ error: 'Mux is not configured.' });
    }

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET
    });

    const upload = await mux.video.uploads.retrieve(uploadId);
    
    if (upload.status === 'asset_created' && upload.asset_id) {
      const asset = await mux.video.assets.retrieve(upload.asset_id);
      if (asset.playback_ids && asset.playback_ids.length > 0) {
        return res.json({
          status: 'ready',
          asset_id: asset.id,
          playback_id: asset.playback_ids[0].id
        });
      }
    }
    
    res.json({ status: upload.status }); // e.g. waiting, preparing
  } catch (err) {
    next(err);
  }
};

/**
 * Generate a short-lived presigned GET URL for a stored object key.
 * Used to securely deliver paid product downloads. Falls back to null when S3
 * isn't configured (caller can use a stored public URL instead).
 */
const getSignedDownloadUrl = async (key, filename) => {
  if (!s3Client || !key) return null;
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
  });
  return getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes
};

module.exports = { getPresignedUrl, getMuxUploadUrl, getMuxUploadStatus, getSignedDownloadUrl };
