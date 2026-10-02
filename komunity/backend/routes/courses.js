const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireMember, requireAdmin } = require('../middleware/auth');
const courseController = require('../controllers/courseController');

// ─── Courses ──────────────────────────────────────────────────────────────────
// GET /api/communities/:communityId/courses
router.get('/', authenticate, requireMember, courseController.listCourses);

// POST /api/communities/:communityId/courses — Create course (admin)
router.post('/', authenticate, requireAdmin, courseController.createCourse);
router.post('/generate-outline', authenticate, requireAdmin, courseController.generateOutline);

// GET /api/communities/:communityId/courses/:courseId
router.get('/:courseId', authenticate, requireMember, courseController.getCourse);

// PATCH /api/communities/:communityId/courses/:courseId — Update course (admin)
router.patch('/:courseId', authenticate, requireAdmin, courseController.updateCourse);

// DELETE /api/communities/:communityId/courses/:courseId — Delete course (admin)
router.delete('/:courseId', authenticate, requireAdmin, courseController.deleteCourse);

// ─── Modules ──────────────────────────────────────────────────────────────────
// POST /api/communities/:communityId/courses/:courseId/modules
router.post('/:courseId/modules', authenticate, requireAdmin, courseController.createModule);

// PATCH /api/communities/:communityId/courses/:courseId/modules/:moduleId
router.patch('/:courseId/modules/:moduleId', authenticate, requireAdmin, courseController.updateModule);

// DELETE /api/communities/:communityId/courses/:courseId/modules/:moduleId
router.delete('/:courseId/modules/:moduleId', authenticate, requireAdmin, courseController.deleteModule);

// POST — Reorder modules
router.post('/:courseId/modules/reorder', authenticate, requireAdmin, courseController.reorderModules);

// ─── Lessons ──────────────────────────────────────────────────────────────────
// POST /api/communities/:communityId/courses/:courseId/modules/:moduleId/lessons
router.post('/:courseId/modules/:moduleId/lessons', authenticate, requireAdmin, courseController.createLesson);

// PATCH /.../lessons/:lessonId
router.patch('/:courseId/modules/:moduleId/lessons/:lessonId', authenticate, requireAdmin, courseController.updateLesson);

// DELETE /.../lessons/:lessonId
router.delete('/:courseId/modules/:moduleId/lessons/:lessonId', authenticate, requireAdmin, courseController.deleteLesson);

// POST /.../lessons/:lessonId/complete — Mark lesson complete (member)
router.post('/:courseId/lessons/:lessonId/complete', authenticate, requireMember, courseController.completeLesson);

// POST /.../lessons/:lessonId/quiz — Submit a quiz attempt (member)
router.post('/:courseId/lessons/:lessonId/quiz', authenticate, requireMember, courseController.submitQuiz);

// GET /api/communities/:communityId/courses/:courseId/certificate — Issue/fetch certificate
router.get('/:courseId/certificate', authenticate, requireMember, courseController.getCertificate);

// GET /api/communities/:communityId/courses/:courseId/progress — Get my progress
router.get('/:courseId/progress', authenticate, requireMember, courseController.getProgress);

// POST — Get Mux upload URL for lesson video
router.post('/:courseId/lessons/upload-url', authenticate, requireAdmin, courseController.getVideoUploadUrl);

module.exports = router;
