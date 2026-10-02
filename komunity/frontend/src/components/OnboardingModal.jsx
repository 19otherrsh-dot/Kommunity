import { useState, useEffect } from 'react';
import { useAuthStore } from '@/contexts/authStore';
import { authApi, uploadApi } from '@/api';
import toast from 'react-hot-toast';
import { Camera, ArrowRight, User } from 'lucide-react';

export default function OnboardingModal({ isOpen, onClose }) {
  const { user, updateUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    bio: user?.bio ?? '',
    avatar_url: user?.avatar_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        full_name: user?.full_name ?? '',
        bio: user?.bio ?? '',
        avatar_url: user?.avatar_url ?? '',
      });
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: { upload_url, public_url } } = await uploadApi.getPresignedUrl(file.name, file.type);
      
      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setForm(f => ({ ...f, avatar_url: public_url }));
      toast.success('Avatar uploaded!');
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!form.full_name) {
        toast.error('Please enter your name');
        return;
      }
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      const { data } = await authApi.updateProfile(form);
      updateUser(data);
      toast.success('Welcome aboard!');
      onClose();
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-brand-500/20 rounded-full flex items-center justify-center border border-brand-500/40">
              <User className="text-brand-400" size={32} />
            </div>
          </div>
          <h2 className="text-center font-display font-bold text-2xl text-white mb-2">
            {step === 1 ? 'Welcome to Komunity' : 'Complete your profile'}
          </h2>
          <p className="text-center text-gray-400 text-sm mb-8">
            {step === 1
              ? 'Lets get to know you before you jump in.'
              : 'Add a photo and bio so people know who you are.'}
          </p>

          <form onSubmit={handleSave} className="space-y-5">
            {step === 1 ? (
              <label className="block">
                <span className="block text-xs font-medium text-gray-400 mb-1">Full Name</span>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g. John Doe"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  autoFocus
                />
              </label>
            ) : (
              <>
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-surface border border-surface-border flex items-center justify-center text-3xl font-bold text-gray-400 overflow-hidden">
                      {form.avatar_url ? (
                        <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        form.full_name?.[0] ?? '?'
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-surface border border-surface-border flex items-center justify-center hover:bg-surface-muted transition-colors shadow-sm cursor-pointer">
                      {uploading ? (
                        <div className="w-3 h-3 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
                      ) : (
                        <Camera size={14} className="text-brand-400" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                    </label>
                  </div>
                </div>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-400 mb-1">Short Bio</span>
                  <textarea
                    className="input w-full min-h-[80px]"
                    placeholder="What do you do? What are your interests?"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    autoFocus
                  />
                </label>
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full flex justify-center py-2.5 text-base"
              >
                {step === 1 ? (
                  <>Continue <ArrowRight size={16} className="ml-2" /></>
                ) : (
                  saving ? 'Saving...' : 'Finish setup'
                )}
              </button>
            </div>
            
            {step === 2 && (
              <button
                type="button"
                onClick={() => onClose()}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-400 mt-3"
              >
                Skip for now
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
