const { query, getClient } = require('../db');
const { awardPoints, checkAndAwardBadges } = require('../utils/points');
const ai = require('../utils/ai');
const { gradeQuiz, PASS_MARK } = require('../utils/quiz');

// ─── Courses ──────────────────────────────────────────────────────────────────
const listCourses = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const memberLevel = req.membership?.level ?? 1;
    const memberTierPrice = Number(req.membership?.tier_price ?? 0);
    const result = await query(
      `SELECT c.*, 
              t.price as min_tier_price,
              COUNT(DISTINCT l.id) AS lesson_count,
              COUNT(DISTINCT lp.user_id) AS enrolled_count,
              EXISTS(SELECT 1 FROM course_purchases cp WHERE cp.course_id = c.id AND cp.user_id = $2) AS is_purchased
       FROM courses c
       LEFT JOIN community_tiers t ON t.id = c.min_tier_id
       LEFT JOIN course_modules cm ON cm.course_id = c.id
       LEFT JOIN lessons l ON l.module_id = cm.id AND l.is_published = TRUE
       LEFT JOIN lesson_progress lp ON lp.course_id = c.id
       WHERE c.community_id = $1 AND c.is_published = TRUE
       GROUP BY c.id, t.price
       ORDER BY c.created_at ASC`,
      [communityId, req.user.id]
    );

    // Annotate each course with lock status based on member level and tier
    const courses = result.rows.map(course => {
      const levelLocked = memberLevel < (course.min_level_required ?? 1);
      const tierLocked = course.min_tier_price !== null && memberTierPrice < Number(course.min_tier_price);
      return {
        ...course,
        is_locked: course.is_purchased ? false : (levelLocked || tierLocked),
      };
    });

    res.json(courses);
  } catch (err) {
    next(err);
  }
};

const getCourse = async (req, res, next) => {
  try {
    const { communityId, courseId } = req.params;
    const memberLevel = req.membership?.level ?? 1;
    const memberTierPrice = Number(req.membership?.tier_price ?? 0);

    const courseResult = await query(
      `SELECT c.*, t.price as min_tier_price,
              EXISTS(SELECT 1 FROM course_purchases cp WHERE cp.course_id = c.id AND cp.user_id = $3) AS is_purchased
       FROM courses c 
       LEFT JOIN community_tiers t ON t.id = c.min_tier_id
       WHERE c.id = $1 AND c.community_id = $2`,
      [courseId, communityId, req.user.id]
    );
    if (!courseResult.rows.length) return res.status(404).json({ error: 'Course not found' });

    const course = courseResult.rows[0];
    const levelLocked = memberLevel < (course.min_level_required ?? 1);
    const tierLocked = course.min_tier_price !== null && memberTierPrice < Number(course.min_tier_price);
    const isLocked = course.is_purchased ? false : (levelLocked || tierLocked);

    // If locked, return metadata only — no curriculum
    if (isLocked) {
      return res.json({
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        min_level_required: course.min_level_required,
        is_locked: true,
        is_tier_locked: tierLocked,
        is_level_locked: levelLocked,
        your_level: memberLevel,
        min_tier_id: course.min_tier_id,
        min_tier_price: course.min_tier_price,
        price: course.price,
        modules: [],
      });
    }

    const modulesResult = await query(
      `SELECT cm.*,
              json_agg(
                json_build_object(
                  'id', l.id, 'title', l.title, 'position', l.position,
                  'duration_seconds', l.duration_seconds, 'is_published', l.is_published,
                  'completed', lp.completed,
                  'drip_days_after_enroll', l.drip_days_after_enroll,
                  'available_at', l.available_at,
                  'quiz', l.quiz,
                  'quiz_score', lp.quiz_score
                ) ORDER BY l.position
              ) FILTER (WHERE l.id IS NOT NULL) AS lessons
       FROM course_modules cm
       LEFT JOIN lessons l ON l.module_id = cm.id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $2
       WHERE cm.course_id = $1
       GROUP BY cm.id
       ORDER BY cm.position`,
      [courseId, req.user.id]
    );

    // Drip release: a lesson unlocks N days after the member joined, and/or at a fixed date.
    const enrolledAt = req.membership?.id
      ? (await query('SELECT joined_at FROM community_members WHERE community_id = $1 AND user_id = $2', [communityId, req.user.id])).rows[0]?.joined_at
      : null;
    const now = Date.now();
    // Admins/moderators author quizzes, so they receive the full quiz (incl. correct
    // answers); learners get answers stripped to prevent cheating.
    const isEditor = ['admin', 'moderator'].includes(req.membership?.role);
    // Sequential unlock: a lesson is locked until every earlier (published) lesson is completed.
    let prevAllCompleted = true;
    const annotateLesson = (l) => {
      let unlocksAt = null;
      if (l.drip_days_after_enroll > 0 && enrolledAt) {
        unlocksAt = new Date(new Date(enrolledAt).getTime() + l.drip_days_after_enroll * 86400000);
      }
      if (l.available_at) {
        const fixed = new Date(l.available_at);
        if (!unlocksAt || fixed > unlocksAt) unlocksAt = fixed;
      }
      const dripped = !unlocksAt || unlocksAt.getTime() <= now;
      const sequentialLocked = course.sequential && !prevAllCompleted;
      // Editors get the full quiz (with answers); learners get answers stripped
      const quiz = l.quiz
        ? (isEditor
            ? l.quiz
            : { questions: (l.quiz.questions || []).map(q => ({ q: q.q, options: q.options })) })
        : null;
      const annotated = {
        ...l,
        quiz,
        has_quiz: Boolean(l.quiz),
        unlocks_at: unlocksAt,
        is_drip_locked: !dripped,
        is_sequential_locked: sequentialLocked,
        is_locked: !dripped || sequentialLocked,
      };
      // Update running gate for the NEXT lesson (after evaluating this one)
      if (!l.completed) prevAllCompleted = false;
      return annotated;
    };
    const modules = modulesResult.rows.map(m => ({
      ...m,
      lessons: (m.lessons || []).map(annotateLesson),
    }));

    res.json({ ...course, is_locked: false, modules });
  } catch (err) {
    next(err);
  }
};

