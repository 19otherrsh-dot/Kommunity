import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { courseApi, billingApi } from '@/api';
import { BookOpen, Play, CheckCircle2, Clock, Lock, Trophy, Plus, CreditCard, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/contexts/authStore';
import toast from 'react-hot-toast';

const ProgressBar = ({ percentage }) => (
  <div className="w-full bg-surface-border rounded-full h-1.5 mt-3">
    <div
      className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
      style={{ width: `${percentage}%` }}
    />
  </div>
);

const CourseCard = ({ course, community }) => {
  const pct = course.completed_percentage ?? 0;
  const isLocked = course.is_locked;
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckoutClick = async (e) => {
    e.preventDefault();
    if (isCheckingOut) return;
    try {
      setIsCheckingOut(true);
      const { data } = await billingApi.createCourseCheckout(community.id, course.id);
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error('Failed to initiate checkout');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleLockedClick = (e) => {
    e.preventDefault();
    if (Number(course.price) > 0) {
      handleCheckoutClick(e);
      return;
    }
    toast(`Reach Level ${course.min_level_required} to unlock this course. Keep posting & commenting!`, {
      icon: '🔒',
      duration: 3500,
    });
  };

  const Wrapper = isLocked ? 'div' : Link;
  const wrapperProps = isLocked
    ? { onClick: handleLockedClick, className: 'card border-surface-border/50 transition-all duration-200 group block cursor-pointer relative overflow-hidden opacity-80 hover:opacity-95' }
    : { to: `/c/${community.slug}/courses/${course.id}`, className: 'card hover:border-brand-500/40 transition-all duration-200 group block relative overflow-hidden' };

  return (
    <Wrapper {...wrapperProps}>
      {/* Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center mb-3">
            <Lock size={24} className="text-amber-400" />
          </div>
          <p className="font-display font-bold text-white text-sm">Locked</p>
          {Number(course.price) > 0 ? (
            <button className="btn-primary mt-2 flex items-center gap-2">
              <CreditCard size={14} />
              {isCheckingOut ? 'Loading...' : `Buy for $${course.price}`}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25">
              <Trophy size={12} className="text-amber-400" />
              <span className="text-xs font-semibold text-amber-300">Requires Level {course.min_level_required}</span>
            </div>
          )}
        </div>
      )}

      {course.thumbnail_url ? (
        <img src={course.thumbnail_url} className="w-full h-40 object-cover rounded-lg mb-4" alt="" />
      ) : (
        <div className="w-full h-40 rounded-lg bg-gradient-to-br from-brand-500/20 to-indigo-500/10 flex items-center justify-center mb-4">
          <BookOpen size={32} className="text-brand-400/50" />
        </div>
      )}

      <h3 className="font-display font-bold text-white group-hover:text-brand-300 transition-colors mb-1">
        {course.title}
      </h3>
      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{course.description}</p>

      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
        <span className="flex items-center gap-1">
          <Play size={11} /> {course.lesson_count} lessons
        </span>
        {!isLocked && pct > 0 && (
          <span className="flex items-center gap-1 text-brand-400">
            <CheckCircle2 size={11} /> {pct}% complete
          </span>
        )}
      </div>

      {!isLocked && pct > 0 && <ProgressBar percentage={pct} />}
    </Wrapper>
  );
};

export default function CoursesPage() {
  const { community } = useOutletContext();
  const { user } = useAuthStore();
  const isAdminOrMod = community?.role === 'admin' || community?.role === 'moderator';

  const { data, isLoading } = useQuery({
    queryKey: ['courses', community?.id],
    queryFn: () => courseApi.list(community.id).then(r => r.data),
    enabled: !!community?.id,
  });

  const qc = useQueryClient();
  const generateMut = useMutation({
    mutationFn: (topic) => courseApi.generateOutline(community.id, topic).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['courses', community.id]);
      toast.success('AI Course Generated successfully!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to generate course');
    }
  });

  const handleGenerate = () => {
    const topic = prompt('What topic do you want the AI to build a course about? (e.g. Advanced Next.js App Router)');
    if (topic) {
      generateMut.mutate(topic);
    }
  };

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3].map(i => <div key={i} className="card animate-pulse-soft h-64" />)}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display font-bold text-2xl text-white">Courses</h2>
          <p className="text-sm text-gray-500 mt-0.5">{data?.length ?? 0} courses available</p>
        </div>
        {isAdminOrMod && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleGenerate} 
              disabled={generateMut.isPending}
              className="btn-secondary gap-1 text-brand-400 hover:text-brand-300"
            >
              <Sparkles size={16} /> {generateMut.isPending ? 'Generating...' : 'Generate with AI'}
            </button>
            <Link to={`/c/${community.slug}/courses/new/edit`} className="btn-primary gap-1">
              <Plus size={16} /> Create Course
            </Link>
          </div>
        )}
      </div>

      {data?.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-display font-bold text-gray-500">No courses yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map(course => (
            <CourseCard key={course.id} course={course} community={community} />
          ))}
        </div>
      )}
    </div>
  );
}
