import { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { productApi, billingApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import { ShoppingBag, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const fmtPrice = (price, currency) =>
  Number(price) > 0
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(price)
    : 'Free';

function ProductCard({ product, communityId }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const owned = product.is_purchased || Number(product.price) <= 0;

  const buy = async () => {
    setBusy(true);
    try {
      const { data } = await billingApi.createProductCheckout(communityId, product.id);
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start checkout');
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const { data } = await productApi.getDownload(communityId, product.id);
      window.open(data.url, '_blank');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col overflow-hidden">
      {product.thumbnail_url ? (
        <img src={product.thumbnail_url} alt="" className="w-full h-40 object-cover rounded-lg mb-3 bg-surface-card" />
      ) : (
        <div className="w-full h-40 rounded-lg mb-3 bg-surface-card border border-surface-border flex items-center justify-center">
          <ShoppingBag className="text-gray-600" size={32} />
        </div>
      )}
      <h3 className="font-semibold text-white">{product.name}</h3>
      {product.description && <p className="text-sm text-gray-400 mt-1 line-clamp-3 flex-1">{product.description}</p>}
      <div className="flex items-center justify-between mt-4">
        <span className="text-lg font-bold text-brand-400">{fmtPrice(product.price, product.currency)}</span>
        {owned ? (
          <button onClick={download} disabled={busy} className="btn-secondary text-sm gap-1.5">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download
          </button>
        ) : (
          <button onClick={buy} disabled={busy} className="btn-primary text-sm">
            {busy ? 'Loading…' : `Buy ${fmtPrice(product.price, product.currency)}`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function StorePage() {
  const { community } = useOutletContext();
  const communityId = community?.id;
  const [params, setParams] = useSearchParams();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', communityId],
    queryFn: () => productApi.list(communityId).then(r => r.data),
    enabled: !!communityId,
  });

  // Post-checkout success toast
  useEffect(() => {
    if (params.get('purchased')) {
      toast.success('Purchase complete — your download is ready!');
      params.delete('purchased');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <ShoppingBag size={20} className="text-brand-400" />
        <h2 className="font-display font-bold text-2xl text-white">Store</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="card animate-pulse-soft h-64" />)}
        </div>
      ) : !products?.length ? (
        <div className="text-center py-16 text-gray-600">
          <ShoppingBag size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No products yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => <ProductCard key={p.id} product={p} communityId={communityId} />)}
        </div>
      )}
    </div>
  );
}
