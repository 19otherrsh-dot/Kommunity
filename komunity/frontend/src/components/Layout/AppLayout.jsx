import { useState } from 'react';
import { Outlet, NavLink, useParams } from 'react-router-dom';
import { useAuthStore } from '@/contexts/authStore';
import {
  Home, BookOpen, Calendar, Users, Trophy, Settings,
  Compass, LogOut, Plus, ChevronRight, MessageSquare, Menu, X
} from 'lucide-react';
import NotificationBell from '../NotificationBell';
import GlobalSearch from '../GlobalSearch';
import OnboardingModal from '../OnboardingModal';

const Sidebar = ({ isOpen, onClose }) => {
  const { communitySlug } = useParams();
  const { user, logout } = useAuthStore();
  const memberships = user?.memberships ?? [];

  const communityNav = communitySlug ? [
    { to: `/c/${communitySlug}/feed`,        icon: Home,     label: 'Feed' },
    { to: `/c/${communitySlug}/courses`,     icon: BookOpen, label: 'Courses' },
    { to: `/c/${communitySlug}/events`,      icon: Calendar, label: 'Events' },
    { to: `/c/${communitySlug}/members`,     icon: Users,    label: 'Members' },
    { to: `/c/${communitySlug}/leaderboard`, icon: Trophy,   label: 'Leaderboard' },
  ] : [];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-60 bg-surface-card border-r border-surface-border flex flex-col z-40 transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-surface-border flex justify-between items-center">
          <span className="font-display font-bold text-lg text-white tracking-tight">
            Komun<span className="text-brand-400">ity</span>
          </span>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {/* Global nav */}
        <NavLink to="/discover" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Compass size={16} /> Discover
        </NavLink>
        <NavLink to="/messages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <MessageSquare size={16} /> Messages
        </NavLink>

        {/* My Communities */}
        {memberships.length > 0 && (
          <div className="mt-4">
            <p className="px-3 text-xs text-gray-600 uppercase tracking-wider font-medium mb-1">
              My Communities
            </p>
            {memberships.map(m => (
              <NavLink
                key={m.community_id}
                to={`/c/${m.slug}`}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="w-5 h-5 rounded-md bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">
                  {m.name[0]}
                </span>
                <span className="truncate">{m.name}</span>
              </NavLink>
            ))}
          </div>
        )}

        {/* Community sub-nav */}
        {communitySlug && communityNav.length > 0 && (
          <div className="mt-4">
            <p className="px-3 text-xs text-gray-600 uppercase tracking-wider font-medium mb-1">
              Navigate
            </p>
            {communityNav.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-surface-border p-3 space-y-0.5">
        <NotificationBell />
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={16} /> Settings
        </NavLink>
        <button
          onClick={logout}
          className="nav-item w-full text-left text-red-400 hover:text-red-300 hover:bg-red-500/5"
        >
          <LogOut size={16} /> Sign out
        </button>

        {/* User info */}
        <NavLink to="/profile" className="flex items-center gap-3 mt-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-brand-500/30 border border-brand-500/40 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0">
            {user?.full_name?.[0] ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <ChevronRight size={14} className="text-gray-600 shrink-0 ml-auto" />
        </NavLink>
      </div>
    </aside>
    </>
  );
};

export default function AppLayout() {
  const { communitySlug } = useParams(); // Could use a context if we need communityId for scoped search
  const { user } = useAuthStore();
  const showOnboarding = user && (!user.full_name || !user.bio);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen relative">
      <OnboardingModal isOpen={showOnboarding && !onboardingDismissed} onClose={() => setOnboardingDismissed(true)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 md:ml-60 min-h-screen flex flex-col min-w-0">
        <header className="h-16 border-b border-surface-border bg-surface-card flex items-center px-4 md:px-6 shrink-0 sticky top-0 z-20 gap-4">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-white shrink-0">
            <Menu size={24} />
          </button>
          <div className="flex-1 max-w-xl min-w-0">
            <GlobalSearch communitySlug={communitySlug} />
          </div>
        </header>
        <div className="flex-1 bg-surface">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
