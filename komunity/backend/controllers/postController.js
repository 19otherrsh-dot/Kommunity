const { query, getClient } = require('../db');
const webhookService = require('../utils/webhookService');
const { awardPoints, checkAndAwardBadges } = require('../utils/points');
const { sendNotification } = require('./notificationController');
const emailService = require('../utils/emailService');
const ai = require('../utils/ai');


const list = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { page = 1, limit = 20, pinned_first = true, space_id } = req.query;
    const offset = (page - 1) * limit;

    // Filter by space_id if provided
    const spaceFilter = space_id ? 'AND p.space_id = $5' : '';
    const params = space_id
      ? [communityId, limit, req.user.id, offset, space_id]
      : [communityId, limit, req.user.id, offset];

    const result = await query(
      `SELECT p.*, u.full_name AS author_name, u.avatar_url AS author_avatar,
              cm.level AS author_level,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $3) AS liked_by_me,
              (SELECT option_id FROM post_poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $3) AS poll_voted_option_id
       FROM posts p
       JOIN users u ON u.id = p.author_id
       JOIN community_members cm ON cm.community_id = p.community_id AND cm.user_id = p.author_id
       WHERE p.community_id = $1 ${spaceFilter}
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT $2 OFFSET $4`,
      params
    );
    res.json({ posts: result.rows, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const { communityId, postId } = req.params;
    const postResult = await query(
      `SELECT p.*, u.full_name AS author_name, u.avatar_url AS author_avatar,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $2) AS liked_by_me,
              (SELECT option_id FROM post_poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $2) AS poll_voted_option_id
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.id = $1 AND p.community_id = $3`,
      [postId, req.user.id, communityId]
    );
    if (!postResult.rows.length) return res.status(404).json({ error: 'Post not found' });

    const commentsResult = await query(
      `SELECT c.*, u.full_name AS author_name, u.avatar_url AS author_avatar,
              EXISTS(SELECT 1 FROM likes l WHERE l.comment_id = c.id AND l.user_id = $2) AS liked_by_me
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId, req.user.id]
    );

    res.json({ post: postResult.rows[0], comments: commentsResult.rows });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { communityId } = req.params;
    const { content, media_urls = [], poll_data, space_id, send_email_broadcast } = req.body;

    // AI Auto-Moderation Check
    const modCheck = await ai.checkModeration(content);
    if (!modCheck.isSafe) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Your post was blocked by auto-moderation. Reason: ${modCheck.reason}` });
    }

    // Resolve space_id: use provided or default to community's default space
    let resolvedSpaceId = space_id;
    if (!resolvedSpaceId) {
      const defaultSpace = await client.query(
        'SELECT id FROM spaces WHERE community_id = $1 AND is_default = TRUE',
        [communityId]
      );
      resolvedSpaceId = defaultSpace.rows[0]?.id ?? null;
    }

    // Check level gate on the target space
    if (resolvedSpaceId) {
      const spaceResult = await client.query('SELECT min_level_required FROM spaces WHERE id = $1', [resolvedSpaceId]);
      if (spaceResult.rows.length) {
        const memberLevel = req.membership?.level ?? 1;
        if (memberLevel < (spaceResult.rows[0].min_level_required ?? 1)) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Your level is too low to post in this space' });
        }
      }
    }

    const isBroadcast = Boolean(send_email_broadcast) && req.membership?.role === 'admin';

    const result = await client.query(
      'INSERT INTO posts (community_id, space_id, author_id, content, media_urls, poll_data, send_email_broadcast, email_broadcast_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [communityId, resolvedSpaceId, req.user.id, content, JSON.stringify(media_urls), poll_data ? JSON.stringify(poll_data) : null, isBroadcast, isBroadcast ? 'pending' : 'none']
    );

    // Parse Mentions (@Username or <span data-id="Username">)
    const mentionRegex = /(?:@|<span[^>]*data-id=")([\w\s]+?)(?:"|<\/span>|\s|$)/g;
    const matches = [...content.matchAll(mentionRegex)].map(m => m[1].trim());
    
    if (matches.length > 0) {
      // Find matching users
      const usersToMention = await client.query(
        `SELECT u.id FROM users u
         JOIN community_members cm ON cm.user_id = u.id
         WHERE cm.community_id = $1 AND u.id != $2
         AND (u.full_name = ANY($3) OR REPLACE(LOWER(u.full_name), ' ', '') = ANY($4))`,
        [communityId, req.user.id, matches, matches.map(m => m.toLowerCase().replace(/\s/g, ''))]
      );

      for (const u of usersToMention.rows) {
        sendNotification({
          userId: u.id,
          communityId,
          type: 'mention',
          title: `${req.user.full_name} mentioned you in a post`,
          body: content.replace(/<[^>]*>?/gm, '').slice(0, 100),
          referenceId: result.rows[0].id,
        }).catch(err => console.error('Mention notification error:', err));
      }
    }

    await awardPoints(client, communityId, req.user.id, 'post', result.rows[0].id);
    await client.query('COMMIT');

    const post = result.rows[0];
    // posts have no title column; derive a short title from the content for webhook consumers
    const derivedTitle = (post.content || '').replace(/<[^>]*>?/gm, '').trim().slice(0, 80);
    webhookService.dispatchEvent(communityId, 'post.created', {
      post_id: post.id,
      title: derivedTitle,
      content: post.content,
      author_id: req.user.id
    }).catch(err => console.error(err));

    // Send email broadcast in the background if requested
    if (isBroadcast) {
      const commQuery = await client.query('SELECT id, name, slug FROM communities WHERE id = $1', [communityId]);
      if (commQuery.rows.length > 0) {
        emailService.sendCommunityBroadcast(commQuery.rows[0], post, req.user.full_name)
          .catch(err => console.error('Background broadcast failed:', err));
      }
    }

    res.status(201).json(post);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const update = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const result = await query(
      'UPDATE posts SET content = $1, updated_at = NOW() WHERE id = $2 AND author_id = $3 RETURNING *',
      [content, postId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Post not found or not yours' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { postId } = req.params;
    // Allow author or moderator (membership check already done by middleware)
    await query('DELETE FROM posts WHERE id = $1 AND (author_id = $2 OR $3 = TRUE)', [postId, req.user.id, req.membership?.role === 'moderator' || req.membership?.role === 'admin']);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

const toggleLike = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { postId, communityId } = req.params;

    const existing = await client.query('SELECT id FROM likes WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
    if (existing.rows.length) {
      await client.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
      await client.query('UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1', [postId]);
      await client.query('COMMIT');
      return res.json({ liked: false });
    }

    await client.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [req.user.id, postId]);
    await client.query('UPDATE posts SET like_count = like_count + 1 WHERE id = $1', [postId]);

    // Award points to post author and send notification
    const authorResult = await client.query('SELECT author_id FROM posts WHERE id = $1', [postId]);
    if (authorResult.rows.length && authorResult.rows[0].author_id !== req.user.id) {
      await awardPoints(client, communityId, authorResult.rows[0].author_id, 'like_received', postId);
      // Fire-and-forget notification (don't block the transaction)
      sendNotification({
        userId: authorResult.rows[0].author_id,
        type: 'post_like',
        title: `${req.user.full_name} liked your post`,
        body: 'Someone appreciated what you shared!',
        referenceId: postId,
        communityId,
      }).catch(err => console.error('Notification error:', err));
    }

    await client.query('COMMIT');
    res.json({ liked: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const togglePin = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const result = await query('UPDATE posts SET is_pinned = NOT is_pinned WHERE id = $1 RETURNING is_pinned', [postId]);
    res.json({ pinned: result.rows[0].is_pinned });
  } catch (err) {
    next(err);
  }
};

const addComment = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { postId, communityId } = req.params;
    const { content, parent_id } = req.body;

    // AI Auto-Moderation Check
    const modCheck = await ai.checkModeration(content);
    if (!modCheck.isSafe) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Your comment was blocked by auto-moderation. Reason: ${modCheck.reason}` });
    }

    const result = await client.query(
      'INSERT INTO comments (post_id, author_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [postId, req.user.id, content, parent_id || null]
    );
    await client.query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1', [postId]);
    await awardPoints(client, communityId, req.user.id, 'comment', result.rows[0].id);
    await checkAndAwardBadges(client, communityId, req.user.id);

    await client.query('COMMIT');

    // Notifications
    if (parent_id) {
      // Notify parent comment author
      const parentComment = await client.query('SELECT author_id FROM comments WHERE id = $1', [parent_id]);
      if (parentComment.rows.length && parentComment.rows[0].author_id !== req.user.id) {
        sendNotification({
          userId: parentComment.rows[0].author_id,
          type: 'comment_reply',
          title: `${req.user.full_name} replied to your comment`,
          body: content.slice(0, 100),
          referenceId: postId,
          communityId,
        }).catch(err => console.error('Notification error:', err));
      }
    } else {
      // Notify post author about the new comment
      const postAuthor = await client.query('SELECT author_id FROM posts WHERE id = $1', [postId]);
      if (postAuthor.rows.length && postAuthor.rows[0].author_id !== req.user.id) {
        sendNotification({
          userId: postAuthor.rows[0].author_id,
          type: 'comment_reply',
          title: `${req.user.full_name} commented on your post`,
          body: content.slice(0, 100),
          referenceId: postId,
          communityId,
        }).catch(err => console.error('Notification error:', err));
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const updateComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const result = await query(
      'UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2 AND author_id = $3 RETURNING *',
      [content, commentId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Comment not found or not yours' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const { commentId, postId } = req.params;
    const isModOrAdmin = req.membership?.role === 'moderator' || req.membership?.role === 'admin';
    const result = await query(
      'DELETE FROM comments WHERE id = $1 AND (author_id = $2 OR $3 = TRUE) RETURNING id',
      [commentId, req.user.id, isModOrAdmin]
    );
    if (result.rowCount > 0) {
      await query('UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1', [postId]);
      res.json({ message: 'Comment deleted' });
    } else {
      res.status(404).json({ error: 'Comment not found or not yours' });
    }
  } catch (err) {
    next(err);
  }
};

const toggleCommentLike = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const existing = await query('SELECT id FROM likes WHERE comment_id = $1 AND user_id = $2', [commentId, req.user.id]);
    if (existing.rows.length) {
      await query('DELETE FROM likes WHERE comment_id = $1 AND user_id = $2', [commentId, req.user.id]);
      await query('UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1', [commentId]);
      return res.json({ liked: false });
    }
    await query('INSERT INTO likes (user_id, comment_id) VALUES ($1, $2)', [req.user.id, commentId]);
    await query('UPDATE comments SET like_count = like_count + 1 WHERE id = $1', [commentId]);
    res.json({ liked: true });
  } catch (err) {
    next(err);
  }
};

const votePoll = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { postId } = req.params;
    const { option_id } = req.body;

    const existingVote = await client.query('SELECT id FROM post_poll_votes WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
    if (existingVote.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already voted on this poll' });
    }

    const postRes = await client.query('SELECT poll_data FROM posts WHERE id = $1', [postId]);
    const poll_data = postRes.rows[0]?.poll_data;
    if (!poll_data || !poll_data.options) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Increment vote count for the chosen option
    const updatedOptions = poll_data.options.map(opt => 
      opt.id === option_id ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
    );
    const updatedPollData = { ...poll_data, options: updatedOptions };

    await client.query('UPDATE posts SET poll_data = $1 WHERE id = $2', [JSON.stringify(updatedPollData), postId]);
    await client.query('INSERT INTO post_poll_votes (post_id, user_id, option_id) VALUES ($1, $2, $3)', [postId, req.user.id, option_id]);
    
    await client.query('COMMIT');
    res.json({ success: true, poll_data: updatedPollData, poll_voted_option_id: option_id });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const summarize = async (req, res, next) => {
  try {
    const { postId } = req.params;
    
    // Fetch post and comments (posts have no title column)
    const postResult = await query('SELECT content FROM posts WHERE id = $1', [postId]);
    if (!postResult.rows.length) return res.status(404).json({ error: 'Post not found' });

    const commentsResult = await query(
      'SELECT content FROM comments WHERE post_id = $1 ORDER BY like_count DESC LIMIT 20',
      [postId]
    );

    const postContent = postResult.rows[0].content;
    const postTitle = (postContent || '').replace(/<[^>]*>?/gm, '').trim().slice(0, 80) || 'Community Post';
    const comments = commentsResult.rows.map(c => c.content);

    const summary = await ai.summarizeDiscussion(postTitle, postContent, comments);
    res.json({ summary });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list, get, create, update, remove,
  toggleLike, togglePin,
  addComment, updateComment, deleteComment, toggleCommentLike,
  votePoll, summarize
};