const createCourse = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { title, description, thumbnail_url, min_level_required, min_tier_id, price } = req.body;
    const result = await query(
      'INSERT INTO courses (community_id, creator_id, title, description, thumbnail_url, min_level_required, min_tier_id, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [communityId, req.user.id, title, description, thumbnail_url, min_level_required ?? 1, min_tier_id || null, price || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description, thumbnail_url, is_published, min_level_required, min_tier_id, price, sequential } = req.body;
    const result = await query(
      `UPDATE courses SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        thumbnail_url = COALESCE($3, thumbnail_url),
        is_published = COALESCE($4, is_published),
        min_level_required = COALESCE($5, min_level_required),
        min_tier_id = $6,
        price = COALESCE($7, price),
        sequential = COALESCE($9, sequential),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, description, thumbnail_url, is_published, min_level_required, min_tier_id || null, price, courseId, typeof sequential === 'boolean' ? sequential : null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    await query('DELETE FROM courses WHERE id = $1', [courseId]);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Modules ──────────────────────────────────────────────────────────────────
const createModule = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, position } = req.body;
    const result = await query(
      'INSERT INTO course_modules (course_id, title, position) VALUES ($1, $2, $3) RETURNING *',
      [courseId, title, position ?? 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { title, position } = req.body;
    const result = await query(
      'UPDATE course_modules SET title = COALESCE($1, title), position = COALESCE($2, position) WHERE id = $3 RETURNING *',
      [title, position, moduleId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteModule = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    await query('DELETE FROM course_modules WHERE id = $1', [moduleId]);
    res.json({ message: 'Module deleted' });
  } catch (err) {
    next(err);
  }
};

const reorderModules = async (req, res, next) => {
  // req.body.order = [{ id, position }]
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const item of req.body.order) {
      await client.query('UPDATE course_modules SET position = $1 WHERE id = $2', [item.position, item.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Reordered' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ─── Lessons ──────────────────────────────────────────────────────────────────
const createLesson = async (req, res, next) => {
  try {
    const { courseId, moduleId } = req.params;
    const { title, content, video_url, mux_asset_id, attachments, position, duration_seconds, drip_days_after_enroll, available_at, quiz } = req.body;
    const result = await query(
      `INSERT INTO lessons (module_id, course_id, title, content, video_url, mux_asset_id, attachments, position, duration_seconds, drip_days_after_enroll, available_at, quiz)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [moduleId, courseId, title, content, video_url, mux_asset_id, JSON.stringify(attachments ?? []), position ?? 0, duration_seconds ?? 0, drip_days_after_enroll ?? 0, available_at || null, quiz ? JSON.stringify(quiz) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { title, content, video_url, is_published, duration_seconds, drip_days_after_enroll, available_at, quiz } = req.body;
    const result = await query(
      `UPDATE lessons SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        video_url = COALESCE($3, video_url),
        is_published = COALESCE($4, is_published),
        duration_seconds = COALESCE($5, duration_seconds),
        drip_days_after_enroll = COALESCE($6, drip_days_after_enroll),
        available_at = COALESCE($7, available_at),
        quiz = COALESCE($9, quiz),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, content, video_url, is_published, duration_seconds, drip_days_after_enroll, available_at || null, lessonId, quiz ? JSON.stringify(quiz) : null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    await query('DELETE FROM lessons WHERE id = $1', [lessonId]);
    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    next(err);
  }
};

const completeLesson = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { courseId, lessonId, communityId } = req.params;

    // Enforce drip release: can't complete a lesson that hasn't unlocked yet
    const dripCheck = await client.query(
      `SELECT l.drip_days_after_enroll, l.available_at, cm.joined_at
       FROM lessons l
       LEFT JOIN community_members cm ON cm.community_id = $3 AND cm.user_id = $2
       WHERE l.id = $1`,
      [lessonId, req.user.id, communityId]
    );
    if (dripCheck.rows.length) {
      const { drip_days_after_enroll, available_at, joined_at } = dripCheck.rows[0];
      let unlocksAt = null;
      if (drip_days_after_enroll > 0 && joined_at) {
        unlocksAt = new Date(new Date(joined_at).getTime() + drip_days_after_enroll * 86400000);
      }
      if (available_at) {
        const fixed = new Date(available_at);
        if (!unlocksAt || fixed > unlocksAt) unlocksAt = fixed;
      }
      if (unlocksAt && unlocksAt.getTime() > Date.now()) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'This lesson is not available yet', unlocks_at: unlocksAt });
      }
    }

    await client.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed, completed_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed = TRUE, completed_at = NOW()`,
      [req.user.id, lessonId, courseId]
    );

    // Award gamification points using shared utility
    await awardPoints(client, communityId, req.user.id, 'lesson_complete', lessonId);
    await checkAndAwardBadges(client, communityId, req.user.id);

    await client.query('COMMIT');
    res.json({ message: 'Lesson marked complete' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const getProgress = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const result = await query(
      `SELECT lp.*, l.title AS lesson_title
       FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       WHERE lp.course_id = $1 AND lp.user_id = $2`,
      [courseId, req.user.id]
    );
    const total = await query(
      'SELECT COUNT(*) FROM lessons WHERE course_id = $1 AND is_published = TRUE', [courseId]
    );
    const completed = result.rows.filter(r => r.completed).length;
    res.json({
      completed_lessons: completed,
      total_lessons: Number(total.rows[0].count),
      percentage: total.rows[0].count > 0 ? Math.round((completed / total.rows[0].count) * 100) : 0,
      progress: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

const getVideoUploadUrl = async (req, res, next) => {
  // Returns a Mux direct upload URL for the client to PUT video directly
  try {
    const { default: Mux } = await import('@mux/mux-node');
    const mux = new Mux({ tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET });
    const upload = await mux.video.uploads.create({
      cors_origin: process.env.FRONTEND_URL,
      new_asset_settings: { playback_policy: ['public'] },
    });
    res.json({ upload_url: upload.url, upload_id: upload.id });
  } catch (err) {
    next(err);
  }
};

const generateOutline = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    // Generate outline via AI
    const modules = await ai.generateCourseOutline(topic);

    // Create the course itself first (creator_id is NOT NULL)
    const courseRes = await query(
      'INSERT INTO courses (community_id, creator_id, title, description, is_published) VALUES ($1, $2, $3, $4, FALSE) RETURNING *',
      [communityId, req.user.id, `AI Generated: ${topic}`, `An AI-generated course about ${topic}`]
    );
    const course = courseRes.rows[0];

    // Create modules and lessons in DB
    let modPos = 1;
    for (const mod of modules) {
      const modRes = await query(
        'INSERT INTO course_modules (course_id, title, description, position) VALUES ($1, $2, $3, $4) RETURNING *',
        [course.id, mod.title, mod.description || '', modPos++]
      );
      const modId = modRes.rows[0].id;
      
      let lesPos = 1;
      for (const les of mod.lessons || []) {
        await query(
          'INSERT INTO lessons (course_id, module_id, title, content, position, is_published) VALUES ($1, $2, $3, $4, $5, FALSE)',
          [course.id, modId, les.title, les.content || '', lesPos++]
        );
      }
    }

    res.json({ message: 'Course generated successfully', course });
  } catch (err) {
    next(err);
  }
};

// Grade a quiz submission server-side; passing marks the lesson complete + awards points.
const submitQuiz = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { courseId, lessonId, communityId } = req.params;
    const { answers } = req.body; // array of selected option indices, parallel to questions

    const lessonRes = await client.query('SELECT quiz FROM lessons WHERE id = $1 AND course_id = $2', [lessonId, courseId]);
    const quiz = lessonRes.rows[0]?.quiz;
    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This lesson has no quiz' });
    }

    const graded = gradeQuiz(quiz, answers, PASS_MARK);
    if (!graded) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Please answer every question' });
    }
    const { correct, score, passed } = graded;

    await client.query(
      `INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed, completed_at, quiz_score)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN NOW() ELSE NULL END, $5)
       ON CONFLICT (user_id, lesson_id)
       DO UPDATE SET quiz_score = GREATEST(COALESCE(lesson_progress.quiz_score, 0), $5),
                     completed = lesson_progress.completed OR $4,
                     completed_at = COALESCE(lesson_progress.completed_at, CASE WHEN $4 THEN NOW() ELSE NULL END)`,
      [req.user.id, lessonId, courseId, passed, score]
    );

    if (passed) {
      await awardPoints(client, communityId, req.user.id, 'lesson_complete', lessonId);
      await checkAndAwardBadges(client, communityId, req.user.id);
    }

    await client.query('COMMIT');
    res.json({ score, passed, pass_mark: PASS_MARK, correct, total: quiz.questions.length });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// Issue (or fetch) a completion certificate once the learner has finished the course.
const getCertificate = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const totals = await query(
      `SELECT
         (SELECT COUNT(*) FROM lessons WHERE course_id = $1 AND is_published = TRUE) AS total,
         (SELECT COUNT(*) FROM lesson_progress WHERE course_id = $1 AND user_id = $2 AND completed = TRUE) AS done`,
      [courseId, req.user.id]
    );
    const { total, done } = totals.rows[0];
    if (Number(total) === 0 || Number(done) < Number(total)) {
      return res.status(403).json({ error: 'Complete all lessons to earn your certificate' });
    }

    // Idempotent issue: short serial from the cert id
    const serial = 'KMN-' + require('crypto').randomBytes(5).toString('hex').toUpperCase();
    const certRes = await query(
      `INSERT INTO certificates (course_id, user_id, serial)
       VALUES ($1, $2, $3)
       ON CONFLICT (course_id, user_id) DO UPDATE SET course_id = EXCLUDED.course_id
       RETURNING serial, issued_at`,
      [courseId, req.user.id, serial]
    );

    const meta = await query(
      `SELECT c.title AS course_title, u.full_name AS user_name
       FROM courses c, users u WHERE c.id = $1 AND u.id = $2`,
      [courseId, req.user.id]
    );

    res.json({
      serial: certRes.rows[0].serial,
      issued_at: certRes.rows[0].issued_at,
      course_title: meta.rows[0]?.course_title,
      user_name: meta.rows[0]?.user_name,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listCourses, getCourse, createCourse, updateCourse, deleteCourse,
  createModule, updateModule, deleteModule, reorderModules,
  createLesson, updateLesson, deleteLesson, completeLesson, getProgress, getVideoUploadUrl, generateOutline,
  submitQuiz, getCertificate
};
