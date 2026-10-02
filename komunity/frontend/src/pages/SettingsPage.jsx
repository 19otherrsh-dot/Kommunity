import { useAuthStore } from '@/contexts/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi, authApi } from '@/api';
import { Link } from 'react-router-dom';
import { CreditCard, ExternalLink, Bell, Shield, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuthStore();

  const { data: subs } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => billingApi.mySubscriptions().then(r => r.data),
  });

  const { data: creatorData } = useQuery({
    queryKey: ['creator-dashboard'],
    queryFn: () => billingApi.creatorDashboard().then(r => r.data),
  });

  const { data: platformAffiliates } = useQuery({
    queryKey: ['platform-affiliates'],
    queryFn: () => authApi.getPlatformAffiliates().then(r => r.data),
  });

  const openPortal = async () => {
    try {
      const { data } = await billingApi.createPortalSession();
      window.open(data.portal_url, '_blank');
    } catch {
      toast.error('Could not open billing portal');
    }
  };

  const updateSettingsMutation = useMutation({
    mutationFn: (settings) => authApi.updateProfile({ notification_settings: settings }),
    onSuccess: (res) => {
      useAuthStore.getState().updateUser({ notification_settings: res.data.user.notification_settings });
      toast.success('Settings updated');
    },
    onError: () => {
      toast.error('Failed to update settings');
    }
  });

  const updateSetting = (key, value) => {
    const settings = { ...(user?.notification_settings || {}), [key]: value };
    // Optimistic UI update in the store
    useAuthStore.getState().updateUser({ notification_settings: settings });
    updateSettingsMutation.mutate(settings);
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-6">
      <h1 className="font-display font-extrabold text-2xl text-white">Settings</h1>

      {/* Billing */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={16} className="text-brand-400" />
          <h2 className="font-display font-bold text-white">Billing & Subscriptions</h2>
        </div>

        {subs?.length > 0 ? (
          <div className="space-y-2 mb-4">
            {subs.map(sub => (
              <div key={sub.community_id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-surface-border">
                <div>
                  <p className="text-sm font-medium text-gray-200">{sub.name}</p>
                  <p className="text-xs text-gray-500">${sub.monthly_price}/mo</p>
                </div>
                <span className="badge bg-green-500/10 text-green-400">Active</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No active subscriptions.</p>
        )}

        <button onClick={openPortal} className="btn-secondary text-sm gap-2">
          <ExternalLink size={14} /> Manage billing
        </button>
      </section>

      {/* Referrals */}
      {user?.memberships?.length > 0 && (
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-brand-400" />
            <h2 className="font-display font-bold text-white">Affiliate Links</h2>
          </div>
          <p className="text-sm text-gray-400 mb-4">Share your referral links to invite friends. You'll earn points when they join!</p>
          <div className="space-y-3">
            {user.memberships.map(membership => (
              <div key={membership.community_id} className="p-3 rounded-xl bg-surface border border-surface-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-200">{membership.community_name}</p>
                </div>
                <button 
                  onClick={() => {
                    const link = `${window.location.origin}/c/${membership.community_slug}?ref=${user.id}`;
                    navigator.clipboard.writeText(link);
                    toast.success('Referral link copied!');
                  }}
                  className="btn-secondary text-[10px] px-3 py-1.5 h-auto"
                >
                  Copy Link
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Platform Affiliates */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <Gift size={16} className="text-brand-400" />
          <h2 className="font-display font-bold text-white">Platform Partner Program</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Refer creators to Komunity and earn 40% of their platform fees forever!
        </p>

        <div className="p-3 rounded-xl bg-surface border border-brand-500/30 flex flex-col gap-3 mb-6">
          <div>
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Your Partner Link</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={platformAffiliates?.referral_link || ''} 
                className="input py-1.5 text-sm flex-1 bg-surface-card"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(platformAffiliates?.referral_link || '');
                  toast.success('Partner link copied!');
                }}
                className="btn-primary text-sm px-4"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-surface-card border border-surface-border text-center">
            <p className="text-2xl font-bold text-white">{platformAffiliates?.total_referred_users || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Users Referred</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-card border border-surface-border text-center">
            <p className="text-2xl font-bold text-brand-400">{platformAffiliates?.total_referred_communities || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Communities Created</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-card border border-brand-500/20 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-brand-500/5"></div>
            <p className="text-2xl font-bold text-green-400 relative z-10">
              ${Number(platformAffiliates?.estimated_mrr || 0).toFixed(2)}
            </p>
            <p className="text-xs text-brand-300/70 mt-1 relative z-10">Your Est. MRR</p>
          </div>
        </div>
      </section>

      {/* Creator Dashboard */}
      {creatorData?.length > 0 && (
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-brand-400" />
            <h2 className="font-display font-bold text-white">Creator Dashboard</h2>
          </div>

          <div className="space-y-3">
            {creatorData.map(comm => (
              <div key={comm.id} className="p-3 rounded-xl bg-surface border border-surface-border">
                <div className="flex justify-between items-start mb-3">
                  <p className="text-sm font-semibold text-gray-200">{comm.name}</p>
                  <div className="flex gap-2">
                    <Link to={`/c/${comm.slug}/admin`} className="btn-secondary text-[10px] px-2 py-1 h-auto">
                      Manage Tiers
                    </Link>
                    <button
                      onClick={() => {
                        // Same-origin GET — the httpOnly auth cookie is sent automatically
                        window.open(`/api/communities/${comm.id}/export-members`, '_blank');
                      }}
                      className="btn-secondary text-[10px] px-2 py-1 h-auto"
                    >
                      Export CSV
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-surface-card">
                    <p className="text-lg font-bold text-brand-400">${Number(comm.mrr ?? 0).toFixed(0)}</p>
                    <p className="text-[10px] text-gray-600">MRR</p>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-card">
                    <p className="text-lg font-bold text-green-400">{comm.active_members}</p>
                    <p className="text-[10px] text-gray-600">Active</p>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-card">
                    <p className="text-lg font-bold text-gray-400">{comm.churned_members}</p>
                    <p className="text-[10px] text-gray-600">Churned</p>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-card border border-brand-500/10">
                    <p className="text-lg font-bold text-blue-400">{comm.total_posts}</p>
                    <p className="text-[10px] text-gray-600">Posts</p>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-card border border-brand-500/10">
                    <p className="text-lg font-bold text-purple-400">{comm.total_comments}</p>
                    <p className="text-[10px] text-gray-600">Replies</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notifications */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-brand-400" />
          <h2 className="font-display font-bold text-white">Notifications</h2>
        </div>
        
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">Email on Replies</p>
              <p className="text-xs text-gray-500">Get notified when someone replies to your comments.</p>
            </div>
            <input 
              type="checkbox" 
              className="toggle" 
              checked={user?.notification_settings?.email_replies ?? true}
              onChange={(e) => updateSetting('email_replies', e.target.checked)}
              disabled={updateSettingsMutation.isPending}
            />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">Email on Mentions</p>
              <p className="text-xs text-gray-500">Get notified when someone @mentions you.</p>
            </div>
            <input 
              type="checkbox" 
              className="toggle" 
              checked={user?.notification_settings?.email_mentions ?? true}
              onChange={(e) => updateSetting('email_mentions', e.target.checked)}
              disabled={updateSettingsMutation.isPending}
            />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">Activity Digest</p>
              <p className="text-xs text-gray-500">A summary of top posts across your communities.</p>
            </div>
            <select
              className="bg-surface-card border border-surface-border rounded-lg text-sm p-1.5 text-gray-200"
              value={user?.notification_settings?.email_digest || 'weekly'}
              onChange={(e) => updateSetting('email_digest', e.target.value)}
              disabled={updateSettingsMutation.isPending}
            >
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
              <option value="off">Off</option>
            </select>
          </label>
        </div>
      </section>

      <CommunityNewsletters />
    </div>
  );
}

// Per-community newsletter subscribe/unsubscribe (the re-subscribe path).
function CommunityNewsletters() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['email-preferences'],
    queryFn: () => authApi.getEmailPreferences().then(r => r.data),
  });

  const toggle = useMutation({
    mutationFn: ({ community_id, subscribed }) => authApi.updateEmailPreferences({ community_id, subscribed }),
    onSuccess: () => { qc.invalidateQueries(['email-preferences']); toast.success('Newsletter preference updated'); },
    onError: () => toast.error('Failed to update preference'),
  });

  const communities = data?.communities || [];
  if (!communities.length) return null;

  return (
    <section className="card">
      <div className="flex items-center gap-2 mb-4">
        <Mail size={16} className="text-brand-400" />
        <h2 className="font-display font-bold text-white">Community Newsletters</h2>
      </div>
      <div className="space-y-3">
        {communities.map(c => (
          <label key={c.id} className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-200">{c.name}</p>
            <input
              type="checkbox"
              className="toggle"
              checked={c.subscribed}
              onChange={(e) => toggle.mutate({ community_id: c.id, subscribed: e.target.checked })}
              disabled={toggle.isPending}
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">Turning a newsletter back on re-subscribes you even if you previously unsubscribed via email.</p>
    </section>
  );
}
