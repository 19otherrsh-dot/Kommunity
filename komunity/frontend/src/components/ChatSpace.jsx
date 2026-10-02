import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { spaceApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { Send } from 'lucide-react';
import { format } from 'date-fns';

export default function ChatSpace({ communityId, space }) {
  const { user, token } = useAuthStore();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['space-messages', space.id],
    queryFn: () => spaceApi.listMessages(communityId, space.id, { limit: 50 }).then(r => r.data),
    enabled: !!space.id,
  });

  // Join the space room and listen for live messages
  useEffect(() => {
    if (!user || !space.id) return;
    const socketUrl = import.meta.env.DEV ? 'http://localhost:4000' : '/';
    const socket = io(socketUrl, { withCredentials: true, auth: token ? { token } : {} });

    socket.emit('join_space', space.id);
    socket.on('space_message', (msg) => {
      qc.setQueryData(['space-messages', space.id], (old = []) =>
        old.some(m => m.id === msg.id) ? old : [...old, msg]
      );
    });

    return () => {
      socket.emit('leave_space', space.id);
      socket.disconnect();
    };
  }, [user, token, space.id, qc]);

  // Auto-scroll to the latest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft('');
    try {
      const { data } = await spaceApi.sendMessage(communityId, space.id, content);
      qc.setQueryData(['space-messages', space.id], (old = []) =>
        old.some(m => m.id === data.id) ? old : [...old, data]
      );
    } catch (_) {
      setDraft(content); // restore on failure
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-3">
        <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
          <span className="text-2xl">{space.icon_emoji}</span> {space.name}
        </h2>
        {space.description && <p className="text-sm text-gray-500 mt-0.5">{space.description}</p>}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-10">No messages yet. Say hello! 👋</p>
        ) : (
          messages.map(m => {
            const mine = m.user_id === user?.id;
            return (
              <div key={m.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0">
                  {m.author_name?.[0] ?? '?'}
                </div>
                <div className={`max-w-[70%] ${mine ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-300">{m.author_name}</span>
                    <span className="text-[10px] text-gray-600">{format(new Date(m.created_at), 'h:mm a')}</span>
                  </div>
                  <div className={`inline-block text-sm px-3 py-2 rounded-2xl ${mine ? 'bg-brand-500/20 text-brand-100' : 'bg-surface-card text-gray-200'} whitespace-pre-wrap break-words`}>
                    {m.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex items-center gap-2 border-t border-surface-border pt-3">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={`Message ${space.name}…`}
          className="input flex-1"
          maxLength={4000}
        />
        <button type="submit" disabled={sending || !draft.trim()} className="btn-primary px-4">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
