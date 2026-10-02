import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Circle } from 'lucide-react';
import { notificationApi } from '@/api';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/contexts/authStore';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const navigate = useNavigate();

  // Socket connection for real-time notifications.
  // The httpOnly cookie authenticates the handshake (withCredentials); the
  // in-memory token is passed as a fallback when present.
  useEffect(() => {
    if (!user) return;

    const socketUrl = import.meta.env.DEV ? 'http://localhost:4000' : '/';
    const socket = io(socketUrl, { withCredentials: true, auth: token ? { token } : {} });

    socket.on('new_notification', (notif) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (notif?.title) {
        toast(notif.title, { icon: '🔔' });
      }
    });

    return () => socket.disconnect();
  }, [user, token, queryClient]);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await notificationApi.list({ limit: 10 });
      return res.data;
    },
    // We now rely on WebSockets for real-time updates!
    refetchInterval: false, 
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsOpen(false);
    },
  });

  const unreadCount = data?.unread_count || 0;
  const notifications = data?.notifications || [];

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="nav-item w-full text-left relative"
      >
        <Bell size={16} /> Notifications
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-full ml-2 bottom-0 mb-8 w-80 bg-surface-card border border-surface-border rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
          <div className="p-3 border-b border-surface-border flex justify-between items-center bg-surface-dark">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            <div className="flex gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsReadMutation.mutate()}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                >
                  <Check size={12} /> Mark read
                </button>
              )}
              <a
                href="/notifications"
                className="text-xs text-gray-400 hover:text-white"
              >
                View all
              </a>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No notifications yet.
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.is_read) markAsReadMutation.mutate(notif.id);
                      setIsOpen(false);
                      if (notif.reference_id && notif.community_id) {
                        const slug = user?.memberships?.find(m => m.community_id === notif.community_id)?.slug;
                        if (slug) {
                          navigate(`/c/${slug}/posts/${notif.reference_id}`);
                        }
                      }
                    }}
                    className={`p-3 border-b border-surface-border/50 cursor-pointer hover:bg-white/5 transition-colors flex gap-3 items-start ${
                      !notif.is_read ? 'bg-brand-500/5' : ''
                    }`}
                  >
                    <div className="mt-1">
                      {!notif.is_read ? (
                        <Circle size={8} className="fill-brand-400 text-brand-400" />
                      ) : (
                        <div className="w-2" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        {notif.body}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
