// ProfilePage.jsx
import { useState } from 'react';
import { useAuthStore } from '@/contexts/authStore';
import { authApi } from '@/api';
import toast from 'react-hot-toast';
import { Camera, Trophy, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { uploadApi } from '@/api';

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    bio: user?.bio ?? '',
    avatar_url: user?.avatar_url ?? '',
    website_url: user?.website_url ?? '',
    twitter_url: user?.twitter_url ?? '',
    linkedin_url: user?.linkedin_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      // 1. Get presigned URL
      const { data: { upload_url, public_url } } = await uploadApi.getPresignedUrl(file.name, file.type);
      
      // 2. Upload to S3
      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // 3. Update form & backend immediately
      setForm(f => ({ ...f, avatar_url: public_url }));
      const { data } = await authApi.updateProfile({ ...form, avatar_url: public_url });
      updateUser(data);
      toast.success('Avatar updated!');
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authApi.updateProfile(form);
      updateUser(data);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="font-display font-extrabold text-2xl text-white mb-6">Your Profile</h1>

      <div className="card">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-surface-border">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-brand-500/20 border-2 border-brand-500/40 flex items-center justify-center text-2xl font-bold text-brand-300 overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.full_name?.[0] ?? '?'
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-surface-card border border-surface-border flex items-center justify-center hover:bg-surface-muted transition-colors cursor-pointer">
              {uploading ? (
                <div className="w-3 h-3 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
              ) : (
                <Camera size={11} className="text-gray-400" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>
          <div>
            <p className="font-semibold text-white">{user?.full_name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.full_name} onChange={set('full_name')} />
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input resize-none min-h-[80px]" value={form.bio} onChange={set('bio')} placeholder="Tell people about yourself…" />
          </div>
          <div>
            <label className="label">Website</label>
            <input className="input" type="url" value={form.website_url} onChange={set('website_url')} placeholder="https://yoursite.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Twitter</label>
              <input className="input" value={form.twitter_url} onChange={set('twitter_url')} placeholder="https://x.com/handle" />
            </div>
            <div>
              <label className="label">LinkedIn</label>
              <input className="input" value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="https://linkedin.com/in/..." />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      {/* Gamification / Memberships Overview */}
      {user?.memberships?.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display font-extrabold text-xl text-white mb-4">Your Communities</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {user.memberships.map((m) => (
              <Link key={m.community_id} to={`/c/${m.slug}/members/${user.id}`} className="card hover:border-brand-500/30 transition-colors flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-center font-bold text-xl text-brand-400 overflow-hidden shrink-0">
                  {m.icon_image ? <img src={m.icon_image} alt="" className="w-full h-full object-cover" /> : m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-200 truncate mb-1">{m.name}</h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-brand-400">
                      <Star size={12} /> {m.points?.toLocaleString() || 0} pts
                    </span>
                    <span className="flex items-center gap-1 text-gray-400">
                      <Trophy size={12} /> Level {m.level || 1}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
