import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { gamificationApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { Trophy, Medal } from 'lucide-react';

const RANK_STYLES = {
  1: { icon: '🥇', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
  2: { icon: '🥈', bg: 'bg-gray-400/10 border-gray-400/30', text: 'text-gray-300' },
  3: { icon: '🥉', bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400' },
};

const LeaderboardRow = ({ member, isMe, communitySlug }) => {
  const style = RANK_STYLES[member.rank];
  return (
    <Link
      to={`/c/${communitySlug}/members/${member.id}`}
      className={`flex items-center gap-4 p-3 rounded-xl border transition-all hover:border-brand-500/30 ${
        isMe
          ? 'bg-brand-500/10 border-brand-500/30'
          : style
            ? `${style.bg}`
            : 'bg-surface-card border-surface-border'
      }`}
    >
      {/* Rank */}
      <div className="w-8 text-center shrink-0">
        {style ? (
          <span className="text-xl">{style.icon}</span>
        ) : (
          <span className="text-sm font-mono text-gray-600">#{member.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0">
        {member.full_name?.[0]}
      </div>

      {/* Name + level */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${isMe ? 'text-brand-300' : 'text-gray-200'} truncate`}>
            {member.full_name}
            {isMe && <span className="text-gray-500 font-normal ml-1">(you)</span>}
          </span>
          <span className="badge bg-surface text-gray-500 text-[10px] font-mono shrink-0">
            Lv.{member.level}
          </span>
        </div>
      </div>

      {/* Points */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${style ? style.text : isMe ? 'text-brand-400' : 'text-gray-300'}`}>
          {member.points.toLocaleString()}
        </p>
        <p className="text-[10px] text-gray-600">points</p>
      </div>
    </Link>
  );
};

export default function LeaderboardPage() {
  const { community } = useOutletContext();
  const { user } = useAuthStore();
  const communityId = community?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', communityId],
    queryFn: () => gamificationApi.leaderboard(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const { data: pointRules } = useQuery({
    queryKey: ['point-rules', communityId],
    queryFn: () => gamificationApi.getPointRules(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const ACTION_LABELS = {
    post: 'Create a post',
    comment: 'Leave a comment',
    lesson_complete: 'Complete a lesson',
    event_attend: 'Attend an event',
    like_received: 'Receive a like',
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            <Trophy size={22} className="text-amber-400" /> Leaderboard
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Top contributors this community</p>
        </div>
      </div>

      {/* How to earn points */}
      {pointRules?.length > 0 && (
        <div className="card mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            How to earn points
          </p>
          <div className="grid grid-cols-2 gap-2">
            {pointRules.map(rule => (
              <div key={rule.action} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface border border-surface-border">
                <span className="text-xs text-gray-400">{ACTION_LABELS[rule.action] ?? rule.action}</span>
                <span className="text-xs font-bold text-brand-400 font-mono">+{rule.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranking */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="card animate-pulse-soft h-14" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.map(member => (
            <LeaderboardRow
              key={member.id}
              member={member}
              isMe={member.id === user?.id}
              communitySlug={community?.slug}
            />
          ))}
          {data?.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <Trophy size={32} className="mx-auto mb-3 opacity-20" />
              <p className="font-display font-bold text-gray-500">No rankings yet</p>
              <p className="text-sm mt-1">Start posting to earn points!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
