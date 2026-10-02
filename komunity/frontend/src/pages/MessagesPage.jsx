import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messageApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { io } from 'socket.io-client';
import { Send, Search, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

let socket;

export default function MessagesPage() {
  const { user, token } = useAuthStore();
  const qc = useQueryClient();
  const [activeConvId, setActiveConvId] = useState(null);
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);

  // Connect socket. The httpOnly cookie authenticates the handshake
  // (withCredentials); the in-memory token is a fallback when present.
  useEffect(() => {
    if (!user) return;

    // In dev, API runs on port 4000; in prod it's same-origin ('/')
    const socketUrl = import.meta.env.DEV ? 'http://localhost:4000' : '/';
    socket = io(socketUrl, { withCredentials: true, auth: token ? { token } : {} });

    socket.on('new_message', (msg) => {
      // Invalidate both lists when a message arrives
      qc.invalidateQueries(['conversations']);
      qc.invalidateQueries(['messages', msg.conversation_id]);
    });

    return () => socket.disconnect();
  }, [user, token, qc]);

  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messageApi.getConversations().then(res => res.data),
  });

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () => messageApi.getMessages(activeConvId).then(res => res.data),
    enabled: !!activeConvId,
  });

  const sendMutation = useMutation({
    mutationFn: (content) => messageApi.sendMessage({ conversationId: activeConvId, content }),
    onSuccess: (newMsg) => {
      setDraft('');
      qc.setQueryData(['messages', activeConvId], old => [...(old || []), newMsg]);
      qc.invalidateQueries(['conversations']);
    }
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMutation.mutate(draft);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConv = conversations.find(c => c.id === activeConvId);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] -m-6 border-t border-surface-border">
      {/* Sidebar */}
      <div className="w-80 border-r border-surface-border bg-surface-card flex flex-col">
        <div className="p-4 border-b border-surface-border">
          <h2 className="font-display font-bold text-lg text-white mb-4">Messages</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="input-field w-full pl-9 py-2 text-sm"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">No conversations yet.</div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full p-4 flex items-start gap-3 border-b border-surface-border/50 text-left transition-colors ${
                  activeConvId === conv.id ? 'bg-white/5' : 'hover:bg-white/5'
                }`}
              >
                <img 
                  src={conv.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.full_name)}&background=random`} 
                  alt={conv.full_name} 
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className="text-sm font-semibold text-gray-200 truncate pr-2">{conv.full_name}</p>
                    {conv.last_message_at && (
                      <span className="text-xs text-gray-500 shrink-0">
                        {format(new Date(conv.last_message_at), 'MMM d')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{conv.last_message || 'Started a conversation'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-surface">
        {activeConvId ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-surface-border flex items-center px-6 gap-3 shrink-0">
              <img 
                src={activeConv?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv?.full_name || 'User')}&background=random`} 
                alt={activeConv?.full_name} 
                className="w-8 h-8 rounded-full"
              />
              <span className="font-semibold text-gray-200">{activeConv?.full_name}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMsgs ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_id === user?.id;
                  const showAvatar = !isMe && (i === 0 || messages[i-1].sender_id !== msg.sender_id);
                  
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <div className="w-8 shrink-0">
                          {showAvatar && (
                            <img 
                              src={activeConv?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv?.full_name)}&background=random`} 
                              className="w-8 h-8 rounded-full"
                              alt=""
                            />
                          )}
                        </div>
                      )}
                      
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isMe 
                          ? 'bg-brand-600 text-white rounded-br-sm' 
                          : 'bg-surface-card border border-surface-border text-gray-200 rounded-bl-sm'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <span className={`text-[10px] mt-1 block ${isMe ? 'text-brand-200' : 'text-gray-500'}`}>
                          {format(new Date(msg.created_at), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-surface-card border-t border-surface-border">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Type a message..."
                  className="input-field flex-1 bg-surface"
                />
                <button 
                  type="submit" 
                  disabled={!draft.trim() || sendMutation.isPending}
                  className="btn-primary"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <MessageSquare size={48} className="text-surface-border mb-4" />
            <p className="font-display">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
