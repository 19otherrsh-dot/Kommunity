import { Outlet, useParams, NavLink, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { communityApi, spaceApi } from '@/api';
import { BookOpen, Calendar, Users, Trophy, Lock, Settings, Gift, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/contexts/authStore';
import JoinCommunityModal from '@/components/JoinCommunityModal';
import { sanitizeCss } from '@/utils/sanitize';

export default function CommunityPage({ isCustomDomain }) {
  const { communitySlug, spaceSlug } = useParams();
  const { user } = useAuthStore();
  const hostname = window.location.hostname;

  const { data: community, isLoading, isError } = useQuery({
    queryKey: ['community', isCustomDomain ? hostname : communitySlug],
    queryFn: () => isCustomDomain 
      ? communityApi.getByDomain(hostname).then(r => r.data)
      : communityApi.get(communitySlug).then(r => r.data),
    retry: false,
  });

  const isMember = user?.memberships?.some(m => m.community_id === community?.id);

  const { data: spaces } = useQuery({
    queryKey: ['spaces', community?.id],
    queryFn: () => spaceApi.list(community.id).then(r => r.data),
    enabled: !!community?.id,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse p-8">
        <div className="h-40 bg-surface-card rounded-xl mb-4" />
        <div className="h-6 bg-surface-card rounded w-48 mb-2" />
        <div className="h-4 bg-surface-card rounded w-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <h2 className="text-2xl font-bold mb-2">Community Not Found</h2>
        <p className="text-gray-500 max-w-md">
          {isCustomDomain 
            ? `The domain ${hostname} is not connected to any community.` 
            : 'The community you are looking for does not exist or has been removed.'}
        </p>
      </div>
    );
  }

  const basePath = isCustomDomain ? '' : `/c/${community?.slug || communitySlug}`;

  // If we're at /c/:slug with no sub-route, redirect to the default space
  const defaultSpace = spaces?.find(s => s.is_default) ?? spaces?.[0];

  const tabs = [
    { to: 'courses',     icon: BookOpen,     label: 'Courses' },
    { to: 'store',       icon: ShoppingBag,  label: 'Store' },
    { to: 'events',      icon: Calendar,     label: 'Events' },
    { to: 'members',     icon: Users,        label: 'Members' },
    { to: 'leaderboard', icon: Trophy,       label: 'Leaderboard' },
    { to: 'affiliates',  icon: Gift,         label: 'Affiliates' },
  ];

  // Show admin tab only for community admins
  const membership = user?.memberships?.find(m => m.community_id === community?.id);
  if (membership?.role === 'admin') {
    tabs.push({ to: 'admin', icon: Settings, label: 'Admin' });
  }

  const handleLockedSpace = (spaceName, level) => {
    toast(`Reach Level ${level} to access #${spaceName}. Keep engaging!`, {
      icon: '🔒',
      duration: 3000,
    });
  };

  const themeConfig = community?.theme_config || { preset: 'indigo', custom_css: '' };

  return (
    <div className={`min-h-screen theme-${themeConfig.preset}`}>
      {themeConfig.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: sanitizeCss(themeConfig.custom_css) }} />
      )}
      {/* Community Header */}
      <div className="border-b border-surface-border bg-surface-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 pt-4 pb-0">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold text-xl">
              {community?.name?.[0]}
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-white leading-tight">
                {community?.name}
              </h1>
              <p className="text-xs text-gray-500 truncate max-w-xs">{community?.description}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
              <Users size={14} />
              <span>{community?.member_count?.toLocaleString()} members</span>
            </div>
          </div>

          {/* Tab Nav — only non-feed sections */}
          <nav className="flex gap-0.5 -mb-px">
            {tabs.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 ${
                    isActive
                      ? 'border-brand-400 text-brand-300'
                      : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Content Area with Spaces Sidebar */}
      <div className="max-w-6xl mx-auto px-6 py-6 flex gap-6 relative">
        {/* Not a member overlay */}
        {!isMember && (
          <JoinCommunityModal community={community} />
        )}

        {/* Spaces Sidebar */}
        <aside className={`w-52 shrink-0 hidden md:block ${!isMember ? 'opacity-20 pointer-events-none blur-sm' : ''}`}>
          <div className="sticky top-24">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">
              Spaces
            </p>
            <nav className="space-y-0.5">
              {spaces?.map(space => {
                const isLocked = space.is_locked;
                if (isLocked) {
                  return (
                    <button
                      key={space.id}
                      onClick={() => handleLockedSpace(space.name, space.min_level_required)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm text-gray-600 hover:bg-white/5 transition-all group cursor-pointer"
                    >
                      <span className="text-base shrink-0 opacity-40">{space.icon_emoji}</span>
                      <span className="truncate opacity-60">{space.name}</span>
                      <Lock size={12} className="ml-auto text-amber-500/60 shrink-0" />
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={space.id}
                    to={`${basePath}/spaces/${space.slug}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-brand-500/10 text-brand-300 font-semibold'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                      }`
                    }
                  >
                    <span className="text-base shrink-0">{space.icon_emoji}</span>
                    <span className="truncate">{space.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className={`flex-1 min-w-0 ${!isMember ? 'opacity-20 pointer-events-none blur-sm' : ''}`}>
          <Outlet context={{ community, spaces, currentSpaceSlug: spaceSlug }} />
        </div>
      </div>
    </div>
  );
}
