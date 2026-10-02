import { useState } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, CheckCircle2, Lock, ChevronDown, ChevronRight, Clock, Trophy, ArrowLeft, Flame, Edit2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import MuxPlayer from '@mux/mux-player-react';
import { billingApi, courseApi } from '@/api';

const formatDuration = (seconds) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// ── Quiz panel ──────────────────────────────────────────────────────────────
function QuizPanel({ quiz, alreadyPassed, lastScore, onSubmit, onPassed }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const questions = quiz.questions || [];
  const allAnswered = questions.every((_, i) => answers[i] !== undefined);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await onSubmit(questions.map((_, i) => answers[i]));
      setResult(res);
      if (res.passed) { toast.success(`Passed with ${res.score}%! 🎉`); onPassed?.(); }
      else toast.error(`Scored ${res.score}% — ${res.pass_mark}% needed to pass`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-surface-border">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quiz</p>
      {alreadyPassed && (
        <p className="text-sm text-green-400 mb-3">✓ You passed this quiz{lastScore != null ? ` (${lastScore}%)` : ''}.</p>
      )}
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi}>
            <p className="text-sm text-gray-200 font-medium mb-2">{qi + 1}. {q.q}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => (
                <label key={oi} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg cursor-pointer border ${answers[qi] === oi ? 'border-brand-500/50 bg-brand-500/10 text-brand-200' : 'border-surface-border text-gray-300 hover:bg-white/5'}`}>
                  <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers(a => ({ ...a, [qi]: oi }))} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {result && (
        <p className={`text-sm mt-3 font-medium ${result.passed ? 'text-green-400' : 'text-amber-400'}`}>
          You scored {result.score}% ({result.correct}/{result.total}).
        </p>
      )}
      <button onClick={submit} disabled={!allAnswered || submitting} className="btn-primary mt-4">
        {submitting ? 'Submitting…' : (alreadyPassed ? 'Retake quiz' : 'Submit quiz')}
      </button>
    </div>
  );
}

// ── Certificate modal ─────────────────────────────────────────────────────────
function CertificateModal({ cert, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white text-gray-900 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-10 text-center border-[6px] border-brand-500/20 m-4 rounded-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-4">Certificate of Completion</p>
          <p className="text-sm text-gray-500">This certifies that</p>
          <h2 className="font-display font-extrabold text-3xl text-gray-900 my-2">{cert.user_name}</h2>
          <p className="text-sm text-gray-500">has successfully completed</p>
          <h3 className="font-display font-bold text-xl text-brand-600 my-2">{cert.course_title}</h3>
          <p className="text-xs text-gray-400 mt-6">
            Issued {new Date(cert.issued_at).toLocaleDateString()} · Serial {cert.serial}
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={() => window.print()} className="btn-secondary text-sm">Print / Save PDF</button>
          <button onClick={onClose} className="btn-primary text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function CoursePage() {
  const { community } = useOutletContext();
  const { courseId } = useParams();
  const [activeLesson, setActiveLesson] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const qc = useQueryClient();
  const isAdminOrMod = community?.role === 'admin' || community?.role === 'moderator';
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [cert, setCert] = useState(null);
  const [loadingCert, setLoadingCert] = useState(false);

  const loadCertificate = async () => {
    setLoadingCert(true);
    try {
      const { data } = await courseApi.getCertificate(community.id, courseId);
      setCert(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not load certificate');
    } finally {
      setLoadingCert(false);
    }
  };

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => courseApi.get(community.id, courseId).then(r => r.data),
    enabled: !!community?.id,
    onSuccess: (data) => {
      if (data.is_locked) return; // Don't expand modules for locked courses
      // Auto-expand all modules
      const expanded = {};
      data.modules?.forEach(m => { expanded[m.id] = true; });
      setExpandedModules(expanded);
      // Auto-select first lesson
      if (!activeLesson && data.modules?.[0]?.lessons?.[0]) {
        setActiveLesson(data.modules[0].lessons[0]);
      }
    },
  });

  const { data: progress } = useQuery({
    queryKey: ['course-progress', courseId],
    queryFn: () => courseApi.getProgress(community.id, courseId).then(r => r.data),
    enabled: !!community?.id && !course?.is_locked,
  });

  const completeMutation = useMutation({
    mutationFn: (lessonId) => courseApi.completeLesson(community.id, courseId, lessonId),
    onSuccess: () => {
      qc.invalidateQueries(['course-progress', courseId]);
      toast.success('Lesson complete! 🎉');
    },
  });

  const toggleModule = (moduleId) =>
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));

  const isCompleted = (lessonId) =>
    progress?.progress?.some(p => p.lesson_id === lessonId && p.completed);

  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-surface-card rounded w-64" />
      <div className="h-4 bg-surface-card rounded w-96" />
    </div>
  );

  // ─── Locked Course View ─────────────────────────────────────────────────────
  if (course?.is_locked) {
    const isLevelLocked = course.is_level_locked;
    const isTierLocked = course.is_tier_locked;
    const levelsAway = (course.min_level_required ?? 1) - (course.your_level ?? 1);

    const handleCheckout = async () => {
      try {
        setIsCheckingOut(true);
        const { data } = await billingApi.createCheckout(community.id, course.min_tier_id);
        window.location.href = data.checkout_url;
      } catch (err) {
        toast.error('Failed to initiate checkout');
      } finally {
        setIsCheckingOut(false);
      }
    };
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-280px)] animate-fade-in">
        <div className="card max-w-lg w-full text-center px-8 py-12 border-amber-500/20">
          {/* Thumbnail preview */}
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} className="w-full h-44 object-cover rounded-xl mb-6 opacity-60" alt="" />
          ) : (
            <div className="w-full h-44 rounded-xl bg-gradient-to-br from-brand-500/10 to-indigo-500/5 flex items-center justify-center mb-6">
              <Lock size={48} className="text-amber-400/40" />
            </div>
          )}

          {/* Lock badge */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 mb-5 mx-auto">
            <Lock size={28} className="text-amber-400" />
          </div>

          <h1 className="font-display font-bold text-2xl text-white mb-2">{course.title}</h1>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">{course.description}</p>

          {isTierLocked ? (
            <div className="flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/25 mb-4">
                <Lock size={16} className="text-brand-400" />
                <span className="text-sm font-semibold text-brand-300">
                  Premium Course
                </span>
              </div>
              <div className="p-4 w-full rounded-xl bg-surface border border-surface-border mt-2">
                <p className="text-sm text-gray-300 mb-4">
                  This course is exclusively available for premium members. Upgrade your membership to get instant access.
                </p>
                <button 
                  onClick={handleCheckout} 
                  disabled={isCheckingOut}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  <CreditCard size={18} />
                  {isCheckingOut ? 'Loading...' : `Unlock for $${course.min_tier_price}/mo`}
                </button>
              </div>
            </div>
          ) : isLevelLocked ? (
            <>
              {/* Level requirement badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/25 mb-4">
                <Trophy size={16} className="text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">
                  Requires Level {course.min_level_required}
                </span>
              </div>

              {/* Progress hint */}
              <div className="p-4 rounded-xl bg-surface border border-surface-border mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame size={16} className="text-orange-400" />
                  <span className="text-xs font-semibold text-gray-300">
                    You are Level {course.your_level ?? 1} — {levelsAway > 0 ? `${levelsAway} level${levelsAway > 1 ? 's' : ''} away` : 'almost there!'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Earn points by posting in the feed, commenting on discussions, completing other courses, and attending events. Every action brings you closer!
                </p>
              </div>
            </>
          ) : null}

          {/* Back link */}
          <Link
            to={`/c/${community.slug}/courses`}
            className="inline-flex items-center gap-1.5 mt-6 text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Courses
          </Link>
        </div>
      </div>
    );
  }

  // ─── Unlocked Course View ─────────────────────────────────────────────────────
  const completedCount = progress?.completed_lessons || 0;
  const totalLessons = progress?.total_lessons || 1;
  const percent = Math.round((completedCount / totalLessons) * 100);
  const isComplete = totalLessons > 0 && completedCount >= totalLessons;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-200px)]">
      {cert && <CertificateModal cert={cert} onClose={() => setCert(null)} />}
      {/* Curriculum Sidebar */}
      <aside className="w-72 shrink-0">
        <div className="card sticky top-24">
          <div className="flex justify-between items-start mb-1">
            <h2 className="font-display font-bold text-white pr-2">{course?.title}</h2>
            {isAdminOrMod && (
              <Link to={`/c/${community.slug}/courses/${courseId}/edit`} className="text-gray-500 hover:text-brand-400 p-1 shrink-0 bg-surface rounded-md">
                <Edit2 size={14} />
              </Link>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-4">{course?.description}</p>

          {/* Progress */}
          <div className="mb-4 p-3 rounded-lg bg-surface border border-surface-border text-center">
            {isComplete ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <Trophy className="text-green-400 mx-auto mb-1" size={24} />
                <p className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2">Course Complete!</p>
                <button onClick={loadCertificate} disabled={loadingCert} className="btn-secondary text-xs w-full justify-center">
                  {loadingCert ? 'Loading…' : 'Get Certificate'}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-gray-400">Your progress</span>
                  <span className="text-brand-400 font-semibold">{percent}%</span>
                </div>
                <div className="w-full bg-surface-border rounded-full h-1.5">
                  <div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{ width: `${percent}%` }} />
                </div>
                <p className="text-xs text-gray-600 mt-1.5 text-left">{completedCount} / {totalLessons} lessons</p>
              </>
            )}
          </div>

          {/* Module list */}
          <div className="space-y-1">
            {course?.modules?.map((module, mi) => (
              <div key={module.id}>
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/5 text-left transition-colors group"
                >
                  {expandedModules[module.id]
                    ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                    : <ChevronRight size={14} className="text-gray-500 shrink-0" />
                  }
                  <span className="text-xs font-semibold text-gray-300 truncate">
                    {mi + 1}. {module.title}
                  </span>
                </button>

                {expandedModules[module.id] && (
                  <div className="ml-4 space-y-0.5 mt-0.5">
                    {module.lessons?.map((lesson, li) => {
                      const done = isCompleted(lesson.id);
                      const isActive = activeLesson?.id === lesson.id;
                      const locked = lesson.is_locked; // drip OR sequential lock
                      const unlockLabel = locked
                        ? (lesson.is_sequential_locked
                            ? 'Finish previous lessons'
                            : lesson.unlocks_at ? `Unlocks ${new Date(lesson.unlocks_at).toLocaleDateString()}` : 'Locked')
                        : '';
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => { if (!locked) setActiveLesson(lesson); }}
                          disabled={locked}
                          title={unlockLabel}
                          className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left text-xs transition-all ${
                            locked
                              ? 'text-gray-600 cursor-not-allowed opacity-60'
                              : isActive
                              ? 'bg-brand-500/15 text-brand-300'
                              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          {locked
                            ? <Lock size={13} className="shrink-0 opacity-70" />
                            : done
                            ? <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                            : <Play size={13} className="shrink-0 opacity-60" />
                          }
                          <span className="truncate">{lesson.title}</span>
                          {locked && unlockLabel ? (
                            <span className="ml-auto shrink-0 text-gray-600 text-[10px]">{unlockLabel}</span>
                          ) : lesson.duration_seconds > 0 && (
                            <span className="ml-auto shrink-0 text-gray-600 font-mono text-[10px]">
                              {formatDuration(lesson.duration_seconds)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Lesson Viewer */}
      <div className="flex-1 min-w-0">
        {activeLesson ? (
          <div className="animate-fade-in">
            {/* Video */}
            {activeLesson.video_url && (
              <div className="aspect-video bg-black rounded-xl overflow-hidden mb-6">
                <MuxPlayer
                  playbackId={activeLesson.video_url}
                  metadata={{ video_title: activeLesson.title }}
                  accentColor="#6366f1"
                  className="w-full h-full"
                />
              </div>
            )}

            <div className="card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="font-display font-bold text-xl text-white mb-1">
                    {activeLesson.title}
                  </h1>
                  {activeLesson.duration_seconds > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} /> {formatDuration(activeLesson.duration_seconds)}
                    </span>
                  )}
                </div>
                {!isCompleted(activeLesson.id) && !activeLesson.has_quiz && (
                  <button
                    onClick={() => completeMutation.mutate(activeLesson.id)}
                    disabled={completeMutation.isPending}
                    className="btn-primary shrink-0"
                  >
                    <CheckCircle2 size={15} />
                    {completeMutation.isPending ? 'Saving…' : 'Mark complete'}
                  </button>
                )}
                {isCompleted(activeLesson.id) && (
                  <span className="badge bg-green-500/15 text-green-400 px-3 py-1.5">
                    <CheckCircle2 size={13} /> Completed
                  </span>
                )}
              </div>

              {activeLesson.content && (
                <div className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed">
                  <p>{activeLesson.content}</p>
                </div>
              )}

              {activeLesson.has_quiz && activeLesson.quiz && (
                <QuizPanel
                  key={activeLesson.id}
                  quiz={activeLesson.quiz}
                  alreadyPassed={isCompleted(activeLesson.id)}
                  lastScore={activeLesson.quiz_score}
                  onSubmit={(answers) => courseApi.submitQuiz(community.id, courseId, activeLesson.id, answers).then(r => r.data)}
                  onPassed={() => {
                    qc.invalidateQueries(['course', courseId]);
                    qc.invalidateQueries(['course-progress', courseId]);
                  }}
                />
              )}

              {/* Attachments */}
              {activeLesson.attachments?.length > 0 && (
                <div className="mt-6 pt-4 border-t border-surface-border">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Attachments
                  </p>
                  <div className="space-y-1">
                    {activeLesson.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
                      >
                        📎 {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <Play size={40} className="text-brand-400/30 mb-4" />
            <p className="font-display font-bold text-gray-500">Select a lesson to start learning</p>
          </div>
        )}
      </div>
    </div>
  );
}
