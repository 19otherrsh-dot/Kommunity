import { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { memberApi } from '@/api';
import { Search, Shield, Star } from 'lucide-react';

const LEVEL_COLORS = ['', '#6b7280','#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4','#f97316','#6366f1'];

const MemberCard = ({ member, communitySlug }) => {
  const levelColor = LEVEL_COLORS[member.level] ?? LEVEL_COLORS[1];

  return (
    <Link
      to={`/c/${communitySlug}/members/${member.id}`}
      className="card hover:border-brand-500/30 transition-all duration-200 flex items-center gap-3"
    >
      {/* Avatar with level ring */}
      <div className="relative shrink-0">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg"
          style={{
            background: `${levelColor}20`,
            border: `2px solid ${levelColor}50`,
            color: levelColor,
          }}
        >
          {member.full_name?.[0]}
        </div>
        <span
          className="absolute -bottom-1 -right-1 text-[9px] font-mono font-bold px-1 rounded-full border"
          style={{
            background: `${levelColor}20`,
            borderColor: `${levelColor}40`,
            color: levelColor,
          }}
        >
          {member.level}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-200 truncate">{member.full_name}</span>
          {member.role === 'admin' && (
            <span className="badge bg-amber-500/10 text-amber-400 text-[10px]">
              <Star size={9} /> Admin
            </span>
          )}
          {member.role === 'moderator' && (
            <span className="badge bg-blue-500/10 text-blue-400 text-[10px]">
              <Shield size={9} /> Mod
            </span>
          )}
        </div>
        {member.bio && (
          <p className="text-xs text-gray-600 truncate mt-0.5">{member.bio}</p>
        )}
      </div>

      {/* Points */}
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-brand-400">{member.points.toLocaleString()}</p>
        <p className="text-[10px] text-gray-600">pts</p>
      </div>
    </Link>
  );
};

export default function MembersPage() {
  const { community } = useOutletContext();
  const communityId = community?.id;
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['members', communityId, search],
    queryFn: () => memberApi.list(communityId, { search: search || undefined }).then(r => r.data),
    enabled: !!communityId,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">Members</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {community?.member_count?.toLocaleString()} total members
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          className="input pl-9 max-w-xs"
          placeholder="Search members…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="card animate-pulse-soft h-16" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data?.map(member => <MemberCard key={member.id} member={member} communitySlug={community?.slug} />)}
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="font-display font-bold text-gray-500">No members found</p>
        </div>
      )}
    </div>
  );
}
