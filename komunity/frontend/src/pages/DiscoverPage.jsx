import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { communityApi } from '@/api';
import { Search, Users, Lock, Plus } from 'lucide-react';

const CommunityCard = ({ community }) => (
  <Link
    to={`/c/${community.slug}`}
    className="card hover:border-brand-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/5 group block"
  >
    {community.cover_image ? (
      <img
        src={community.cover_image}
        alt={community.name}
        className="w-full h-32 object-cover rounded-lg mb-4 -mt-1"
      />
    ) : (
      <div className="w-full h-32 rounded-lg bg-gradient-to-br from-brand-500/20 to-purple-500/10 mb-4 flex items-center justify-center">
        <span className="font-display font-black text-5xl text-brand-400/40">
          {community.name[0]}
        </span>
      </div>
    )}

    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold text-lg shrink-0">
        {community.name[0]}
      </div>
      <div className="min-w-0">
        <h3 className="font-display font-bold text-white group-hover:text-brand-300 transition-colors truncate">
          {community.name}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{community.description}</p>
      </div>
    </div>

    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-surface-border text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <Users size={12} /> {community.member_count.toLocaleString()} members
      </span>
      {community.monthly_price > 0 ? (
        <span className="flex items-center gap-1 text-brand-400">
          <Lock size={12} /> ${community.monthly_price}/mo
        </span>
      ) : (
        <span className="badge bg-green-500/10 text-green-400">Free</span>
      )}
    </div>
  </Link>
);

export default function DiscoverPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('trending');

  const { data, isLoading } = useQuery({
    queryKey: ['communities', search, category, sort],
    queryFn: () => communityApi.list({ 
      search: search || undefined,
      category: category || undefined,
      sort
    }).then(r => r.data),
  });

  const categories = ['All', 'Business', 'Technology', 'Design', 'Marketing', 'Health', 'General'];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-white mb-1">
            Discover Communities
          </h1>
          <p className="text-gray-500">Find your next learning community</p>
        </div>
        <Link to="/create-community" className="btn-primary gap-1">
          <Plus size={16} /> Create Community
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            className="input pl-9 w-full"
            placeholder="Search communities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c === 'All' ? '' : c)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                (category === c || (!category && c === 'All'))
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-card text-gray-400 hover:text-white hover:bg-surface-border'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-lg font-bold font-display text-white">
          {sort === 'trending' ? 'Trending Now' : 'Newest Communities'}
        </h2>
        <div className="ml-auto flex items-center bg-surface-card rounded-lg p-1 border border-surface-border">
          <button 
            onClick={() => setSort('trending')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sort === 'trending' ? 'bg-surface-border text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Trending
          </button>
          <button 
            onClick={() => setSort('newest')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sort === 'newest' ? 'bg-surface-border text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Newest
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse-soft h-56" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.communities?.map(c => <CommunityCard key={c.id} community={c} />)}
        </div>
      )}

      {!isLoading && data?.communities?.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg font-display font-bold text-gray-500">No communities found</p>
          <p className="text-sm mt-1">Try a different search or create your own</p>
        </div>
      )}
    </div>
  );
}
