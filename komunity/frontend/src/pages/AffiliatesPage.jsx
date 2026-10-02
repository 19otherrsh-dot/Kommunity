import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { affiliateApi, billingApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { Copy, Check, Users, DollarSign, TrendingUp, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AffiliatesPage() {
  const { communityId } = useParams();
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['affiliates', communityId],
    queryFn: () => affiliateApi.getMyStats(communityId)
  });

  const { data: payoutStatus } = useQuery({
    queryKey: ['affiliate-connect-status'],
    queryFn: () => billingApi.getAffiliateConnectStatus().then(r => r.data),
  });

  const setupPayouts = async () => {
    setConnecting(true);
    try {
      const { data } = await billingApi.startAffiliateOnboarding();
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start payout setup');
      setConnecting(false);
    }
  };

  const affiliateLink = `${window.location.origin}/c/${communityId}?ref=${user?.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(affiliateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading affiliate data...</div>;

  const { stats, recent, commissionPercent, earnings } = data;
  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Affiliate Program</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Invite your friends and earn {commissionPercent}% recurring commission for every active subscriber.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Unique Link</h2>
        <div className="flex items-center gap-4">
          <input
            type="text"
            readOnly
            value={affiliateLink}
            className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-sm"
          />
          <button
            onClick={handleCopy}
            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Payout setup */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Banknote className="text-green-600" size={22} />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Commission Payouts</h3>
            <p className="text-sm text-gray-500">
              {payoutStatus?.payouts_enabled
                ? 'Connected — commissions are paid out automatically to your bank.'
                : 'Connect a payout account to receive commissions automatically.'}
            </p>
          </div>
        </div>
        {payoutStatus?.payouts_enabled ? (
          <span className="text-sm font-medium text-green-600 flex items-center gap-1"><Check size={16} /> Active</span>
        ) : (
          <button onClick={setupPayouts} disabled={connecting} className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">
            {connecting ? 'Redirecting…' : (payoutStatus?.connected ? 'Finish setup' : 'Set up payouts')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2 text-gray-600 dark:text-gray-400">
            <Users size={20} />
            <h3 className="font-medium">Referrals</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.referral_count}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2 text-gray-600 dark:text-gray-400">
            <DollarSign size={20} />
            <h3 className="font-medium">Total Earned</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{fmt(earnings?.commission_total)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2 text-gray-600 dark:text-gray-400">
            <TrendingUp size={20} />
            <h3 className="font-medium">Pending Payout</h3>
          </div>
          <p className="text-3xl font-bold text-amber-500">{fmt(earnings?.commission_pending)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2 text-gray-600 dark:text-gray-400">
            <TrendingUp size={20} />
            <h3 className="font-medium">Commission Rate</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{commissionPercent}%</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Signups</h2>
        </div>
        
        {recent.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            You haven't referred anyone yet. Share your link to get started!
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recent.map((ref, idx) => (
              <div key={idx} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={ref.avatar_url || 'https://via.placeholder.com/40'} alt={ref.full_name} className="w-10 h-10 rounded-full" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{ref.full_name}</h4>
                    <p className="text-sm text-gray-500">{new Date(ref.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center text-green-600 gap-1 text-sm font-medium bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full">
                  <Check size={14} /> Completed
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
