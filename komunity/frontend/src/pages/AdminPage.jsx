import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamificationApi, tierApi, memberApi, communityApi, uploadApi, spaceApi, webhookApi, billingApi, reportApi, apiKeyApi, productApi } from '@/api';
import { Settings, Award, Layers, Users, Trash2, Shield, Star, ChevronDown, Plus, Save, Search, Hash, Lock, ArrowUp, ArrowDown, Key, Gift, MessageSquare, Mail, Flag, Code, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { affiliateApi } from '@/api';
import RichTextEditor from '@/components/RichTextEditor';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';

// ── Tabs ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'general', label: 'General',     icon: Settings },
  { key: 'onboarding', label: 'Onboarding', icon: MessageSquare },
  { key: 'broadcasts', label: 'Broadcasts', icon: Mail },
  { key: 'spaces',  label: 'Spaces',      icon: Hash },
  { key: 'tiers',   label: 'Tiers',       icon: Layers },
  { key: 'payouts', label: 'Payouts',     icon: Layers },
  { key: 'products', label: 'Store',      icon: ShoppingBag },
  { key: 'badges',  label: 'Badges',      icon: Award },
  { key: 'points',  label: 'Point Rules', icon: Star },
  { key: 'members', label: 'Members',     icon: Users },
  { key: 'reports', label: 'Reports',     icon: Flag },
  { key: 'webhooks', label: 'Webhooks',   icon: Shield },
  { key: 'affiliates', label: 'Affiliates', icon: Gift },
  { key: 'theme', label: 'Theme', icon: Star },
  { key: 'web3', label: 'Web3 Gate', icon: Key },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'apikeys', label: 'API Keys', icon: Code },
];

// Outbound webhook event types creators can subscribe to (Zapier/CRM integrations)
const WEBHOOK_EVENTS = [
  'member.joined',
  'member.left',
  'member.application_submitted',
  'post.created',
];

