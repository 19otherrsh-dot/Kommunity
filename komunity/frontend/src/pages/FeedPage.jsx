import { useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postApi, spaceApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { Heart, MessageCircle, Pin, Send, Image, MoreHorizontal, Lock, Trophy, Flame, BarChart2, Plus, X, CreditCard, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import ChatSpace from '@/components/ChatSpace';
import { sanitizeHtml } from '@/utils/sanitize';

const LevelBadge = ({ level }) => (
  <span className="badge bg-brand-500/15 text-brand-400 text-[10px] font-mono">
    Lv.{level}
  </span>
);

const PostCard = ({ post, communitySlug }) => {
  const { communityId } = usePostContext();
  const qc = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: () => postApi.toggleLike(communityId, post.id),
    onSuccess: () => qc.invalidateQueries(['posts', communityId]),
  });

  const voteMutation = useMutation({
    mutationFn: (optionId) => postApi.votePoll(communityId, post.id, optionId),
    onSuccess: () => {
      qc.invalidateQueries(['posts', communityId]);
      qc.invalidateQueries(['post-detail', communityId, post.id]); // just in case
      toast.success('Vote cast!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to vote'),
  });

  const poll = typeof post.poll_data === 'string' ? JSON.parse(post.poll_data) : post.poll_data;
  const totalVotes = poll?.options?.reduce((sum, o) => sum + (o.votes || 0), 0) || 0;

  return (
    <article className="card animate-fade-in">
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-3">
          <Pin size={12} /> Pinned post
        </div>
      )}

      {/* Author */}
      <div className="flex items-start gap-3 mb-3">
        <Link
          to={`/c/${communitySlug}/members/${post.author_id}`}
          className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0 hover:border-brand-400 transition-colors"
        >
          {post.author_name?.[0] ?? '?'}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/c/${communitySlug}/members/${post.author_id}`} className="text-sm font-semibold text-gray-200 hover:text-brand-300 transition-colors">{post.author_name}</Link>
            <LevelBadge level={post.author_level ?? 1} />
          </div>
          <span className="text-xs text-gray-600">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </span>
        </div>
        <button className="btn-ghost p-1.5"><MoreHorizontal size={16} /></button>
      </div>

      {/* Content — render as HTML from TipTap */}
      <Link to={`/c/${communitySlug}/posts/${post.id}`} className="block">
        <div
          className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-4 prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
        />
      </Link>

      {/* Media */}
      {post.media_urls?.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {post.media_urls.map((url, i) => (
            <img key={i} src={url} className="rounded-lg w-full h-40 object-cover" alt="" />
          ))}
        </div>
      )}

      {/* Poll */}
      {poll && poll.options && (
        <div className="mb-4 p-4 rounded-xl border border-surface-border bg-surface/50">
          <p className="font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart2 size={16} className="text-brand-400" /> {poll.question}
          </p>
          <div className="space-y-2">
            {poll.options.map((opt) => {
              const votedForThis = post.poll_voted_option_id === opt.id;
              const hasVoted = !!post.poll_voted_option_id;
              const percent = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;

              return (
                <div key={opt.id} className="relative overflow-hidden rounded-lg">
                  {/* Progress bar background (only show if voted) */}
                  {hasVoted && (
                    <div 
                      className={`absolute top-0 left-0 bottom-0 ${votedForThis ? 'bg-brand-500/20' : 'bg-surface-border'} transition-all`}
                      style={{ width: `${percent}%` }}
                    />
                  )}
                  
                  <button
                    onClick={() => !hasVoted && voteMutation.mutate(opt.id)}
                    disabled={hasVoted || voteMutation.isPending}
                    className={`relative w-full flex items-center justify-between p-3 text-sm text-left transition-colors ${
                      !hasVoted ? 'hover:bg-surface border border-surface-border cursor-pointer' : 'border border-transparent cursor-default'
                    } ${votedForThis ? 'text-brand-300 font-medium border-brand-500/30' : 'text-gray-300'}`}
                  >
                    <span>{opt.text}</span>
                    {hasVoted && (
                      <span className="text-xs font-mono">{percent}%</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">{totalVotes} votes</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-3 border-t border-surface-border">
        <button
          onClick={() => likeMutation.mutate()}
          className={`btn-ghost gap-1.5 ${post.liked_by_me ? 'text-red-400 hover:text-red-300' : ''}`}
        >
          <Heart size={15} fill={post.liked_by_me ? 'currentColor' : 'none'} />
          <span className="text-xs">{post.like_count || ''}</span>
        </button>
        <Link to={`/c/${communitySlug}/posts/${post.id}`} className="btn-ghost gap-1.5">
          <MessageCircle size={15} />
          <span className="text-xs">{post.comment_count || ''}</span>
        </Link>
      </div>
    </article>
  );
};

import RichTextEditor from '@/components/RichTextEditor';

// Quick context workaround for nested components
let _communityId;
const usePostContext = () => ({ communityId: _communityId });

const CreatePost = ({ communityId, spaceId, isAdmin }) => {
  const [content, setContent] = useState('');
  const [showPoll, setShowPoll] = useState(false);
  const [sendBroadcast, setSendBroadcast] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => postApi.create(communityId, data),
    onSuccess: () => {
      setContent('');
      setShowPoll(false);
      setSendBroadcast(false);
      setPollQuestion('');
      setPollOptions([{ id: '1', text: '' }, { id: '2', text: '' }]);
      qc.invalidateQueries(['posts', communityId]);
      toast.success('Posted!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to post'),
  });

  const handleSubmit = (e) => {
      e.preventDefault();
      if (!content.trim() || content === '<p></p>') return;

      let poll_data = null;
      if (showPoll && pollQuestion.trim()) {
        const validOptions = pollOptions.filter(o => o.text.trim());
        if (validOptions.length >= 2) {
          poll_data = {
            question: pollQuestion.trim(),
            options: validOptions.map(o => ({ id: o.id, text: o.text.trim(), votes: 0 })),
          };
        }
      }

      createMutation.mutate({ content, space_id: spaceId, poll_data, send_email_broadcast: sendBroadcast });
    };

    const addPollOption = () => {
      if (pollOptions.length >= 5) return toast.error('Maximum 5 options allowed');
      setPollOptions(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), text: '' }]);
    };
    
    const removePollOption = (id) => {
      if (pollOptions.length <= 2) return toast.error('Minimum 2 options required');
      setPollOptions(prev => prev.filter(o => o.id !== id));
    };

  return (
    <form onSubmit={handleSubmit} className="card mb-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0">
          {user?.full_name?.[0] ?? '?'}
        </div>
        <div className="flex-1">
          <RichTextEditor 
            content={content} 
            onChange={setContent} 
            placeholder="Share something with the community…"
          />

          {showPoll && (
            <div className="mt-4 p-4 rounded-xl border border-surface-border bg-surface/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-300">Create a Poll</h4>
                <button type="button" onClick={() => setShowPoll(false)} className="btn-ghost p-1 text-gray-500 hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
              <input 
                className="input mb-3" 
                placeholder="Ask a question..." 
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
              />
              <div className="space-y-2 mb-3">
                {pollOptions.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input 
                      className="input py-1.5 text-sm" 
                      placeholder={`Option ${i + 1}`} 
                      value={opt.text}
                      onChange={e => setPollOptions(prev => prev.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o))}
                    />
                    <button type="button" onClick={() => removePollOption(opt.id)} className="btn-ghost p-1.5 text-gray-500 hover:text-red-400">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {pollOptions.length < 5 && (
                <button type="button" onClick={addPollOption} className="btn-ghost text-xs text-brand-400 gap-1 px-0">
                  <Plus size={12} /> Add option
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPoll(!showPoll)} className={`btn-ghost text-xs px-2 py-1.5 ${showPoll ? 'text-brand-400 bg-brand-500/10' : ''}`}>
                <BarChart2 size={14} /> Poll
              </button>
              {isAdmin && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={sendBroadcast} 
                    onChange={e => setSendBroadcast(e.target.checked)}
                    className="rounded bg-surface-border border-gray-600 text-brand-500 focus:ring-brand-500/50 cursor-pointer"
                  />
                  <span className={`flex items-center gap-1.5 text-xs select-none transition-colors ${sendBroadcast ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-400'}`}>
                    <Mail size={14} /> Send email broadcast
                  </span>
                </label>
              )}
            </div>
            <button
              type="submit"
              className="btn-primary text-xs px-4 py-1.5"
              disabled={!content.trim() || content === '<p></p>' || createMutation.isPending}
            >
              <Send size={13} />
              {createMutation.isPending ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default function FeedPage() {
  const { community, spaces, currentSpaceSlug, membership } = useOutletContext();
  const { spaceSlug: urlSpaceSlug } = useParams();
  const communityId = community?.id;
  _communityId = communityId;

  // Resolve the current space from URL params, context, or default to 'general'
  const targetSlug = urlSpaceSlug ?? currentSpaceSlug ?? 'general';
  const currentSpace = spaces?.find(s => s.slug === targetSlug) ?? spaces?.find(s => s.is_default);
  const isLocked = currentSpace?.is_locked;
  const isTierLocked = currentSpace?.is_tier_locked;
  const isLevelLocked = currentSpace?.is_level_locked;
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckout = async () => {
    try {
      setIsCheckingOut(true);
      const { data } = await billingApi.createCheckout(community.id, currentSpace.min_tier_id);
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error('Failed to initiate checkout');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const isChat = currentSpace?.type === 'chat';

  const { data, isLoading } = useQuery({
    queryKey: ['posts', communityId, currentSpace?.id],
    queryFn: () => postApi.list(communityId, { space_id: currentSpace?.id }).then(r => r.data),
    enabled: !!communityId && !!currentSpace?.id && !isLocked && !isChat,
  });

  // ─── Real-time chat space ─────────────────────────────────────────────────
  if (isChat && !isLocked && currentSpace) {
    return (
      <div className="max-w-2xl mx-auto">
        <ChatSpace communityId={communityId} space={currentSpace} />
      </div>
    );
  }

  if (isLoading && !isLocked) return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {[1,2,3].map(i => <div key={i} className="card animate-pulse-soft h-40" />)}
    </div>
  );

  // ─── Locked Space View ────────────────────────────────────────────────────
  if (isLocked && currentSpace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-320px)] animate-fade-in max-w-lg mx-auto">
        <div className="card w-full text-center px-8 py-12 border-amber-500/20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 mb-5 mx-auto">
            <Lock size={28} className="text-amber-400" />
          </div>

          <h2 className="font-display font-bold text-2xl text-white mb-1">
            {currentSpace.icon_emoji} {currentSpace.name}
          </h2>
          {currentSpace.description && (
            <p className="text-sm text-gray-400 mb-6">{currentSpace.description}</p>
          )}

          {isTierLocked ? (
            <div className="flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/25 mb-4">
                <Lock size={16} className="text-brand-400" />
                <span className="text-sm font-semibold text-brand-300">
                  Premium Space
                </span>
              </div>
              <div className="p-4 w-full rounded-xl bg-surface border border-surface-border mt-2">
                <p className="text-sm text-gray-300 mb-4">
                  This space is exclusively available for premium members. Upgrade your membership to get instant access.
                </p>
                <button 
                  onClick={handleCheckout} 
                  disabled={isCheckingOut}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  <CreditCard size={18} />
                  {isCheckingOut ? 'Loading...' : `Unlock for $${currentSpace.min_tier_price}/mo`}
                </button>
              </div>
            </div>
          ) : isLevelLocked ? (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/25 mb-4">
                <Trophy size={16} className="text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">
                  Requires Level {currentSpace.min_level_required}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-surface-border mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame size={16} className="text-orange-400" />
                  <span className="text-xs font-semibold text-gray-300">
                    Keep engaging to level up!
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Post in other spaces, comment on discussions, complete courses, and attend events to earn points and unlock this space.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // ─── Normal Space Feed ────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Space Header */}
      {currentSpace && (
        <div className="mb-5">
          <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
            <span className="text-2xl">{currentSpace.icon_emoji}</span>
            {currentSpace.name}
          </h2>
          {currentSpace.description && (
            <p className="text-sm text-gray-500 mt-0.5">{currentSpace.description}</p>
          )}
        </div>
      )}

      <CreatePost communityId={communityId} spaceId={currentSpace?.id} isAdmin={membership?.role === 'admin'} />

      <div className="space-y-4">
        {data?.posts?.map(post => (
          <PostCard key={post.id} post={post} communitySlug={community?.slug} />
        ))}
        {data?.posts?.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="font-display font-bold text-gray-500">No posts yet</p>
            <p className="text-sm mt-1">Be the first to share something!</p>
          </div>
        )}
      </div>
    </div>
  );
}
