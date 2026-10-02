import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/contexts/authStore';

export default function AuthLayout() {
  const user = useAuthStore(s => s.user);
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Gradient orb */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-extrabold text-4xl text-white tracking-tight">
            Komun<span className="text-brand-400">ity</span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Community-Led Learning Platform</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
