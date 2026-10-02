import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { communityApi, tierApi, billingApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';

export default function JoinCommunityModal({ community, onJoined }) {
  const { fetchMe } = useAuthStore();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const [wantsNewsletter, setWantsNewsletter] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const isApplication = community.join_mode === 'application';
  const intakeQuestions = community.intake_questions || [];
  const [answers, setAnswers] = useState(intakeQuestions.map(() => ''));

  const { data: tiers, isLoading: loadingTiers } = useQuery({
    queryKey: ['tiers', community.id],
    queryFn: () => tierApi.list(community.id).then(r => r.data),
  });

  const handleJoin = async (tierId, price) => {
    setIsJoining(true);
    try {
      if (price > 0) {
        // Redirect to Stripe checkout, carrying the referrer for affiliate commissions
        const { data } = await billingApi.createCheckout(community.id, tierId, 'month', ref);
        window.location.href = data.url;
      } else {
        // Free join or application
        const payload = { wants_newsletter: wantsNewsletter, ref };
        if (isApplication) {
          payload.intake_answers = answers;
        }
        const res = await communityApi.join(community.id, payload);
        await fetchMe();
        if (res.data.status === 'pending') {
          toast.success('Application submitted! Wait for approval.');
        } else {
          toast.success(`Joined ${community.name}!`);
        }
        onJoined?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join community');
    } finally {
      setIsJoining(false);
    }
  };

  const handleWeb3Join = async () => {
    if (!window.ethereum) {
      toast.error("No crypto wallet found. Please install MetaMask, Rabby, or Coinbase Wallet.");
      return;
    }

    setIsJoining(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      
      const signer = await provider.getSigner();
      const message = "Verify wallet ownership for Komunity";
      const signature = await signer.signMessage(message);

      const token = useAuthStore.getState().token;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/web3/communities/${community.id}/join`, {
        method: 'POST',
        credentials: 'include', // send the httpOnly auth cookie
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ address, message, signature })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify token');

      await fetchMe();
      toast.success(data.message);
      onJoined?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Web3 Join failed');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-surface-border text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold text-3xl mb-4">
            {community.name[0]}
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Join {community.name}</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">{community.description}</p>
        </div>

        <div className="p-6 bg-surface-card">
          <h3 className="font-semibold text-white mb-4">
            {community.token_gate_enabled ? 'Web3 Token Gate' : 'Select a Membership Tier'}
          </h3>
          
          {community.token_gate_enabled ? (
            <div className="mb-6 space-y-4">
              <p className="text-sm text-gray-400">
                This community requires you to hold a specific token to join. Connect your wallet to verify your holdings.
              </p>
              <div className="bg-surface p-4 rounded-xl border border-surface-border mb-4">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Required Contract</p>
                <p className="text-sm font-mono text-brand-400">{community.token_contract_address}</p>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Network</p>
                    <p className="text-sm text-white capitalize">{community.token_network}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">Min Balance</p>
                    <p className="text-sm text-white">{community.min_token_balance}</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleWeb3Join} 
                disabled={isJoining}
                className="btn-primary w-full"
              >
                {isJoining ? 'Verifying...' : 'Connect Wallet & Verify'}
              </button>
            </div>
          ) : isApplication && intakeQuestions.length > 0 ? (
            <div className="mb-6 space-y-4">
              <h4 className="font-bold text-white mb-2">Answer the following questions to apply:</h4>
              {intakeQuestions.map((q, idx) => (
                <div key={idx}>
                  <label className="block text-sm font-semibold text-gray-300 mb-1">{q}</label>
                  <textarea
                    className="input w-full min-h-[80px]"
                    value={answers[idx]}
                    onChange={(e) => {
                      const newAns = [...answers];
                      newAns[idx] = e.target.value;
                      setAnswers(newAns);
                    }}
                    required
                  />
                </div>
              ))}
              <button 
                onClick={() => handleJoin(null, 0)} 
                disabled={isJoining || answers.some(a => !a.trim())}
                className="btn-primary w-full mt-4"
              >
                {isJoining ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          ) : loadingTiers ? (
            <div className="flex justify-center py-8"><span className="animate-pulse text-gray-500">Loading tiers...</span></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Always show a Free Option if no tiers exist, or if free is allowed? Actually, the tiers list should include all tiers. If no tiers exist, just show the legacy free option for now */}
              {(!tiers || tiers.length === 0) && (
                <div className="border border-surface-border rounded-xl p-4 flex flex-col hover:border-brand-500/50 transition-colors">
                  <h4 className="font-bold text-white mb-1">Standard Access</h4>
                  <p className="text-2xl font-bold text-brand-400 mb-2">Free</p>
                  <p className="text-xs text-gray-500 flex-1">Access to basic community spaces and public events.</p>
                  <button 
                    onClick={() => handleJoin(null, 0)} 
                    disabled={isJoining}
                    className="btn-primary w-full mt-4"
                  >
                    {isJoining ? 'Joining...' : 'Join for Free'}
                  </button>
                </div>
              )}

              {tiers?.map(tier => (
                <div key={tier.id} className="border border-surface-border rounded-xl p-4 flex flex-col hover:border-brand-500/50 transition-colors bg-surface">
                  <h4 className="font-bold text-white mb-1">{tier.name}</h4>
                  <p className="text-2xl font-bold text-brand-400 mb-2">${tier.price}<span className="text-sm text-gray-500 font-normal">/mo</span></p>
                  <p className="text-xs text-gray-500 flex-1 whitespace-pre-wrap">{tier.description}</p>
                  <button 
                    onClick={() => handleJoin(tier.id, tier.price)} 
                    disabled={isJoining}
                    className={tier.price > 0 ? "btn-primary w-full mt-4" : "btn-secondary w-full mt-4"}
                  >
                    {isJoining ? 'Processing...' : (tier.price > 0 ? 'Subscribe' : 'Join for Free')}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-3 mt-4 pt-4 border-t border-surface-border">
            <input 
              type="checkbox" 
              id="newsletter" 
              className="mt-1"
              checked={wantsNewsletter}
              onChange={e => setWantsNewsletter(e.target.checked)}
            />
            <label htmlFor="newsletter" className="text-sm text-gray-400 cursor-pointer">
              Subscribe to the community newsletter to get the latest updates, event announcements, and digest emails directly to your inbox.
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