// ── General Tab ───────────────────────────────────────────────────────────
function GeneralTab({ community }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: community?.name || '',
    description: community?.description || '',
    is_public: community?.is_public ?? true,
    join_mode: community?.join_mode || 'open',
    intake_questions: community?.intake_questions?.join('\n') || '',
    icon_image: community?.icon_image || '',
    cover_image: community?.cover_image || '',
    custom_domain: community?.custom_domain || ''
  });
  const [uploading, setUploading] = useState(null); // 'icon' or 'cover'
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const updateMutation = useMutation({
    mutationFn: (data) => communityApi.update(community.id, {
      ...data,
      intake_questions: data.intake_questions ? data.intake_questions.split('\n').filter(q => q.trim() !== '') : [],
    }),
    onSuccess: () => {
      qc.invalidateQueries(['community', community.slug]);
      toast.success('Community settings saved');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update settings');
    }
  });

  const handleUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(type);
      const { uploadApi } = await import('@/api'); // dynamically import if needed, or we can just import at top. Wait, let's just use it, I will add it to the top import.
      const { data: { upload_url, public_url } } = await uploadApi.getPresignedUrl(file.name, file.type);
      
      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setForm(f => ({ ...f, [type === 'icon' ? 'icon_image' : 'cover_image']: public_url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Basic Info</h3>
        <div>
          <label className="label">Community Name</label>
          <input className="input" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label">Custom Domain</label>
          <input className="input font-mono text-sm" placeholder="e.g. community.yourwebsite.com" value={form.custom_domain} onChange={set('custom_domain')} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" value={form.description} onChange={set('description')} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="toggle" checked={form.is_public} onChange={(e) => setForm(f => ({ ...f, is_public: e.target.checked }))} />
          <span className="text-sm text-gray-200">Public Community (visible to non-members)</span>
        </label>
        
        <div>
          <label className="label">Join Mode</label>
          <select className="input" value={form.join_mode} onChange={set('join_mode')}>
            <option value="open">Open (Anyone can join)</option>
            <option value="application">Application (Require approval)</option>
          </select>
        </div>

        {form.join_mode === 'application' && (
          <div>
            <label className="label">Intake Questions (One per line)</label>
            <textarea 
              className="input min-h-[100px]" 
              placeholder="Why do you want to join?&#10;What is your email?" 
              value={form.intake_questions} 
              onChange={set('intake_questions')} 
            />
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Branding</h3>
        
        <div>
          <label className="label">Icon Image</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-surface-dark border border-surface-border flex items-center justify-center overflow-hidden">
              {form.icon_image ? <img src={form.icon_image} alt="" className="w-full h-full object-cover" /> : <Shield className="text-gray-500" />}
            </div>
            <label className="btn-secondary text-xs cursor-pointer">
              {uploading === 'icon' ? 'Uploading...' : 'Upload Icon'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'icon')} disabled={!!uploading} />
            </label>
          </div>
        </div>

        <div>
          <label className="label">Cover Image</label>
          <div className="flex items-end gap-4">
            <div className="w-full max-w-[200px] h-24 rounded-xl bg-surface-dark border border-surface-border overflow-hidden">
              {form.cover_image && <img src={form.cover_image} alt="" className="w-full h-full object-cover" />}
            </div>
            <label className="btn-secondary text-xs cursor-pointer shrink-0">
              {uploading === 'cover' ? 'Uploading...' : 'Upload Cover'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'cover')} disabled={!!uploading} />
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => updateMutation.mutate(form)} 
          className="btn-primary"
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Web3 Tab ─────────────────────────────────────────────────────────────
function Web3Tab({ community }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    token_gate_enabled: community?.token_gate_enabled || false,
    token_contract_address: community?.token_contract_address || '',
    token_network: community?.token_network || 'ethereum',
    min_token_balance: community?.min_token_balance || 1
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const updateMutation = useMutation({
    mutationFn: (data) => communityApi.update(community.id, data),
    onSuccess: () => {
      qc.invalidateQueries(['community', community.slug]);
      toast.success('Web3 settings saved');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update Web3 settings')
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Token Gating</h3>
            <p className="text-sm text-gray-400">Require users to hold a specific ERC-20 or NFT to join.</p>
          </div>
        </div>

        <div className="pt-4 border-t border-surface-border">
          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input type="checkbox" className="toggle" checked={form.token_gate_enabled} onChange={set('token_gate_enabled')} />
            <span className="text-sm font-medium text-white">Enable Web3 Token Gating</span>
          </label>
          
          {form.token_gate_enabled && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="label">Network</label>
                <select className="input" value={form.token_network} onChange={set('token_network')}>
                  <option value="ethereum">Ethereum Mainnet</option>
                  <option value="polygon">Polygon</option>
                  <option value="base">Base</option>
                </select>
              </div>

              <div>
                <label className="label">Token Contract Address</label>
                <input className="input font-mono text-sm" placeholder="0x..." value={form.token_contract_address} onChange={set('token_contract_address')} />
              </div>

              <div>
                <label className="label">Minimum Balance Required</label>
                <input type="number" min="1" step="any" className="input" value={form.min_token_balance} onChange={set('min_token_balance')} />
                <p className="text-xs text-gray-500 mt-1">For NFTs, usually 1. For ERC-20, enter the raw number.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => updateMutation.mutate(form)} 
          className="btn-primary"
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Spaces Tab ────────────────────────────────────────────────────────────
function SpacesTab({ communityId }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon_emoji: '💬', type: 'feed', min_level_required: 1, min_tier_id: '' });
  const [localSpaces, setLocalSpaces] = useState([]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: spaces, isLoading } = useQuery({
    queryKey: ['spaces', communityId],
    queryFn: () => spaceApi.list(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  useEffect(() => {
    if (spaces) {
      setLocalSpaces(spaces);
    }
  }, [spaces]);

  const { data: tiers } = useQuery({
    queryKey: ['admin-tiers', communityId],
    queryFn: () => tierApi.list(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => spaceApi.create(communityId, data),
    onSuccess: () => {
      qc.invalidateQueries(['spaces', communityId]);
      toast.success('Space created!');
      setShowForm(false);
      setForm({ name: '', description: '', icon_emoji: '💬', type: 'feed', min_level_required: 1, min_tier_id: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create space'),
  });

  const deleteMutation = useMutation({
    mutationFn: (spaceId) => spaceApi.delete(communityId, spaceId),
    onSuccess: (data) => {
      qc.invalidateQueries(['spaces', communityId]);
      toast.success(data.data.message || 'Space deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete space'),
  });

  const reorderMutation = useMutation({
    mutationFn: (order) => spaceApi.reorder(communityId, order),
    onSuccess: () => {
      qc.invalidateQueries(['spaces', communityId]);
      qc.invalidateQueries(['community', communityId]);
    },
    onError: () => {
      toast.error('Failed to reorder spaces');
      setLocalSpaces(spaces); // revert on error
    }
  });

  const moveSpace = (index, direction) => {
    if (
      (direction === -1 && index === 0) || 
      (direction === 1 && index === localSpaces.length - 1)
    ) return;

    const newSpaces = [...localSpaces];
    const temp = newSpaces[index];
    newSpaces[index] = newSpaces[index + direction];
    newSpaces[index + direction] = temp;

    // Fix position values
    const newOrder = newSpaces.map((s, i) => ({ id: s.id, position: i }));
    
    setLocalSpaces(newSpaces);
    reorderMutation.mutate(newOrder);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">Manage community spaces and access rules.</p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs gap-1">
          <Plus size={14} /> Add Space
        </button>
      </div>

      {showForm && (
        <div className="card mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Emoji</label>
              <input className="input text-center text-xl" value={form.icon_emoji} onChange={set('icon_emoji')} maxLength={2} />
            </div>
            <div className="col-span-2">
              <label className="label">Space Name</label>
              <input className="input" placeholder="e.g. General Discussion" value={form.name} onChange={set('name')} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="What is this space for?" value={form.description} onChange={set('description')} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={set('type')}>
              <option value="feed">Feed (posts &amp; comments)</option>
              <option value="chat">Chat (real-time messages)</option>
              <option value="announcements">Announcements</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Required Level</label>
              <input className="input" type="number" min="1" value={form.min_level_required} onChange={set('min_level_required')} />
            </div>
            <div>
              <label className="label">Required Tier</label>
              <select className="input" value={form.min_tier_id} onChange={set('min_tier_id')}>
                <option value="">None (Free)</option>
                {tiers?.map(t => <option key={t.id} value={t.id}>{t.name} (${t.price}/mo)</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={() => createMutation.mutate({ ...form, min_tier_id: form.min_tier_id || null })} className="btn-primary text-xs" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Space'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card animate-pulse-soft h-16" />)}</div>
      ) : spaces?.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <Hash size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No spaces found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {localSpaces.map((space, index) => (
            <div key={space.id} className="card flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{space.icon_emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                    {space.name}
                    {space.is_default && <span className="badge bg-brand-500/10 text-brand-400 text-[10px]">Default</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-500">{space.description || 'No description'}</p>
                    {(space.min_level_required > 1 || space.min_tier_id) && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                        <Lock size={10} />
                        {space.min_level_required > 1 && `Lv.${space.min_level_required}`}
                        {space.min_level_required > 1 && space.min_tier_id && ' · '}
                        {space.min_tier_id && `Paid Tier`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => moveSpace(index, -1)}
                  disabled={index === 0}
                  className="btn-ghost p-1.5 text-gray-400 hover:text-white disabled:opacity-30"
                  title="Move Up"
                >
                  <ArrowUp size={14} />
                </button>
                <button 
                  onClick={() => moveSpace(index, 1)}
                  disabled={index === localSpaces.length - 1}
                  className="btn-ghost p-1.5 text-gray-400 hover:text-white disabled:opacity-30"
                  title="Move Down"
                >
                  <ArrowDown size={14} />
                </button>
                <div className="w-px h-4 bg-surface-border mx-1" />
                <button 
                  onClick={() => {
                    if (confirm(`Delete space ${space.name}? All posts will be moved to the default space.`)) {
                      deleteMutation.mutate(space.id);
                    }
                  }} 
                  className="btn-ghost text-red-400 hover:text-red-300 p-1.5"
                  disabled={space.is_default}
                  title={space.is_default ? "Cannot delete the default space" : "Delete space"}
                >
                  <Trash2 size={14} className={space.is_default ? "opacity-30" : ""} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tiers Tab ─────────────────────────────────────────────────────────────
function TiersTab({ communityId }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: 0, annual_price: 0, trial_period_days: 0, features: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['admin-tiers', communityId],
    queryFn: () => tierApi.list(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => tierApi.create(communityId, {
      ...data,
      price: Number(data.price) || 0,
      annual_price: Number(data.annual_price) || 0,
      trial_period_days: Number(data.trial_period_days) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['admin-tiers', communityId]);
      toast.success('Tier created!');
      setShowForm(false);
      setForm({ name: '', description: '', price: 0, annual_price: 0, trial_period_days: 0, features: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create tier'),
  });

  const deleteMutation = useMutation({
    mutationFn: (tierId) => tierApi.delete(communityId, tierId),
    onSuccess: () => {
      qc.invalidateQueries(['admin-tiers', communityId]);
      toast.success('Tier deleted');
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">Manage membership tiers and pricing.</p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs gap-1">
          <Plus size={14} /> Add Tier
        </button>
      </div>

      {showForm && (
        <div className="card mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tier Name</label>
              <input className="input" placeholder="e.g. Pro Member" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label className="label">Monthly Price ($)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Annual Price ($) <span className="text-gray-600">(optional)</span></label>
              <input className="input" type="number" min="0" step="0.01" value={form.annual_price} onChange={set('annual_price')} />
            </div>
            <div>
              <label className="label">Free Trial (days) <span className="text-gray-600">(optional)</span></label>
              <input className="input" type="number" min="0" step="1" value={form.trial_period_days} onChange={set('trial_period_days')} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none min-h-[60px]" placeholder="What's included?" value={form.description} onChange={set('description')} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} className="btn-primary text-xs" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Tier'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="card animate-pulse-soft h-16" />)}</div>
      ) : tiers?.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <Layers size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No tiers created yet. Add your first tier!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tiers?.map(tier => (
            <div key={tier.id} className="card flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-200">{tier.name}</p>
                <p className="text-xs text-gray-500">{tier.price > 0 ? `$${tier.price}/mo` : 'Free'} — {tier.description || 'No description'}</p>
              </div>
              <button onClick={() => deleteMutation.mutate(tier.id)} className="btn-ghost text-red-400 hover:text-red-300 p-1.5">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Badges Tab ────────────────────────────────────────────────────────────
function BadgesTab({ communityId }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon_emoji: '🏆', points_required: 100, level_required: 1 });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const { data: badges, isLoading } = useQuery({
    queryKey: ['admin-badges', communityId],
    queryFn: () => gamificationApi.getBadges(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => gamificationApi.createBadge(communityId, data),
    onSuccess: () => {
      qc.invalidateQueries(['admin-badges', communityId]);
      toast.success('Badge created! 🏆');
      setShowForm(false);
      setForm({ name: '', description: '', icon_emoji: '🏆', points_required: 100, level_required: 1 });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">Create achievement badges for your community.</p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs gap-1">
          <Plus size={14} /> Add Badge
        </button>
      </div>

      {showForm && (
        <div className="card mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Emoji</label>
              <input className="input text-center text-xl" value={form.icon_emoji} onChange={set('icon_emoji')} maxLength={2} />
            </div>
            <div className="col-span-2">
              <label className="label">Badge Name</label>
              <input className="input" placeholder="e.g. Top Contributor" value={form.name} onChange={set('name')} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="Awarded for..." value={form.description} onChange={set('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Points Required</label>
              <input className="input" type="number" min="0" value={form.points_required} onChange={set('points_required')} />
            </div>
            <div>
              <label className="label">Level Required</label>
              <input className="input" type="number" min="1" value={form.level_required} onChange={set('level_required')} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} className="btn-primary text-xs" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Badge'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">{[1,2,3].map(i => <div key={i} className="card animate-pulse-soft h-24" />)}</div>
      ) : badges?.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <Award size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No badges yet. Create your first!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {badges?.map(badge => (
            <div key={badge.id} className="card text-center hover:border-amber-500/30 transition-colors">
              <span className="text-3xl block mb-2">{badge.icon_emoji || '🏆'}</span>
              <p className="text-sm font-semibold text-gray-200">{badge.name}</p>
              <p className="text-[10px] text-gray-500 mt-1">{badge.description}</p>
              <div className="flex justify-center gap-2 mt-2">
                <span className="badge bg-brand-500/10 text-brand-400 text-[10px]">{badge.points_required} pts</span>
                <span className="badge bg-surface text-gray-500 text-[10px]">Lv.{badge.level_required}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Point Rules Tab ───────────────────────────────────────────────────────
function PointRulesTab({ communityId }) {
  const qc = useQueryClient();

  const { data: rules, isLoading } = useQuery({
    queryKey: ['admin-point-rules', communityId],
    queryFn: () => gamificationApi.getPointRules(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const [editedRules, setEditedRules] = useState(null);

  const updateMutation = useMutation({
    mutationFn: (rules) => gamificationApi.updatePointRules(communityId, rules),
    onSuccess: () => {
      qc.invalidateQueries(['admin-point-rules', communityId]);
      toast.success('Point rules updated!');
    },
  });

  const ACTION_LABELS = {
    post: 'Create a post',
    comment: 'Leave a comment',
    lesson_complete: 'Complete a lesson',
    event_attend: 'Attend an event',
    like_received: 'Receive a like',
  };

  const currentRules = editedRules ?? rules;

  const handleChange = (idx, field, value) => {
    const updated = [...(currentRules || [])];
    updated[idx] = { ...updated[idx], [field]: Number(value) };
    setEditedRules(updated);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">Configure how many points each action earns.</p>
        {editedRules && (
          <button onClick={() => updateMutation.mutate(editedRules)} className="btn-primary text-xs gap-1" disabled={updateMutation.isPending}>
            <Save size={14} /> {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card animate-pulse-soft h-12" />)}</div>
      ) : (
        <div className="space-y-2">
          {currentRules?.map((rule, idx) => (
            <div key={rule.action} className="card flex items-center justify-between gap-4">
              <span className="text-sm text-gray-300 flex-1">{ACTION_LABELS[rule.action] ?? rule.action}</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-600 uppercase">Points:</span>
                  <input
                    className="input w-16 text-center text-xs py-1.5"
                    type="number"
                    min="0"
                    value={rule.points}
                    onChange={(e) => handleChange(idx, 'points', e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-600 uppercase">Cap:</span>
                  <input
                    className="input w-16 text-center text-xs py-1.5"
                    type="number"
                    min="0"
                    value={rule.daily_cap ?? 0}
                    onChange={(e) => handleChange(idx, 'daily_cap', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────────
function MembersTab({ communityId }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: members, isLoading } = useQuery({
    queryKey: ['admin-members', communityId, search],
    queryFn: () => memberApi.list(communityId, { search: search || undefined }).then(r => r.data),
    enabled: !!communityId,
  });

  const { data: pendingMembers } = useQuery({
    queryKey: ['admin-pending-members', communityId],
    queryFn: () => communityApi.getPendingMembers(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }) => communityApi.updateMemberRole(communityId, userId, role),
    onSuccess: () => {
      qc.invalidateQueries(['admin-members', communityId]);
      toast.success('Role updated!');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId) => communityApi.removeMember(communityId, userId),
    onSuccess: () => {
      qc.invalidateQueries(['admin-members', communityId]);
      toast.success('Member removed');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }) => communityApi.updateMemberStatus(communityId, userId, status),
    onSuccess: () => {
      qc.invalidateQueries(['admin-members', communityId]);
      qc.invalidateQueries(['admin-pending-members', communityId]);
      toast.success('Status updated');
    },
  });

  const ROLE_STYLES = {
    admin: { label: 'Admin', class: 'text-amber-400' },
    moderator: { label: 'Mod', class: 'text-blue-400' },
    member: { label: 'Member', class: 'text-gray-400' },
  };

  return (
    <div>
      <p className="text-sm text-gray-400 mb-4">Manage member roles and access.</p>
      
      {pendingMembers?.length > 0 && (
        <div className="mb-8">
          <h3 className="text-white font-semibold mb-3">Pending Applications ({pendingMembers.length})</h3>
          <div className="space-y-2">
            {pendingMembers.map(member => (
              <div key={member.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0">
                    {member.full_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-200">{member.full_name}</p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                    {member.intake_answers && (
                      <div className="mt-3 bg-surface p-3 rounded-lg border border-surface-border space-y-2">
                        {member.intake_answers.map((ans, i) => (
                          <div key={i}>
                            <p className="text-[10px] text-gray-500">Question {i + 1}</p>
                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{ans}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => statusMutation.mutate({ userId: member.id, status: 'rejected' })}
                      className="btn-secondary text-xs"
                    >
                      Deny
                    </button>
                    <button 
                      onClick={() => statusMutation.mutate({ userId: member.id, status: 'active' })}
                      className="btn-primary text-xs"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-white font-semibold mb-3">Active Members</h3>
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
        <input className="input pl-9 max-w-xs" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card animate-pulse-soft h-14" />)}</div>
      ) : (
        <div className="space-y-2">
          {members?.map(member => (
            <div key={member.id} className="card flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0">
                {member.full_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-200 truncate">{member.full_name}</p>
                <p className="text-xs text-gray-500">{member.points?.toLocaleString()} pts · Lv.{member.level}</p>
              </div>
              <select
                value={member.role}
                onChange={(e) => roleMutation.mutate({ userId: member.id, role: e.target.value })}
                className="bg-surface-card border border-surface-border rounded-lg text-xs px-2 py-1.5 text-gray-200 cursor-pointer"
              >
                <option value="member">Member</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={() => {
                  if (confirm(`Remove ${member.full_name} from this community?`)) {
                    removeMutation.mutate(member.id);
                  }
                }}
                className="btn-ghost text-red-400 hover:text-red-300 p-1.5"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Webhooks Tab ──────────────────────────────────────────────────────────
function WebhooksTab({ communityId }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ endpoint_url: '', secret: '', events: ['member.joined', 'post.created'] });
  
  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['admin-webhooks', communityId],
    queryFn: () => webhookApi.list(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => webhookApi.create(communityId, data),
    onSuccess: () => {
      qc.invalidateQueries(['admin-webhooks', communityId]);
      toast.success('Webhook created');
      setShowForm(false);
      setForm({ endpoint_url: '', secret: '', events: ['member.joined', 'post.created'] });
    },
    onError: () => toast.error('Failed to create webhook')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => webhookApi.delete(communityId, id),
    onSuccess: () => {
      qc.invalidateQueries(['admin-webhooks', communityId]);
      toast.success('Webhook deleted');
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">Send community events to Zapier, n8n, or your own server.</p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs gap-1">
          <Plus size={14} /> Add Webhook
        </button>
      </div>

      {showForm && (
        <div className="card mb-4 space-y-3 animate-fade-in">
          <div>
            <label className="label">Endpoint URL (HTTPS)</label>
            <input className="input" placeholder="https://hooks.zapier.com/..." value={form.endpoint_url} onChange={(e) => setForm({...form, endpoint_url: e.target.value})} />
          </div>
          <div>
            <label className="label">Secret (Optional for HMAC signature)</label>
            <input className="input" placeholder="e.g. my-super-secret" value={form.secret} onChange={(e) => setForm({...form, secret: e.target.value})} />
          </div>
          <div>
            <label className="label">Events</label>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.events.includes(ev)}
                    onChange={(e) => setForm(f => ({
                      ...f,
                      events: e.target.checked ? [...f.events, ev] : f.events.filter(x => x !== ev),
                    }))}
                  />
                  <span className="font-mono">{ev}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-1">Leave all unchecked to receive every event.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} className="btn-primary text-xs" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="card animate-pulse-soft h-16" />)}</div>
      ) : webhooks?.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <Shield size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No webhooks configured.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks?.map(wh => (
            <WebhookRow key={wh.id} wh={wh} communityId={communityId} onDelete={() => deleteMutation.mutate(wh.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WebhookRow({ wh, communityId, onDelete }) {
  const [showLog, setShowLog] = useState(false);
  const { data: deliveries } = useQuery({
    queryKey: ['webhook-deliveries', wh.id],
    queryFn: () => webhookApi.deliveries(communityId, wh.id).then(r => r.data),
    enabled: showLog,
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-200 truncate">{wh.endpoint_url}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${wh.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {wh.is_active ? 'Active' : 'Auto-disabled'}
            </span>
            {wh.consecutive_failures > 0 && (
              <span className="text-[10px] text-amber-400">{wh.consecutive_failures} recent failure(s)</span>
            )}
            <span className="text-[10px] text-gray-500">{wh.events?.join(', ')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowLog(s => !s)} className="btn-secondary text-[11px]">{showLog ? 'Hide log' : 'View log'}</button>
          <button onClick={onDelete} className="btn-ghost text-red-400 hover:text-red-300 p-1.5"><Trash2 size={14} /></button>
        </div>
      </div>

      {showLog && (
        <div className="mt-3 pt-3 border-t border-surface-border space-y-1">
          {!deliveries ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-xs text-gray-500">No deliveries yet.</p>
          ) : (
            deliveries.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={`w-2 h-2 rounded-full shrink-0 ${d.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-gray-400 font-mono">{d.event}</span>
                <span className="text-gray-600">{d.status_code || d.error || d.status}</span>
                <span className="ml-auto text-gray-600">{new Date(d.created_at).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Affiliates Tab ────────────────────────────────────────────────────────────
function AffiliatesTab({ communityId }) {
  const qc = useQueryClient();
  
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['admin-affiliate-config', communityId],
    queryFn: () => affiliateApi.getConfig(communityId),
    enabled: !!communityId,
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['admin-affiliate-leaderboard', communityId],
    queryFn: () => affiliateApi.getLeaderboard(communityId),
    enabled: !!communityId,
  });

  const { data: owed } = useQuery({
    queryKey: ['admin-affiliate-owed', communityId],
    queryFn: () => affiliateApi.getOwed(communityId),
    enabled: !!communityId,
  });

  const payoutMutation = useMutation({
    mutationFn: (referrerId) => affiliateApi.payout(communityId, referrerId),
    onSuccess: () => {
      qc.invalidateQueries(['admin-affiliate-owed', communityId]);
      toast.success('Marked as paid');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to record payout'),
  });

  const [percent, setPercent] = useState('');

  useEffect(() => {
    if (config) {
      setPercent(config.affiliate_commission_percent?.toString() || '0');
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (commissionPercent) => affiliateApi.updateConfig(communityId, { affiliate_commission_percent: parseInt(commissionPercent) }),
    onSuccess: () => {
      qc.invalidateQueries(['admin-affiliate-config', communityId]);
      toast.success('Affiliate config updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update affiliate config'),
  });

  if (configLoading || leaderboardLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Affiliate Program Settings</h3>
        <p className="text-sm text-gray-400 mb-4">Set the commission percentage that users will earn when they refer paying members.</p>
        
        <div>
          <label className="label">Commission Percentage (%)</label>
          <div className="flex items-center gap-4">
            <input 
              type="number" 
              className="input w-32" 
              min="0" 
              max="100" 
              value={percent} 
              onChange={(e) => setPercent(e.target.value)} 
            />
            <button 
              className="btn-primary" 
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate(percent)}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-white mb-4">Top Referrers</h3>
        {leaderboard?.length === 0 ? (
          <p className="text-gray-400 text-sm">No referrals recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="pb-3 font-semibold">User</th>
                  <th className="pb-3 font-semibold text-right">Referrals</th>
                  <th className="pb-3 font-semibold text-right">Points Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {leaderboard?.map(row => (
                  <tr key={row.referrer_id}>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <img src={row.avatar_url || 'https://via.placeholder.com/40'} alt="" className="w-8 h-8 rounded-full" />
                        <span className="font-medium text-gray-200">{row.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right font-medium">{row.referral_count}</td>
                    <td className="py-3 text-right text-brand-300 font-semibold">{row.total_earned} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold text-white mb-1">Commission Payouts</h3>
        <p className="text-sm text-gray-400 mb-4">Affiliates with pending monetary commissions. Send the payout, then mark it paid.</p>
        {!owed || owed.length === 0 ? (
          <p className="text-gray-400 text-sm">No commissions owed.</p>
        ) : (
          <div className="space-y-2">
            {owed.map(row => (
              <div key={row.referrer_id} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border">
                <div className="flex items-center gap-3">
                  <img src={row.avatar_url || 'https://via.placeholder.com/40'} alt="" className="w-8 h-8 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-gray-200 leading-none">{row.full_name}</p>
                    <p className="text-xs text-gray-500 mt-1">{row.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-400">${Number(row.pending_amount).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-500">{row.pending_count} pending</p>
                  </div>
                  <button
                    onClick={() => payoutMutation.mutate(row.referrer_id)}
                    disabled={payoutMutation.isPending}
                    className="btn-primary text-xs"
                  >
                    Mark Paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Onboarding Tab ───────────────────────────────────────────────────────────
function OnboardingTab({ community }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    welcome_message_enabled: community?.welcome_message_enabled || false,
    welcome_message: community?.welcome_message || ''
  });

  const updateMutation = useMutation({
    mutationFn: (data) => communityApi.update(community.id, data),
    onSuccess: () => {
      qc.invalidateQueries(['community', community.slug]);
      toast.success('Onboarding settings saved');
    }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Auto-DMs & Welcome Automation</h3>
        <p className="text-sm text-gray-400">Automatically send a direct message to new members when they join or are approved.</p>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            className="toggle" 
            checked={form.welcome_message_enabled} 
            onChange={(e) => setForm(f => ({ ...f, welcome_message_enabled: e.target.checked }))} 
          />
          <span className="text-sm text-gray-200">Enable Welcome Auto-DM</span>
        </label>

        {form.welcome_message_enabled && (
          <div>
            <label className="label">Welcome Message Content</label>
            <textarea 
              className="input min-h-[120px]" 
              placeholder="Hi there! Welcome to our community..." 
              value={form.welcome_message} 
              onChange={(e) => setForm(f => ({ ...f, welcome_message: e.target.value }))} 
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => updateMutation.mutate(form)} 
          className="btn-primary"
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Broadcasts Tab ──────────────────────────────────────────────────────────
function BroadcastsTab({ communityId }) {
  const [form, setForm] = useState({ subject: '', content: '' });

  const sendMutation = useMutation({
    mutationFn: (data) => communityApi.sendBroadcast(communityId, data),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Broadcast sent successfully!');
      setForm({ subject: '', content: '' });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to send broadcast');
    }
  });

  const handleSend = () => {
    if (!form.subject.trim() || !form.content.trim()) {
      toast.error('Subject and content are required');
      return;
    }
    if (confirm('Are you sure you want to send this email to all active members? This action cannot be undone.')) {
      sendMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Email Broadcasts</h3>
        <p className="text-sm text-gray-400">Send an email blast to all active community members who are opted into newsletters.</p>
        
        <div>
          <label className="label">Subject Line</label>
          <input 
            className="input w-full" 
            placeholder="Important Community Update!" 
            value={form.subject}
            onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
          />
        </div>
        
        <div>
          <label className="label">Email Content</label>
          <RichTextEditor 
            content={form.content}
            onChange={(html) => setForm(f => ({ ...f, content: html }))}
            placeholder="Write your broadcast message here..."
          />
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={handleSend}
            className="btn-primary"
            disabled={sendMutation.isPending}
          >
            {sendMutation.isPending ? 'Sending...' : 'Send Broadcast to All Members'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Theme Tab ─────────────────────────────────────────────────────────────
function ThemeTab({ community }) {
  const qc = useQueryClient();
  const defaultConfig = { preset: 'indigo', custom_css: '' };
  const [config, setConfig] = useState(community?.theme_config || defaultConfig);

  const presets = [
    { id: 'indigo', color: '#6366f1' },
    { id: 'rose', color: '#f43f5e' },
    { id: 'emerald', color: '#10b981' },
    { id: 'amber', color: '#f59e0b' },
    { id: 'violet', color: '#8b5cf6' },
  ];

  const updateMutation = useMutation({
    mutationFn: (data) => communityApi.update(community.id, { theme_config: data }),
    onSuccess: () => {
      qc.invalidateQueries(['community', community.slug]);
      toast.success('Theme updated!');
    },
    onError: () => toast.error('Failed to update theme')
  });

  const handleSave = () => {
    updateMutation.mutate(config);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Color Preset</h3>
        <p className="text-sm text-gray-400">Choose a primary brand color for your community.</p>
        
        <div className="flex gap-4">
          {presets.map(p => (
            <button
              key={p.id}
              onClick={() => setConfig(prev => ({ ...prev, preset: p.id }))}
              className={`w-12 h-12 rounded-full transition-all ${config.preset === p.id ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Custom CSS</h3>
        <p className="text-sm text-gray-400">Inject custom CSS to override styles across your community. Use with caution!</p>
        
        <textarea
          className="input font-mono text-sm h-48 bg-surface text-gray-300"
          placeholder=".card { border-radius: 0; }"
          value={config.custom_css}
          onChange={(e) => setConfig(prev => ({ ...prev, custom_css: e.target.value }))}
        />
        
        <div className="flex justify-end pt-2">
          <button 
            onClick={handleSave} 
            className="btn-primary"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Theme'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────
function AnalyticsTab({ communityId }) {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['community', communityId, 'analytics'],
    queryFn: () => communityApi.getAnalytics(communityId).then(r => r.data)
  });

  if (isLoading) return <div className="text-gray-400 p-4">Loading analytics...</div>;
  if (!analytics) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Growth (Last 30 Days)</h3>
        <p className="text-sm text-gray-400">Track new and churned members over time.</p>
        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#17171e', borderColor: '#2a2a35', borderRadius: '8px' }}
                itemStyle={{ color: '#e8e8f0' }}
              />
              <Line type="monotone" dataKey="new_members" stroke="#10b981" strokeWidth={2} name="New Members" dot={false} />
              <Line type="monotone" dataKey="churned_members" stroke="#f43f5e" strokeWidth={2} name="Churned Members" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-semibold text-white">Engagement (Last 30 Days)</h3>
        <p className="text-sm text-gray-400">Track posts and comments created.</p>
        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.engagement}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#17171e', borderColor: '#2a2a35', borderRadius: '8px' }}
                itemStyle={{ color: '#e8e8f0' }}
                cursor={{ fill: '#2a2a35', opacity: 0.4 }}
              />
              <Bar dataKey="posts" fill="#6366f1" name="Posts" radius={[4, 4, 0, 0]} />
              <Bar dataKey="comments" fill="#a855f7" name="Comments" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Top Members</h3>
          <div className="space-y-3 mt-4">
            {analytics.topMembers?.map((member, i) => (
              <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-mono text-xs">{i + 1}</span>
                  <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full bg-surface-card object-cover" />
                  <div>
                    <p className="text-sm text-gray-200 font-medium leading-none">{member.full_name}</p>
                    <p className="text-xs text-brand-400 mt-1">Level {member.level}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{member.points}</p>
                  <p className="text-[10px] text-gray-500 uppercase">pts</p>
                </div>
              </div>
            ))}
            {(!analytics.topMembers || analytics.topMembers.length === 0) && (
              <p className="text-sm text-gray-500">No active members found.</p>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-white">Most Active Spaces</h3>
          <div className="space-y-3 mt-4">
            {analytics.topSpaces?.map((space, i) => (
              <div key={space.id} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-mono text-xs">{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg bg-surface-card border border-surface-border flex items-center justify-center text-sm">
                    {space.icon_emoji || '💬'}
                  </div>
                  <div>
                    <p className="text-sm text-gray-200 font-medium leading-none">{space.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{space.post_count}</p>
                  <p className="text-[10px] text-gray-500 uppercase">posts</p>
                </div>
              </div>
            ))}
            {(!analytics.topSpaces || analytics.topSpaces.length === 0) && (
              <p className="text-sm text-gray-500">No spaces found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reports / Moderation Queue Tab ──────────────────────────────────────────
function ReportsTab({ communityId }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports', communityId, status],
    queryFn: () => reportApi.list(communityId, status).then(r => r.data),
    enabled: !!communityId,
  });

  const resolveMut = useMutation({
    mutationFn: ({ reportId, action }) => reportApi.resolve(communityId, reportId, action),
    onSuccess: () => {
      qc.invalidateQueries(['reports', communityId]);
      toast.success('Report handled');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to handle report'),
  });

  const strip = (html) => (html || '').replace(/<[^>]*>?/gm, '');

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">Review content reported by members.</p>
        <select className="input text-xs w-32" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="card animate-pulse-soft h-20" />)}</div>
      ) : reports?.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <Flag size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No {status === 'all' ? '' : status} reports.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports?.map(r => (
            <div key={r.id} className="card space-y-2">
              <div className="flex items-center gap-2">
                <span className="badge bg-surface-card text-gray-400 text-[10px] uppercase">{r.target_type}</span>
                <span className="text-xs text-gray-500">reported by {r.reporter_name}</span>
                <span className="ml-auto text-[10px] text-gray-600">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.reason && <p className="text-xs text-amber-400/90">Reason: {r.reason}</p>}
              <p className="text-sm text-gray-300 bg-surface border border-surface-border rounded-lg p-2 line-clamp-3">
                {strip(r.target_content) || <span className="text-gray-600 italic">[content deleted]</span>}
              </p>
              {r.status === 'open' && (
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => resolveMut.mutate({ reportId: r.id, action: 'dismiss' })} className="btn-secondary text-xs" disabled={resolveMut.isPending}>
                    Dismiss
                  </button>
                  <button onClick={() => resolveMut.mutate({ reportId: r.id, action: 'remove_content' })} className="btn-primary text-xs bg-red-500/80 hover:bg-red-500" disabled={resolveMut.isPending}>
                    Remove content
                  </button>
                </div>
              )}
              {r.status !== 'open' && (
                <p className="text-[10px] text-gray-500 text-right uppercase">{r.status}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── API Keys Tab ─────────────────────────────────────────────────────────────
function ApiKeysTab({ communityId }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys', communityId],
    queryFn: () => apiKeyApi.list(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const createMut = useMutation({
    mutationFn: () => apiKeyApi.create(communityId, name).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries(['api-keys', communityId]);
      setNewKey(data.key);
      setName('');
      toast.success('API key created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create key'),
  });

  const revokeMut = useMutation({
    mutationFn: (id) => apiKeyApi.revoke(communityId, id),
    onSuccess: () => { qc.invalidateQueries(['api-keys', communityId]); toast.success('Key revoked'); },
  });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold text-white">Public API Keys</h3>
        <p className="text-sm text-gray-400">
          Use keys with the REST API at <span className="font-mono text-brand-300">/api/v1</span> (members, posts, events) to integrate with Zapier, n8n, or your own tools. Pair with outbound Webhooks for triggers.
        </p>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Key name (e.g. Zapier)" value={name} onChange={e => setName(e.target.value)} />
          <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !name.trim()} className="btn-primary text-sm">
            <Plus size={14} /> Create
          </button>
        </div>
        {newKey && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-xs text-amber-400 mb-1">Copy this key now — it won't be shown again:</p>
            <code className="text-sm text-amber-200 break-all">{newKey}</code>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="card animate-pulse-soft h-16" />
      ) : keys?.length === 0 ? (
        <div className="text-center py-10 text-gray-600">
          <Code size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No API keys yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys?.map(k => (
            <div key={k.id} className="card flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">{k.name} {k.revoked && <span className="text-red-400 text-xs">(revoked)</span>}</p>
                <p className="text-xs text-gray-500 font-mono">{k.key_prefix}••• · {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'never used'}</p>
              </div>
              {!k.revoked && (
                <button onClick={() => revokeMut.mutate(k.id)} className="btn-ghost text-red-400 hover:text-red-300 p-1.5">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Products / Store Tab ─────────────────────────────────────────────────────
function ProductsTab({ communityId }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const blank = { name: '', description: '', price: 0, file_url: '', file_key: '', thumbnail_url: '' };
  const [form, setForm] = useState(blank);
  const [uploading, setUploading] = useState(null); // 'file' | 'thumb'

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products', communityId],
    queryFn: () => productApi.listManage(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const createMut = useMutation({
    mutationFn: () => productApi.create(communityId, { ...form, price: Number(form.price) || 0, is_published: true }),
    onSuccess: () => {
      qc.invalidateQueries(['admin-products', communityId]);
      toast.success('Product published');
      setForm(blank); setShowForm(false);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create product'),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, is_published }) => productApi.update(communityId, id, { is_published }),
    onSuccess: () => qc.invalidateQueries(['admin-products', communityId]),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => productApi.delete(communityId, id),
    onSuccess: () => { qc.invalidateQueries(['admin-products', communityId]); toast.success('Deleted'); },
  });

  const upload = async (file, kind) => {
    if (!file) return;
    setUploading(kind);
    try {
      const { data } = await uploadApi.getPresignedUrl(file.name, file.type);
      await uploadApi.uploadToS3(data.upload_url, file);
      if (kind === 'file') setForm(f => ({ ...f, file_url: data.public_url, file_key: data.key }));
      else setForm(f => ({ ...f, thumbnail_url: data.public_url }));
      toast.success(`${kind === 'file' ? 'File' : 'Thumbnail'} uploaded`);
    } catch (err) {
      toast.error('Upload failed — is storage configured?');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">Sell digital products (templates, files, licenses). Requires payout setup.</p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs gap-1"><Plus size={14} /> Add Product</button>
      </div>

      {showForm && (
        <div className="card mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Notion Template Pack" />
            </div>
            <div>
              <label className="label">Price ($)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none min-h-[60px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Downloadable file {form.file_url && <span className="text-green-400">✓</span>}</label>
              <label className="btn-secondary text-xs cursor-pointer inline-block">
                {uploading === 'file' ? 'Uploading…' : 'Upload file'}
                <input type="file" className="hidden" onChange={e => upload(e.target.files?.[0], 'file')} />
              </label>
            </div>
            <div>
              <label className="label">Thumbnail {form.thumbnail_url && <span className="text-green-400">✓</span>}</label>
              <label className="btn-secondary text-xs cursor-pointer inline-block">
                {uploading === 'thumb' ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'thumb')} />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name} className="btn-primary text-xs">
              {createMut.isPending ? 'Publishing…' : 'Publish Product'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="card animate-pulse-soft h-16" />)}</div>
      ) : !products?.length ? (
        <div className="text-center py-10 text-gray-600"><ShoppingBag size={24} className="mx-auto mb-2 opacity-30" /><p className="text-sm">No products yet.</p></div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.id} className="card flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-200 truncate">{p.name} {!p.is_published && <span className="badge bg-amber-500/10 text-amber-500 text-[10px]">Draft</span>}</p>
                <p className="text-xs text-gray-500">{Number(p.price) > 0 ? `$${p.price}` : 'Free'} · {p.purchase_count} sold</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => togglePublish.mutate({ id: p.id, is_published: !p.is_published })} className="btn-secondary text-xs">
                  {p.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => { if (confirm('Delete product?')) deleteMut.mutate(p.id); }} className="btn-ghost text-red-400 hover:text-red-300 p-1.5"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Payouts Tab (Stripe Connect) ────────────────────────────────────────────
function PayoutsTab({ community }) {
  const communityId = community?.id;
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['connect-status', communityId],
    queryFn: () => billingApi.getConnectStatus(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  const onboard = useMutation({
    mutationFn: () => billingApi.startConnectOnboarding(communityId).then(r => r.data),
    onSuccess: (data) => { if (data?.url) window.location.href = data.url; },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to start payout setup'),
  });

  const ready = status?.charges_enabled && status?.payouts_enabled;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Payouts</h3>
            <p className="text-sm text-gray-400">Connect Stripe to receive payments from paid memberships and courses.</p>
          </div>
        </div>

        <div className="pt-4 border-t border-surface-border">
          {isLoading ? (
            <p className="text-sm text-gray-500">Checking payout status…</p>
          ) : ready ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Payouts enabled — you're ready to accept payments.
            </div>
          ) : status?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Setup incomplete. Stripe still needs more information.
              </div>
              {status?.requirements_due?.length > 0 && (
                <p className="text-xs text-gray-500">Outstanding: {status.requirements_due.join(', ')}</p>
              )}
              <button onClick={() => onboard.mutate()} className="btn-primary" disabled={onboard.isPending}>
                {onboard.isPending ? 'Redirecting…' : 'Finish payout setup'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">You haven't set up payouts yet. Paid checkout is disabled until you do.</p>
              <button onClick={() => onboard.mutate()} className="btn-primary" disabled={onboard.isPending}>
                {onboard.isPending ? 'Redirecting…' : 'Set up payouts with Stripe'}
              </button>
            </div>
          )}
          <button onClick={() => refetch()} className="block mt-4 text-xs text-gray-500 hover:text-gray-300">
            Refresh status
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Page ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { community } = useOutletContext();
  const communityId = community?.id;
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={20} className="text-brand-400" />
        <h2 className="font-display font-bold text-2xl text-white">Admin Panel</h2>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-surface-card border border-surface-border rounded-xl p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-brand-500/15 text-brand-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'general' && <GeneralTab community={community} />}
      {activeTab === 'onboarding' && <OnboardingTab community={community} />}
      {activeTab === 'broadcasts' && <BroadcastsTab communityId={communityId} />}
      {activeTab === 'spaces' && <SpacesTab communityId={communityId} />}
      {activeTab === 'tiers' && <TiersTab communityId={communityId} />}
      {activeTab === 'payouts' && <PayoutsTab community={community} />}
      {activeTab === 'products' && <ProductsTab communityId={communityId} />}
      {activeTab === 'badges' && <BadgesTab communityId={communityId} />}
      {activeTab === 'points' && <PointRulesTab communityId={communityId} />}
      {activeTab === 'members' && <MembersTab communityId={communityId} />}
      {activeTab === 'reports' && <ReportsTab communityId={communityId} />}
      { activeTab === 'webhooks' && <WebhooksTab communityId={communityId} /> }
      { activeTab === 'affiliates' && <AffiliatesTab communityId={communityId} /> }
      { activeTab === 'theme' && <ThemeTab community={community} /> }
      { activeTab === 'web3' && <Web3Tab community={community} /> }
      { activeTab === 'analytics' && <AnalyticsTab communityId={communityId} /> }
      { activeTab === 'apikeys' && <ApiKeysTab communityId={communityId} /> }
    </div>
  );
}
