import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/contexts/authStore';
import PushNotificationManager from '@/components/PushNotificationManager';

// Layouts
import AppLayout from '@/components/Layout/AppLayout';
import AuthLayout from '@/components/Layout/AuthLayout';

// Pages
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import DiscoverPage from '@/pages/DiscoverPage';
import CommunityPage from '@/pages/CommunityPage';
import FeedPage from '@/pages/FeedPage';
import PostDetailPage from '@/pages/PostDetailPage';
import CoursesPage from '@/pages/CoursesPage';
import CoursePage from '@/pages/CoursePage';
import CourseBuilderPage from '@/pages/CourseBuilderPage';
import EventsPage from '@/pages/EventsPage';
import MembersPage from '@/pages/MembersPage';
import MemberProfilePage from '@/pages/MemberProfilePage';
import LeaderboardPage from '@/pages/LeaderboardPage';
import AdminPage from '@/pages/AdminPage';
import AnalyticsDashboardPage from '@/pages/AnalyticsDashboardPage';
import SettingsPage from '@/pages/SettingsPage';
import AffiliatesPage from '@/pages/AffiliatesPage';
import ProfilePage from '@/pages/ProfilePage';
import MessagesPage from '@/pages/MessagesPage';
import CreateCommunityPage from '@/pages/CreateCommunityPage';
import NotificationsPage from '@/pages/NotificationsPage';
import PublicCommunityPage from '@/pages/PublicCommunityPage';
import StorePage from '@/pages/StorePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const ProtectedRoute = ({ children }) => {
  const user = useAuthStore(s => s.user);
  const authChecked = useAuthStore(s => s.authChecked);
  // Wait for the cookie-based session probe to finish before deciding
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
};

export default function App() {
  const bootstrap = useAuthStore(s => s.bootstrap);
  const hostname = window.location.hostname;
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN || 'localhost';
  const isCustomDomain = hostname !== mainDomain && hostname !== '127.0.0.1';

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public, unauthenticated community landing page (shareable / SEO) */}
          <Route path="/c/:communitySlug/about" element={<PublicCommunityPage />} />

          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* App routes — protected */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {!isCustomDomain && (
              <>
                <Route index element={<Navigate to="/discover" replace />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/create-community" element={<CreateCommunityPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />

                {/* Community-scoped routes */}
                <Route path="/c/:communitySlug" element={<CommunityPage />}>
                  <Route index element={<Navigate to="spaces/general" replace />} />
                  <Route path="feed" element={<Navigate to="../spaces/general" replace />} />
                  <Route path="spaces/:spaceSlug" element={<FeedPage />} />
                  <Route path="posts/:postId" element={<PostDetailPage />} />
                  <Route path="courses" element={<CoursesPage />} />
                  <Route path="courses/:courseId" element={<CoursePage />} />
                  <Route path="courses/:courseId/edit" element={<CourseBuilderPage />} />
                  <Route path="store" element={<StorePage />} />
                  <Route path="events" element={<EventsPage />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="members/:userId" element={<MemberProfilePage />} />
                  <Route path="leaderboard" element={<LeaderboardPage />} />
                  <Route path="analytics" element={<AnalyticsDashboardPage />} />
                  <Route path="affiliates" element={<AffiliatesPage />} />
                  <Route path="admin" element={<AdminPage />} />
                </Route>
              </>
            )}

            {isCustomDomain && (
              <Route path="/" element={<CommunityPage isCustomDomain={true} />}>
                <Route index element={<Navigate to="spaces/general" replace />} />
                <Route path="feed" element={<Navigate to="spaces/general" replace />} />
                <Route path="spaces/:spaceSlug" element={<FeedPage />} />
                <Route path="posts/:postId" element={<PostDetailPage />} />
                <Route path="courses" element={<CoursesPage />} />
                <Route path="courses/:courseId" element={<CoursePage />} />
                <Route path="courses/:courseId/edit" element={<CourseBuilderPage />} />
                <Route path="store" element={<StorePage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="members/:userId" element={<MemberProfilePage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />
                <Route path="analytics" element={<AnalyticsDashboardPage />} />
                <Route path="affiliates" element={<AffiliatesPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="spaces/general" replace />} />
              </Route>
            )}
          </Route>

          {/* 404 fallback */}
          {!isCustomDomain && <Route path="*" element={<Navigate to="/discover" replace />} />}
        </Routes>
      </BrowserRouter>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#17171e',
            color: '#e8e8f0',
            border: '1px solid #2a2a35',
            borderRadius: '10px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#6366f1', secondary: '#fff' } },
        }}
      />
      <PushNotificationManager />
    </QueryClientProvider>
  );
}
