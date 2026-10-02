import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/api';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, Circle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-page'],
    queryFn: async () => {
      // Let's get more than just 10 for the full page
      const res = await notificationApi.list({ limit: 50 });
      return res.data;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      toast.success('All notifications marked as read');
    },
  });

  const unreadCount = data?.unread_count || 0;
  const notifications = data?.notifications || [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
            <Bell className="text-brand-400" size={24} />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-3xl text-white mb-1">
              Notifications
            </h1>
            <p className="text-gray-500">Stay updated on your community activity</p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
            className="btn-secondary gap-2"
          >
            <Check size={16} /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card animate-pulse-soft h-20" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 card text-gray-500">
          <Bell size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-display font-bold text-lg text-white">All caught up!</p>
          <p className="text-sm mt-1">You have no notifications.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-surface-border">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.is_read) markAsReadMutation.mutate(notif.id);
                  if (notif.action_url) {
                    navigate(notif.action_url);
                  }
                }}
                className={`p-4 hover:bg-white/5 transition-colors cursor-pointer flex gap-4 items-start ${
                  !notif.is_read ? 'bg-brand-500/5' : ''
                }`}
              >
                <div className="mt-1.5 shrink-0">
                  {!notif.is_read ? (
                    <Circle size={10} className="fill-brand-400 text-brand-400" />
                  ) : (
                    <div className="w-2.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className={`text-base ${!notif.is_read ? 'text-white font-medium' : 'text-gray-200'}`}>
                      {notif.title}
                    </p>
                    <span className="text-xs text-gray-500 shrink-0 mt-0.5">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{notif.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
