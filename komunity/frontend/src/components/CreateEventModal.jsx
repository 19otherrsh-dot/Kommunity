import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventApi } from '@/api';
import { X, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateEventModal({ communityId, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    starts_at: '',
    ends_at: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    max_attendees: 50,
    daily_room_url: '',
    is_webinar: false,
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const createMutation = useMutation({
    mutationFn: (data) => eventApi.create(communityId, data),
    onSuccess: () => {
      qc.invalidateQueries(['events', communityId]);
      toast.success('Event created! 📅');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create event'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.starts_at || !form.ends_at) return toast.error('Start and end times are required');
    if (new Date(form.ends_at) <= new Date(form.starts_at)) return toast.error('End must be after start');

    createMutation.mutate({
      ...form,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      max_attendees: Number(form.max_attendees),
      daily_room_url: form.daily_room_url || null,
      is_webinar: form.is_webinar,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-brand-400" />
            <h2 className="font-display font-bold text-lg text-white">Create Event</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Event Title</label>
            <input className="input" placeholder="e.g. Weekly Q&A Call" value={form.title} onChange={set('title')} required />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none min-h-[80px]" placeholder="What's this event about?" value={form.description} onChange={set('description')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Starts at</label>
              <input className="input" type="datetime-local" value={form.starts_at} onChange={set('starts_at')} required />
            </div>
            <div>
              <label className="label">Ends at</label>
              <input className="input" type="datetime-local" value={form.ends_at} onChange={set('ends_at')} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Timezone</label>
              <input className="input" value={form.timezone} onChange={set('timezone')} />
            </div>
            <div>
              <label className="label">Max attendees</label>
              <input className="input" type="number" min="1" value={form.max_attendees} onChange={set('max_attendees')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Daily.co Room URL <span className="text-gray-600">(optional)</span></label>
              <input className="input" placeholder="https://your-domain.daily.co/room-name" value={form.daily_room_url} onChange={set('daily_room_url')} />
            </div>
            <div className="flex flex-col justify-end pb-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.is_webinar} 
                  onChange={e => setForm(f => ({ ...f, is_webinar: e.target.checked }))}
                  className="rounded border-surface-border bg-surface-card text-brand-500 focus:ring-brand-500/50"
                />
                Webinar Mode (Broadcast only)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
