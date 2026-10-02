import { useState, useEffect, useRef } from 'react';
import { Search, X, User, FileText, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/api';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearch({ communitySlug }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, communitySlug],
    queryFn: () => searchApi.query(debouncedQuery, communitySlug).then(res => res.data),
    enabled: debouncedQuery.length > 2 && isOpen,
  });

  const handleSelect = (item) => {
    setIsOpen(false);
    setQuery('');
    
    if (item.type === 'member') {
      navigate(item.community_slug ? `/c/${item.community_slug}/members/${item.id}` : `/profile`);
    } else if (item.type === 'course') {
      navigate(`/c/${item.community_slug}/courses/${item.id}`);
    } else if (item.type === 'post') {
      navigate(`/c/${item.community_slug}/posts/${item.id}`);
    }
  };

  return (
    <div className="relative w-64" ref={wrapperRef}>
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3 text-gray-500" />
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="input-field w-full pl-9 py-1.5 text-sm bg-surface-card border-surface-border rounded-full"
        />
        {query && (
          <button 
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-3 text-gray-500 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && query.length > 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-card border border-surface-border rounded-xl shadow-2xl overflow-hidden z-50">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
          ) : (
            <div className="max-h-96 overflow-y-auto p-2">
              {!data?.members?.length && !data?.posts?.length && !data?.courses?.length ? (
                <div className="p-4 text-center text-sm text-gray-500">No results found.</div>
              ) : (
                <>
                  {data?.members?.length > 0 && (
                    <div className="mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-1">Members</h4>
                      {data.members.map(item => (
                        <button key={item.id} onClick={() => handleSelect(item)} className="w-full flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-left">
                          {item.image ? <img src={item.image} className="w-6 h-6 rounded-full" alt=""/> : <User size={16} className="text-gray-400"/>}
                          <span className="text-sm text-gray-200">{item.title}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {data?.courses?.length > 0 && (
                    <div className="mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-1">Courses</h4>
                      {data.courses.map(item => (
                        <button key={item.id} onClick={() => handleSelect(item)} className="w-full flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg text-left">
                          <BookOpen size={16} className="text-brand-400" />
                          <span className="text-sm text-gray-200">{item.title}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {data?.posts?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-1">Posts</h4>
                      {data.posts.map(item => (
                        <button key={item.id} onClick={() => handleSelect(item)} className="w-full flex items-start gap-2 p-2 hover:bg-white/5 rounded-lg text-left">
                          <FileText size={16} className="text-gray-400 mt-0.5 shrink-0" />
                          <span className="text-sm text-gray-300 line-clamp-2">{item.title.replace(/<[^>]*>?/gm, '')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
