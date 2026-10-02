import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { communityApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { Users, ArrowRight, Globe, BookOpen, Calendar, Trophy } from 'lucide-react';
import { useMeta } from '@/hooks/useMeta';

export default function PublicCommunityPage() {
  const { communitySlug } = useParams();
  const user = useAuthStore(s => s.user);

  const { data: community, isLoading, isError } = useQuery({
    queryKey: ['public-community', communitySlug],
    queryFn: () => communityApi.get(communitySlug).then(r => r.data),
  });

  useMeta({
    title: community ? `${community.name} — Komunity` : 'Komunity',
    description: community?.description || 'Join this community on Komunity.',
    image: community?.cover_image || community?.icon_image,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-surface text-gray-500">Loading…</div>;
  }
  if (isError || !community) {
    return <Navigate to="/discover" replace />;
  }

  // Logged-in members go straight into the community
  const joinHref = user ? `/c/${community.slug}` : `/register?community=${community.slug}`;
  const price = Number(community.monthly_price || 0);

  return (
    <div className="min-h-screen bg-surface">
      {/* Hero */}
      <div className="relative">
        {community.cover_image && (
          <div className="h-56 w-full bg-cover bg-center" style={{ backgroundImage: `url(${community.cover_image})` }} />
        )}
        <div className="max-w-3xl mx-auto px-4 -mt-12 relative">
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-4xl font-bold text-brand-300 overflow-hidden shrink-0">
              {community.icon_image
                ? <img src={community.icon_image} alt="" className="w-full h-full object-cover" />
                : community.name[0]}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="font-display font-extrabold text-3xl text-white">{community.name}</h1>
          <span className="badge bg-surface-card text-gray-400 text-xs capitalize">{community.category}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
          <span className="flex items-center gap-1.5"><Users size={15} /> {community.member_count} members</span>
          <span className="flex items-center gap-1.5">
            <Globe size={15} /> {price > 0 ? `$${price}/mo` : 'Free'}
          </span>
        </div>

        <p className="text-gray-300 leading-relaxed mb-8 whitespace-pre-wrap">{community.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Users, label: 'Community feed' },
            { icon: BookOpen, label: 'Courses' },
            { icon: Calendar, label: 'Live events' },
            { icon: Trophy, label: 'Leaderboard' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="card flex flex-col items-center text-center gap-2 py-5">
              <Icon size={20} className="text-brand-400" />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>

        <Link to={joinHref} className="btn-primary w-full justify-center gap-2 text-base py-3">
          {user ? 'Open community' : (price > 0 ? `Join for $${price}/mo` : 'Join for free')}
          <ArrowRight size={18} />
        </Link>

        {!user && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Already a member? <Link to="/login" className="text-brand-400 hover:underline">Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
