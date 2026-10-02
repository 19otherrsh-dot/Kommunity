import { useParams, useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { memberApi, messageApi, postApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import {
  ArrowLeft, Globe, MessageSquare,
  Trophy, Star, Shield, Zap
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const LEVEL_COLORS = ['', '#6b7280','#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4','#f97316','#6366f1'];

export default function MemberProfilePage() {
  const { communitySlug, userId } = useParams();
  const { community } = useOutletContext();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const communityId = community?.id;
  const isMe = user?.id === userId;

  const { data: member, isLoading } = useQuery({
    queryKey: ['member-profile', communityId, userId],
    queryFn: () => memberApi.get(communityId, userId).then(r => r.data),
    enabled: !!communityId && !!userId,
  });

  const handleSendMessage = async () => {
    try {
      // Send a placeholder message or just navigate to messages with a new conversation
      await messageApi.sendMessage({ recipientId: userId, content: '👋 Hey!' });
      toast.success('Conversation started!');
      navigate('/messages');
    } catch (err) {
      toast.error('Failed to start conversation');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="card animate-pulse-soft h-64" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-gray-500 font-display font-bold text-lg">Member not found</p>
      </div>
    );
  }

  const levelColor = LEVEL_COLORS[member.level] ?? LEVEL_COLORS[1];

  return (
    <div className="max-w-2xl mx-auto">
      <Link to={`/c/${communitySlug}/members`} className="btn-ghost text-xs mb-4 inline-flex">
        <ArrowLeft size={14} /> Back to members
      </Link>

      {/* Profile Card */}
      <div className="card mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar with level ring */}
          <div className="relative shrink-0">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl"
              style={{
                background: `${levelColor}20`,
                border: `3px solid ${levelColor}60`,
                color: levelColor,
              }}
            >
              {member.full_name?.[0]}
            </div>
            <span
              className="absolute -bottom-1 -right-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border"
              style={{
                background: `${levelColor}20`,
                borderColor: `${levelColor}40`,
                color: levelColor,
              }}
            >
              Lv.{member.level}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display font-bold text-xl text-white">{member.full_name}</h1>
              {member.role === 'admin' && (
                <span className="badge bg-amber-500/10 text-amber-400 text-[10px]">
                  <Star size={10} /> Admin
                </span>
              )}
              {member.role === 'moderator' && (
                <span className="badge bg-blue-500/10 text-blue-400 text-[10px]">
                  <Shield size={10} /> Mod
                </span>
              )}
            </div>
            {member.bio && (
              <p className="text-sm text-gray-400 mb-3">{member.bio}</p>
            )}

            {/* Social links */}
            <div className="flex items-center gap-3 mb-4">
              {member.website_url && (
                <a href={member.website_url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-brand-400 transition-colors">
                  <Globe size={16} />
                </a>
              )}
              {member.twitter_url && (
                <a href={member.twitter_url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-brand-400 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
                </a>
              )}
              {member.linkedin_url && (
                <a href={member.linkedin_url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-brand-400 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                </a>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4">
              <div className="text-center px-4 py-2 rounded-lg bg-surface border border-surface-border">
                <p className="text-lg font-bold text-brand-400">{member.points?.toLocaleString()}</p>
                <p className="text-[10px] text-gray-600 uppercase">Points</p>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-surface border border-surface-border">
                <p className="text-lg font-bold text-gray-300" style={{ color: levelColor }}>{member.level}</p>
                <p className="text-[10px] text-gray-600 uppercase">Level</p>
              </div>
              <div className="text-center px-4 py-2 rounded-lg bg-surface border border-surface-border">
                <p className="text-xs text-gray-400">{format(new Date(member.joined_at), 'MMM yyyy')}</p>
                <p className="text-[10px] text-gray-600 uppercase">Joined</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isMe && (
          <div className="mt-5 pt-4 border-t border-surface-border flex gap-2">
            <button onClick={handleSendMessage} className="btn-primary text-sm">
              <MessageSquare size={14} /> Send Message
            </button>
          </div>
        )}
      </div>

      {/* Badges */}
      {member.badges?.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4">
            <Trophy size={14} className="text-amber-400" /> Badges Earned
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {member.badges.map(badge => (
              <div key={badge.id} className="text-center p-3 rounded-xl bg-surface border border-surface-border hover:border-amber-500/30 transition-colors">
                <span className="text-2xl block mb-1">{badge.icon_emoji || '🏆'}</span>
                <p className="text-xs font-semibold text-gray-200">{badge.name}</p>
                {badge.description && (
                  <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{badge.description}</p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">
                  {formatDistanceToNow(new Date(badge.earned_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {member.badges?.length === 0 && (
        <div className="card mb-6 text-center py-8 text-gray-600">
          <Zap size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No badges earned yet</p>
        </div>
      )}
    </div>
  );
}
