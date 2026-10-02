import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { communityApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { ArrowLeft, ArrowRight, Sparkles, Globe, Lock, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = ['Details', 'Visibility', 'Pricing', 'Launch'];

export default function CreateCommunityPage() {
  const navigate = useNavigate();
  const { fetchMe } = useAuthStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    is_public: true,
    monthly_price: 0,
  });

  const set = (k) => (e) => {
    const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setForm(f => ({ ...f, [k]: val }));
  };

  // Auto-generate slug from name
  const handleNameChange = (e) => {
    const name = e.target.value;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    setForm(f => ({ ...f, name, slug }));
  };

  const createMutation = useMutation({
    mutationFn: (data) => communityApi.create(data),
    onSuccess: async (res) => {
      await fetchMe();
      toast.success('Community created! 🎉');
      navigate(`/c/${res.data.slug || form.slug}`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create community'),
  });

  const handleFinish = () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.slug.trim()) return toast.error('Slug is required');
    createMutation.mutate(form);
  };

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0 && form.slug.trim().length > 0;
    return true;
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl text-white flex items-center gap-3">
          <Sparkles size={28} className="text-brand-400" />
          Create Community
        </h1>
        <p className="text-gray-500 mt-1">Build your own learning community in minutes</p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
              i < step ? 'bg-brand-500 text-white' :
              i === step ? 'bg-brand-500/20 border-2 border-brand-500 text-brand-400' :
              'bg-surface-card border border-surface-border text-gray-600'
            }`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i === step ? 'text-brand-400' : 'text-gray-600'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${i < step ? 'bg-brand-500' : 'bg-surface-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="card">
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="label">Community Name</label>
              <input className="input" placeholder="e.g. Indie Hackers Club" value={form.name} onChange={handleNameChange} autoFocus />
            </div>
            <div>
              <label className="label">URL Slug</label>
              <div className="flex items-center gap-0">
                <span className="text-xs text-gray-500 bg-surface border border-surface-border border-r-0 rounded-l-lg px-3 py-2.5 whitespace-nowrap">
                  komunity.app/c/
                </span>
                <input className="input rounded-l-none" value={form.slug} onChange={set('slug')} placeholder="indie-hackers" />
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input resize-none min-h-[100px]" placeholder="What is your community about?" value={form.description} onChange={set('description')} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-gray-400 mb-4">Choose who can see and join your community.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_public: true }))}
                className={`p-5 rounded-xl border text-left transition-all ${
                  form.is_public
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-border hover:border-gray-600'
                }`}
              >
                <Globe size={24} className={form.is_public ? 'text-brand-400 mb-3' : 'text-gray-600 mb-3'} />
                <p className="font-semibold text-white text-sm">Public</p>
                <p className="text-xs text-gray-500 mt-1">Anyone can discover and join</p>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_public: false }))}
                className={`p-5 rounded-xl border text-left transition-all ${
                  !form.is_public
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-border hover:border-gray-600'
                }`}
              >
                <Lock size={24} className={!form.is_public ? 'text-brand-400 mb-3' : 'text-gray-600 mb-3'} />
                <p className="font-semibold text-white text-sm">Private</p>
                <p className="text-xs text-gray-500 mt-1">Invite-only, hidden from Discover</p>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-gray-400 mb-4">Set a monthly subscription price, or keep it free. You can always add paid tiers later.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, monthly_price: 0 }))}
                className={`p-5 rounded-xl border text-center transition-all ${
                  form.monthly_price === 0
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-border hover:border-gray-600'
                }`}
              >
                <p className="font-display font-bold text-2xl text-white">Free</p>
                <p className="text-xs text-gray-500 mt-1">No base membership cost</p>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, monthly_price: 9.99 }))}
                className={`p-5 rounded-xl border text-center transition-all ${
                  form.monthly_price > 0
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-surface-border hover:border-gray-600'
                }`}
              >
                <p className="font-display font-bold text-2xl text-white">Paid</p>
                <p className="text-xs text-gray-500 mt-1">Charge a monthly fee</p>
              </button>
            </div>
            {form.monthly_price > 0 && (
              <div>
                <label className="label">Monthly Price (USD)</label>
                <input className="input" type="number" min="1" step="0.01" value={form.monthly_price} onChange={set('monthly_price')} />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-6 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-4xl font-bold text-brand-300 mb-4">
              {form.name[0] || '?'}
            </div>
            <h3 className="font-display font-bold text-xl text-white mb-1">{form.name || 'Your Community'}</h3>
            <p className="text-sm text-gray-500 mb-4">{form.description || 'No description'}</p>
            <div className="flex justify-center gap-3 mb-6">
              <span className="badge bg-brand-500/10 text-brand-400">{form.is_public ? 'Public' : 'Private'}</span>
              <span className="badge bg-surface-card text-gray-400">{form.monthly_price > 0 ? `$${form.monthly_price}/mo` : 'Free'}</span>
            </div>
            <p className="text-xs text-gray-600">Everything looks good? Hit launch to create your community!</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => step === 0 ? navigate(-1) : setStep(s => s - 1)}
          className="btn-secondary"
        >
          <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="btn-primary"
            disabled={!canNext()}
          >
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="btn-primary"
            disabled={createMutation.isPending}
          >
            <Sparkles size={14} /> {createMutation.isPending ? 'Creating…' : 'Launch Community'}
          </button>
        )}
      </div>
    </div>
  );
}
