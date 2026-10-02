import { useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postApi, reportApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { Heart, MessageCircle, ArrowLeft, Send, ChevronDown, ChevronUp, BarChart2, Sparkles, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import RichTextEditor from '@/components/RichTextEditor';
import { sanitizeHtml } from '@/utils/sanitize';

const LevelBadge = ({ level }) => (
  <span className="badge bg-brand-500/15 text-brand-400 text-[10px] font-mono">
    Lv.{level}
  </span>
);

const Comment = ({ comment, communityId, postId, communitySlug, depth = 0, allComments }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const children = allComments.filter(c => c.parent_id === comment.id);

  const likeMutation = useMutation({
    mutationFn: () => postApi.toggleCommentLike(communityId, postId, comment.id),
    onSuccess: () => qc.invalidateQueries(['post-detail', communityId, postId]),
  });

  const replyMutation = useMutation({
    mutationFn: (content) => postApi.addComment(communityId, postId, { content, parent_id: comment.id }),
    onSuccess: () => {
      setReplyContent('');
      setShowReplyBox(false);
      qc.invalidateQueries(['post-detail', communityId, postId]);
      toast.success('Reply posted!');
    },
  });

  const handleReply = (e) => {
    e.preventDefault();
    if (!replyContent.trim() || replyContent === '<p></p>') return;
    replyMutation.mutate(replyContent);
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-surface-border pl-4' : ''}`}>
      <div className="py-3">
        <div className="flex items-start gap-3">
          <Link
            to={`/c/${communitySlug}/members/${comment.author_id}`}
            className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0 hover:border-brand-400 transition-colors"
          >
            {comment.author_name?.[0] ?? '?'}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link to={`/c/${communitySlug}/members/${comment.author_id}`} className="text-sm font-semibold text-gray-200 hover:text-brand-300 transition-colors">
                {comment.author_name}
              </Link>
              <span className="text-xs text-gray-600">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>
            <div
              className="text-sm text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.content) }}
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => likeMutation.mutate()}
                className={`btn-ghost gap-1 text-xs px-1.5 py-1 ${comment.liked_by_me ? 'text-red-400' : ''}`}
              >
                <Heart size={13} fill={comment.liked_by_me ? 'currentColor' : 'none'} />
                {comment.like_count || ''}
              </button>
              <button
                onClick={() => setShowReplyBox(!showReplyBox)}
                className="btn-ghost gap-1 text-xs px-1.5 py-1"
              >
                <MessageCircle size={13} /> Reply
              </button>
              {children.length > 0 && (
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="btn-ghost gap-1 text-xs px-1.5 py-1 text-gray-500"
                >
                  {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                  {children.length} {children.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>

            {showReplyBox && (
              <form onSubmit={handleReply} className="mt-3">
                <RichTextEditor
                  content={replyContent}
                  onChange={setReplyContent}
                  placeholder="Write a reply…"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => setShowReplyBox(false)} className="btn-ghost text-xs">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-xs px-3 py-1.5"
                    disabled={!replyContent.trim() || replyContent === '<p></p>' || replyMutation.isPending}
                  >
                    <Send size={12} /> {replyMutation.isPending ? 'Posting…' : 'Reply'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {!collapsed && children.length > 0 && (
        <div>
          {children.map(child => (
            <Comment
              key={child.id}
              comment={child}
              communityId={communityId}
              postId={postId}
              communitySlug={communitySlug}
              depth={depth + 1}
              allComments={allComments}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function PostDetailPage() {
  const { community } = useOutletContext();
  const { communitySlug, postId } = useParams();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const communityId = community?.id;
  const [commentContent, setCommentContent] = useState('');
  const [summary, setSummary] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['post-detail', communityId, postId],
    queryFn: () => postApi.get(communityId, postId).then(r => r.data),
    enabled: !!communityId && !!postId,
  });

  const post = data?.post;
  const comments = data?.comments ?? [];
  const topLevelComments = comments.filter(c => !c.parent_id);

  const likeMutation = useMutation({
    mutationFn: () => postApi.toggleLike(communityId, postId),
    onSuccess: () => qc.invalidateQueries(['post-detail', communityId, postId]),
  });

  const reportMutation = useMutation({
    mutationFn: (reason) => reportApi.create(communityId, { target_type: 'post', target_id: postId, reason }),
    onSuccess: () => toast.success('Reported. A moderator will review it.'),
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to report'),
  });

  const handleReport = () => {
    const reason = window.prompt('Why are you reporting this post? (optional)');
    if (reason !== null) reportMutation.mutate(reason);
  };

  const voteMutation = useMutation({
    mutationFn: (optionId) => postApi.votePoll(communityId, postId, optionId),
    onSuccess: () => {
      qc.invalidateQueries(['post-detail', communityId, postId]);
      qc.invalidateQueries(['posts', communityId]); // update feed as well
      toast.success('Vote cast!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to vote'),
  });

  const poll = post ? (typeof post.poll_data === 'string' ? JSON.parse(post.poll_data) : post.poll_data) : null;
  const totalVotes = poll?.options?.reduce((sum, o) => sum + (o.votes || 0), 0) || 0;

  const commentMutation = useMutation({
    mutationFn: (content) => postApi.addComment(communityId, postId, { content }),
    onSuccess: () => {
      setCommentContent('');
      qc.invalidateQueries(['post-detail', communityId, postId]);
      toast.success('Comment posted!');
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: () => postApi.summarize(communityId, postId).then(r => r.data),
    onSuccess: (data) => setSummary(data.summary),
    onError: () => toast.error('Failed to generate summary'),
  });

  const handleComment = (e) => {
    e.preventDefault();
    if (!commentContent.trim() || commentContent === '<p></p>') return;
    commentMutation.mutate(commentContent);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="card animate-pulse-soft h-48" />
        <div className="card animate-pulse-soft h-24" />
        <div className="card animate-pulse-soft h-24" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-gray-500 font-display font-bold text-lg">Post not found</p>
        <Link to={`/c/${communitySlug}/spaces/general`} className="btn-secondary mt-4 inline-flex">
          <ArrowLeft size={14} /> Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        to={`/c/${communitySlug}/spaces/general`}
        className="btn-ghost text-xs mb-4 inline-flex"
      >
        <ArrowLeft size={14} /> Back to feed
      </Link>

      {/* Post */}
      <article className="card mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Link
            to={`/c/${communitySlug}/members/${post.author_id}`}
            className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0 hover:border-brand-400 transition-colors"
          >
            {post.author_name?.[0] ?? '?'}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link to={`/c/${communitySlug}/members/${post.author_id}`} className="text-sm font-semibold text-gray-200 hover:text-brand-300 transition-colors">
                {post.author_name}
              </Link>
              {post.author_level && <LevelBadge level={post.author_level} />}
            </div>
            <span className="text-xs text-gray-600">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
          </div>
          {user?.id !== post.author_id && (
            <button
              onClick={handleReport}
              title="Report post"
              className="text-gray-600 hover:text-red-400 transition-colors p-1 shrink-0"
            >
              <Flag size={15} />
            </button>
          )}
        </div>

        {/* Rich content */}
        <div
          className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-4 prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
        />

        {/* Media */}
        {post.media_urls?.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {post.media_urls.map((url, i) => (
              <img key={i} src={url} className="rounded-lg w-full h-48 object-cover" alt="" />
            ))}
          </div>
        )}

        {/* Poll */}
        {poll && poll.options && (
          <div className="mb-4 p-5 rounded-xl border border-surface-border bg-surface/50">
            <p className="font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart2 size={18} className="text-brand-400" /> {poll.question}
            </p>
            <div className="space-y-3">
              {poll.options.map((opt) => {
                const votedForThis = post.poll_voted_option_id === opt.id;
                const hasVoted = !!post.poll_voted_option_id;
                const percent = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;

                return (
                  <div key={opt.id} className="relative overflow-hidden rounded-lg">
                    {hasVoted && (
                        <div 
                          className={`absolute top-0 left-0 bottom-0 ${votedForThis ? 'bg-brand-500/20' : 'bg-surface-border'} transition-all`}
                          style={{ width: `${percent}%` }}
                        />
                    )}
                    
                    <button
                      onClick={() => !hasVoted && voteMutation.mutate(opt.id)}
                      disabled={hasVoted || voteMutation.isPending}
                      className={`relative w-full flex items-center justify-between p-4 text-sm text-left transition-colors ${
                        !hasVoted ? 'hover:bg-surface border border-surface-border cursor-pointer' : 'border border-transparent cursor-default'
                      } ${votedForThis ? 'text-brand-300 font-medium border-brand-500/30' : 'text-gray-300'}`}
                    >
                      <span>{opt.text}</span>
                      {hasVoted && (
                        <span className="text-sm font-mono font-medium">{percent}%</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-gray-500 mt-4">{totalVotes} votes</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-surface-border">
          <button
            onClick={() => likeMutation.mutate()}
            className={`btn-ghost gap-1.5 ${post.liked_by_me ? 'text-red-400 hover:text-red-300' : ''}`}
          >
            <Heart size={16} fill={post.liked_by_me ? 'currentColor' : 'none'} />
            <span className="text-xs">{post.like_count || ''}</span>
          </button>
          <span className="btn-ghost gap-1.5 cursor-default">
            <MessageCircle size={16} />
            <span className="text-xs">{post.comment_count || ''}</span>
          </span>
          <div className="ml-auto">
            <button
              onClick={() => summarizeMutation.mutate()}
              disabled={summarizeMutation.isPending}
              className="btn-ghost gap-1.5 text-brand-400 hover:text-brand-300"
            >
              <Sparkles size={16} />
              <span className="text-xs font-semibold">{summarizeMutation.isPending ? 'Summarizing...' : 'Summarize with AI'}</span>
            </button>
          </div>
        </div>
      </article>

      {/* AI Summary Block */}
      {summary && (
        <div className="card mb-6 bg-brand-500/10 border-brand-500/20 animate-fade-in relative">
          <button 
            onClick={() => setSummary('')} 
            className="absolute top-2 right-2 text-gray-500 hover:text-white"
          >
            ×
          </button>
          <h3 className="text-sm font-semibold text-brand-400 mb-2 flex items-center gap-1.5">
            <Sparkles size={14} /> AI Summary
          </h3>
          <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
            {summary}
          </div>
        </div>
      )}

      {/* Comment Composer */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Leave a comment</h3>
        <form onSubmit={handleComment}>
          <RichTextEditor
            content={commentContent}
            onChange={setCommentContent}
            placeholder="Write your thoughts…"
          />
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              className="btn-primary text-xs px-4 py-1.5"
              disabled={!commentContent.trim() || commentContent === '<p></p>' || commentMutation.isPending}
            >
              <Send size={13} /> {commentMutation.isPending ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </form>
      </div>

      {/* Comments */}
      {comments.length > 0 ? (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-300 mb-1">
            {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
          </h3>
          <div className="divide-y divide-surface-border">
            {topLevelComments.map(comment => (
              <Comment
                key={comment.id}
                comment={comment}
                communityId={communityId}
                postId={postId}
                communitySlug={communitySlug}
                allComments={comments}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-600">
          <MessageCircle size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No comments yet. Be the first!</p>
        </div>
      )}
    </div>
  );
}
