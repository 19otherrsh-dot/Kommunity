import { useState } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseApi, uploadApi } from '@/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Video, Trash2, Edit2, CheckCircle2 } from 'lucide-react';
import * as UpChunk from '@mux/upchunk';

export default function CourseBuilderPage() {
  const { community } = useOutletContext();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isNew = courseId === 'new';

  const [courseForm, setCourseForm] = useState({
    title: '', description: '', thumbnail_url: '', min_level_required: 1, min_tier_id: '', price: ''
  });

  const { data: course, isLoading } = useQuery({
    queryKey: ['course-admin', courseId],
    queryFn: () => courseApi.get(community.id, courseId).then(r => r.data),
    enabled: !isNew && !!community?.id,
    onSuccess: (data) => {
      setCourseForm({
        title: data.title,
        description: data.description,
        thumbnail_url: data.thumbnail_url || '',
        min_level_required: data.min_level_required || 1,
        min_tier_id: data.min_tier_id || '',
        price: data.price || '',
        is_published: data.is_published || false,
        sequential: data.sequential || false,
      });
    }
  });

  const saveCourseMut = useMutation({
    mutationFn: (data) => isNew 
      ? courseApi.create(community.id, data)
      : courseApi.update(community.id, courseId, data),
    onSuccess: (res) => {
      toast.success(isNew ? 'Course created!' : 'Course updated!');
      qc.invalidateQueries(['courses', community.id]);
      if (isNew) {
        navigate(`/c/${community.slug}/courses/${res.data.id}/edit`);
      } else {
        qc.invalidateQueries(['course-admin', courseId]);
      }
    }
  });

  const addModuleMut = useMutation({
    mutationFn: (title) => courseApi.createModule(community.id, courseId, { title }),
    onSuccess: () => {
      toast.success('Module added');
      qc.invalidateQueries(['course-admin', courseId]);
    }
  });

  if (isLoading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Link to={`/c/${community.slug}/courses`} className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 mb-6">
        <ArrowLeft size={14} /> Back to Courses
      </Link>
      
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display font-extrabold text-2xl text-white">
          {isNew ? 'Create Course' : 'Edit Course'}
        </h1>
        {!isNew && (
          <button onClick={() => saveCourseMut.mutate({ is_published: !courseForm.is_published })} className="btn-secondary">
            {courseForm.is_published ? 'Unpublish' : 'Publish Course'}
          </button>
        )}
      </div>

      <div className="card mb-8">
        <h2 className="font-semibold text-white mb-4">Course Details</h2>
        <div className="space-y-4">
          <input 
            type="text" 
            placeholder="Course Title" 
            className="input w-full"
            value={courseForm.title}
            onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))}
          />
          <textarea 
            placeholder="Course Description" 
            className="input w-full min-h-[100px]"
            value={courseForm.description}
            onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))}
          />
          <div className="flex gap-4">
            <label className="flex-1">
              <span className="block text-xs text-gray-400 mb-1">Thumbnail URL</span>
              <input 
                type="text" 
                placeholder="https://" 
                className="input w-full"
                value={courseForm.thumbnail_url}
                onChange={e => setCourseForm(p => ({ ...p, thumbnail_url: e.target.value }))}
              />
            </label>
            <label className="w-32">
              <span className="block text-xs text-gray-400 mb-1">Min Level</span>
              <input 
                type="number" 
                className="input w-full"
                value={courseForm.min_level_required}
                onChange={e => setCourseForm(p => ({ ...p, min_level_required: parseInt(e.target.value) || 1 }))}
              />
            </label>
            <label className="w-32">
              <span className="block text-xs text-gray-400 mb-1">Price ($)</span>
              <input 
                type="number" 
                placeholder="0"
                className="input w-full"
                value={courseForm.price}
                onChange={e => setCourseForm(p => ({ ...p, price: e.target.value }))}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={courseForm.sequential || false}
              onChange={e => setCourseForm(p => ({ ...p, sequential: e.target.checked }))}
            />
            <span className="text-sm text-gray-300">Sequential — lessons unlock only after the previous one is completed</span>
          </label>
          <button
            className="btn-primary w-full"
            onClick={() => saveCourseMut.mutate(courseForm)}
            disabled={saveCourseMut.isPending || !courseForm.title}
          >
            {saveCourseMut.isPending ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </div>

      {!isNew && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-white">Curriculum</h2>
            <button 
              className="btn-secondary text-sm gap-1"
              onClick={() => {
                const title = prompt('Module title:');
                if (title) addModuleMut.mutate(title);
              }}
            >
              <Plus size={14} /> Add Module
            </button>
          </div>

          {course?.modules?.map(module => (
            <ModuleEditor key={module.id} module={module} communityId={community.id} courseId={courseId} />
          ))}
          
          {course?.modules?.length === 0 && (
            <div className="card text-center py-12 text-gray-500">
              No modules yet. Add a module to start building your curriculum.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModuleEditor({ module, communityId, courseId }) {
  const qc = useQueryClient();
  
  const addLessonMut = useMutation({
    mutationFn: (data) => courseApi.createLesson(communityId, courseId, module.id, data),
    onSuccess: () => {
      qc.invalidateQueries(['course-admin', courseId]);
      toast.success('Lesson created');
    }
  });

  const deleteModuleMut = useMutation({
    mutationFn: () => courseApi.deleteModule(communityId, courseId, module.id),
    onSuccess: () => {
      qc.invalidateQueries(['course-admin', courseId]);
    }
  });

  return (
    <div className="border border-surface-border bg-surface rounded-xl overflow-hidden">
      <div className="bg-surface-card px-4 py-3 flex items-center justify-between border-b border-surface-border">
        <h3 className="font-semibold text-gray-200">{module.title}</h3>
        <button onClick={() => { if(confirm('Delete module?')) deleteModuleMut.mutate(); }} className="p-1 text-gray-500 hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
      
      <div className="p-4 space-y-3">
        {module.lessons?.map(lesson => (
          <LessonEditor key={lesson.id} lesson={lesson} communityId={communityId} courseId={courseId} moduleId={module.id} />
        ))}

        <button 
          onClick={() => {
            const title = prompt('Lesson title:');
            if (title) addLessonMut.mutate({ title, is_published: false });
          }}
          className="w-full py-2 border border-dashed border-surface-border rounded-lg text-sm text-gray-400 hover:text-brand-400 hover:border-brand-500/50 transition-colors"
        >
          + Add Lesson
        </button>
      </div>
    </div>
  );
}

// Learner-style preview so authors can test the quiz before publishing.
function QuizPreview({ questions }) {
  const [picks, setPicks] = useState({});
  const [checked, setChecked] = useState(false);
  const correct = questions.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);
  const score = Math.round((correct / questions.length) * 100);

  return (
    <div className="space-y-3">
      {questions.map((q, qi) => (
        <div key={qi} className="rounded-lg bg-surface border border-surface-border p-3">
          <p className="text-sm text-gray-200 font-medium mb-2">{qi + 1}. {q.q || <span className="text-gray-600 italic">(empty question)</span>}</p>
          <div className="space-y-1.5">
            {q.options.map((opt, oi) => {
              const isPicked = picks[qi] === oi;
              const isAnswer = q.answer === oi;
              let cls = 'border-surface-border text-gray-300 hover:bg-white/5';
              if (checked && isAnswer) cls = 'border-green-500/50 bg-green-500/10 text-green-300';
              else if (checked && isPicked && !isAnswer) cls = 'border-red-500/50 bg-red-500/10 text-red-300';
              else if (isPicked) cls = 'border-brand-500/50 bg-brand-500/10 text-brand-200';
              return (
                <label key={oi} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg cursor-pointer border ${cls}`}>
                  <input type="radio" name={`prev-${qi}`} checked={isPicked} onChange={() => setPicks(p => ({ ...p, [qi]: oi }))} disabled={checked} />
                  {opt || <span className="text-gray-600 italic">(empty option)</span>}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3">
        {!checked ? (
          <button type="button" onClick={() => setChecked(true)} disabled={Object.keys(picks).length !== questions.length} className="btn-primary text-xs">Check answers</button>
        ) : (
          <>
            <span className={`text-sm font-medium ${score >= 70 ? 'text-green-400' : 'text-amber-400'}`}>
              Score {score}% ({correct}/{questions.length}) — {score >= 70 ? 'pass' : 'fail (70% needed)'}
            </span>
            <button type="button" onClick={() => { setPicks({}); setChecked(false); }} className="btn-secondary text-xs">Retry</button>
          </>
        )}
      </div>
    </div>
  );
}

// Visual quiz authoring: edit questions, options, and the correct answer.
function QuizBuilder({ value, onChange }) {
  const questions = value?.questions || [];
  const [preview, setPreview] = useState(false);
  const update = (qs) => onChange(qs.length ? { questions: qs } : null);

  const addQuestion = () => update([...questions, { q: '', options: ['', ''], answer: 0 }]);
  const removeQuestion = (qi) => update(questions.filter((_, i) => i !== qi));
  const setQuestion = (qi, patch) => update(questions.map((q, i) => i === qi ? { ...q, ...patch } : q));
  const setOption = (qi, oi, text) => setQuestion(qi, { options: questions[qi].options.map((o, i) => i === oi ? text : o) });
  const addOption = (qi) => setQuestion(qi, { options: [...questions[qi].options, ''] });
  const removeOption = (qi, oi) => {
    const opts = questions[qi].options.filter((_, i) => i !== oi);
    const answer = questions[qi].answer >= opts.length ? 0 : questions[qi].answer;
    setQuestion(qi, { options: opts, answer });
  };

  return (
    <div className="border-t border-surface-border pt-3 mt-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quiz {questions.length > 0 && `(${questions.length})`}</span>
        <div className="flex items-center gap-2">
          {questions.length > 0 && (
            <button type="button" onClick={() => setPreview(p => !p)} className="btn-secondary text-[11px]">
              {preview ? 'Edit' : 'Preview'}
            </button>
          )}
          {!preview && <button type="button" onClick={addQuestion} className="btn-secondary text-[11px] gap-1"><Plus size={12} /> Question</button>}
        </div>
      </div>
      {questions.length === 0 && <p className="text-[11px] text-gray-600">No quiz. Add a question to require a passing score (70%) to complete this lesson.</p>}
      {preview ? (
        <QuizPreview questions={questions} />
      ) : (
      <div className="space-y-3">
        {questions.map((q, qi) => (
          <div key={qi} className="rounded-lg bg-surface border border-surface-border p-3 space-y-2">
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder={`Question ${qi + 1}`}
                value={q.q}
                onChange={e => setQuestion(qi, { q: e.target.value })}
              />
              <button type="button" onClick={() => removeQuestion(qi)} className="p-1.5 bg-red-500/10 rounded hover:bg-red-500/20 text-red-400"><Trash2 size={13} /></button>
            </div>
            <div className="space-y-1.5 pl-1">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={q.answer === oi}
                    onChange={() => setQuestion(qi, { answer: oi })}
                    title="Mark as correct answer"
                  />
                  <input
                    className="input flex-1 text-sm py-1.5"
                    placeholder={`Option ${oi + 1}`}
                    value={opt}
                    onChange={e => setOption(qi, oi, e.target.value)}
                  />
                  {q.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(qi, oi)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => addOption(qi)} className="text-[11px] text-brand-400 hover:text-brand-300 pl-6">+ Add option</button>
            </div>
            <p className="text-[10px] text-gray-600 pl-1">Select the radio next to the correct answer.</p>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function LessonEditor({ lesson, communityId, courseId, moduleId }) {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ title: lesson.title, content: lesson.content || '', duration_seconds: lesson.duration_seconds || 0, drip_days_after_enroll: lesson.drip_days_after_enroll || 0, quiz: lesson.quiz || null });
  const [uploadProgress, setUploadProgress] = useState(null);

  const saveLesson = () => {
    const quiz = form.quiz && form.quiz.questions?.length ? form.quiz : null;
    saveMut.mutate({ ...form, quiz, is_published: true });
  };

  const saveMut = useMutation({
    mutationFn: (data) => courseApi.updateLesson(communityId, courseId, moduleId, lesson.id, data),
    onSuccess: () => {
      qc.invalidateQueries(['course-admin', courseId]);
      setIsEditing(false);
      toast.success('Saved');
    }
  });

  const deleteMut = useMutation({
    mutationFn: () => courseApi.deleteLesson(communityId, courseId, moduleId, lesson.id),
    onSuccess: () => qc.invalidateQueries(['course-admin', courseId])
  });

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(0);
      // 1. Get Mux Upload URL
      const { data } = await uploadApi.getMuxUploadUrl();
      
      // 2. Start UpChunk
      const upload = UpChunk.createUpload({
        endpoint: data.upload_url,
        file,
        chunkSize: 5120, // 5MB chunks
      });

      upload.on('progress', progress => {
        setUploadProgress(Math.floor(progress.detail));
      });

      upload.on('success', async () => {
        toast.success('Video uploaded! Processing on Mux...');
        setUploadProgress(null);
        
        // Save upload_id temporarily
        saveMut.mutate({ mux_asset_id: data.upload_id, is_published: true });

        // Poll for playback_id
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await uploadApi.getMuxUploadStatus(data.upload_id);
            if (statusRes.data.status === 'ready' && statusRes.data.playback_id) {
              clearInterval(poll);
              saveMut.mutate({ 
                mux_asset_id: statusRes.data.asset_id,
                video_url: statusRes.data.playback_id // We store playback ID here
              });
              toast.success('Video processing complete!');
            } else if (attempts > 60) { // 2 mins timeout
              clearInterval(poll);
              toast.error('Video processing is taking too long. Check back later.');
            }
          } catch (e) {
            console.error('Polling error', e);
          }
        }, 2000);
      });

      upload.on('error', err => {
        console.error('Upload error', err);
        toast.error('Video upload failed');
        setUploadProgress(null);
      });

    } catch (err) {
      toast.error('Failed to get upload URL');
      setUploadProgress(null);
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-card border border-transparent hover:border-surface-border transition-colors group">
        <div className="flex items-center gap-3 min-w-0">
          <Video size={16} className={lesson.video_url ? "text-brand-400" : "text-gray-500"} />
          <span className="text-sm font-medium text-gray-200 truncate">{lesson.title}</span>
          {!lesson.is_published && <span className="badge bg-amber-500/10 text-amber-500 text-[10px]">Draft</span>}
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setIsEditing(true)} className="p-1.5 bg-surface-border rounded hover:bg-white/10 text-gray-400"><Edit2 size={14} /></button>
          <button onClick={() => { if(confirm('Delete lesson?')) deleteMut.mutate(); }} className="p-1.5 bg-red-500/10 rounded hover:bg-red-500/20 text-red-400"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-surface-card border border-brand-500/30 space-y-3">
      <input 
        type="text" 
        className="input w-full text-sm" 
        value={form.title} 
        onChange={e => setForm(p => ({ ...p, title: e.target.value }))} 
      />
      <textarea 
        className="input w-full text-sm min-h-[80px]" 
        placeholder="Lesson content/notes"
        value={form.content} 
        onChange={e => setForm(p => ({ ...p, content: e.target.value }))} 
      />
      <div className="flex gap-4">
        <div className="flex-1 border border-surface-border rounded-lg p-3 bg-surface flex flex-col justify-center items-center">
          {lesson.video_url ? (
            <div className="text-center">
              <CheckCircle2 size={24} className="text-green-400 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Video processed</p>
            </div>
          ) : uploadProgress !== null ? (
            <div className="w-full text-center">
              <div className="text-xs text-brand-400 mb-2">Uploading {uploadProgress}%</div>
              <div className="w-full bg-surface-border rounded-full h-1.5">
                <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : lesson.mux_asset_id ? (
            <div className="text-center animate-pulse">
              <Video size={24} className="text-brand-400/50 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Processing video...</p>
            </div>
          ) : (
            <>
              <Video size={24} className="text-gray-500 mb-2" />
              <label className="cursor-pointer">
                <span className="btn-secondary text-xs">Select Video</span>
                <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
              </label>
            </>
          )}
        </div>
        <div className="w-48 space-y-3">
          <label className="block">
            <span className="text-[10px] text-gray-500 block mb-1">Duration (seconds)</span>
            <input type="number" className="input w-full text-sm" value={form.duration_seconds} onChange={e => setForm(p => ({ ...p, duration_seconds: Number(e.target.value) }))} />
          </label>
          <label className="block">
            <span className="text-[10px] text-gray-500 block mb-1">Drip: unlock N days after join (0 = immediate)</span>
            <input type="number" min="0" className="input w-full text-sm" value={form.drip_days_after_enroll} onChange={e => setForm(p => ({ ...p, drip_days_after_enroll: Number(e.target.value) }))} />
          </label>
          <div className="flex gap-2">
            <button onClick={saveLesson} className="btn-primary text-xs flex-1">Save</button>
            <button onClick={() => setIsEditing(false)} className="btn-secondary text-xs">Cancel</button>
          </div>
        </div>
      </div>

      <QuizBuilder value={form.quiz} onChange={(quiz) => setForm(p => ({ ...p, quiz }))} />
    </div>
  );
}
