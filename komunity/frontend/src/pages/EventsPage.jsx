import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventApi } from '@/api';
import { Calendar as CalendarIcon, Clock, Users, Video, CheckCircle2, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { 
  format, 
  isPast, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from 'date-fns';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/contexts/authStore';
import CreateEventModal from '@/components/CreateEventModal';

// ── Event Modal (when clicking an event) ──────────────────────────────────
function EventDetailsModal({ event, communityId, onClose }) {
  const qc = useQueryClient();
  const past = isPast(new Date(event.ends_at));

  const rsvpMutation = useMutation({
    mutationFn: () =>
      event.rsvped
        ? eventApi.unrsvp(communityId, event.id)
        : eventApi.rsvp(communityId, event.id),
    onSuccess: () => {
      qc.invalidateQueries(['events', communityId]);
      toast.success(event.rsvped ? 'RSVP cancelled' : 'RSVP confirmed! 📅');
      onClose(); // Optional: close or just let it update
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-surface-border w-full max-w-md rounded-2xl overflow-hidden shadow-xl animate-scale-up relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-black/20 hover:bg-black/40 text-gray-400 hover:text-white rounded-full transition-colors"
        >
          <X size={18} />
        </button>
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="shrink-0 w-14 text-center rounded-xl bg-brand-500/10 border border-brand-500/20 p-2">
              <p className="text-[10px] text-brand-400 uppercase font-semibold tracking-wider">
                {format(new Date(event.starts_at), 'MMM')}
              </p>
              <p className="font-display font-black text-2xl text-white leading-none">
                {format(new Date(event.starts_at), 'd')}
              </p>
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-white leading-tight">{event.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                {past && <span className="badge bg-gray-500/10 text-gray-500 text-[10px]">Past</span>}
                {event.is_webinar && (
                  <span className="badge bg-purple-500/10 text-purple-400 text-[10px]">
                    <Video size={10} className="mr-1 inline" /> Webinar
                  </span>
                )}
                {!past && event.rsvped && (
                  <span className="badge bg-green-500/10 text-green-400 text-[10px]">
                    <CheckCircle2 size={10} className="mr-1 inline" /> Going
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {event.description && (
              <p className="text-sm text-gray-300 bg-surface-dark p-3 rounded-xl border border-surface-border">
                {event.description}
              </p>
            )}

            <div className="flex flex-col gap-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-500" />
                <span>
                  {format(new Date(event.starts_at), 'EEEE, h:mm a')} – {format(new Date(event.ends_at), 'h:mm a')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-500" />
                <span>{event.rsvp_count} / {event.max_attendees} attendees</span>
              </div>
            </div>

            <div className="pt-4 border-t border-surface-border flex flex-col gap-2">
              {!past && (
                <button
                  onClick={() => rsvpMutation.mutate()}
                  disabled={rsvpMutation.isPending}
                  className={event.rsvped ? 'btn-secondary w-full justify-center' : 'btn-primary w-full justify-center'}
                >
                  {rsvpMutation.isPending ? 'Updating...' : event.rsvped ? 'Cancel RSVP' : 'RSVP Now'}
                </button>
              )}
              
              {!past && event.daily_room_url && event.rsvped && (
                <a href={event.daily_room_url} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center gap-2 bg-purple-600 hover:bg-purple-500 border-purple-500">
                  <Video size={16} /> Join Call
                </a>
              )}

              {past && event.recording_url && (
                <a href={event.recording_url} target="_blank" rel="noreferrer" className="btn-secondary w-full justify-center gap-2">
                  <Video size={16} /> Watch Recording
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Calendar Page ────────────────────────────────────────────────────
export default function EventsPage() {
  const { community } = useOutletContext();
  const { user } = useAuthStore();
  const communityId = community?.id;
  const [showCreate, setShowCreate] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);

  const membership = user?.memberships?.find(m => m.community_id === communityId);
  const isAdminOrMod = membership?.role === 'admin' || membership?.role === 'moderator';

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', communityId], // fetching all events or month-specific in a real app
    queryFn: () => Promise.all([
      eventApi.list(communityId, { upcoming: true }),
      eventApi.list(communityId, { upcoming: false })
    ]).then(([upcoming, past]) => [...upcoming.data, ...past.data]),
    enabled: !!communityId,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  if (isLoading) return (
    <div className="space-y-4">
      <div className="card animate-pulse-soft h-16" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({length: 35}).map((_, i) => <div key={i} className="card animate-pulse-soft h-24" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {selectedEvent && (
        <EventDetailsModal 
          event={selectedEvent} 
          communityId={communityId} 
          onClose={() => setSelectedEvent(null)} 
        />
      )}

      {showCreate && (
        <CreateEventModal communityId={communityId} onClose={() => setShowCreate(false)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-white">Calendar</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Times shown in your timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
            </p>
          </div>
          <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-lg p-1">
            <button onClick={prevMonth} className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="font-semibold text-gray-200 min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        {isAdminOrMod && (
          <button onClick={() => setShowCreate(true)} className="btn-primary gap-1">
            <Plus size={16} /> Create Event
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden border border-surface-border/50">
        <div className="grid grid-cols-7 bg-surface-dark border-b border-surface-border/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 bg-surface-border gap-px">
          {days.map((day, idx) => {
            const dayEvents = events?.filter(e => isSameDay(new Date(e.starts_at), day)) || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);

            return (
              <div 
                key={day.toISOString()} 
                className={`min-h-[100px] bg-surface p-2 transition-colors ${!isCurrentMonth ? 'opacity-40' : ''} hover:bg-surface-card`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isTodayDate ? 'bg-brand-500 text-white' : 'text-gray-400'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {dayEvents.map(event => {
                    const isPastEvent = isPast(new Date(event.ends_at));
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`w-full text-left text-xs px-2 py-1 rounded truncate transition-colors ${
                          isPastEvent 
                            ? 'bg-surface-dark text-gray-500 hover:bg-white/5' 
                            : event.rsvped 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                              : 'bg-brand-500/10 text-brand-300 hover:bg-brand-500/20'
                        }`}
                      >
                        {format(new Date(event.starts_at), 'h:mm a')} - {event.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
