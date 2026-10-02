const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireMember, requireModerator } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

// All routes scoped to /api/communities/:communityId/reports

// POST — any active member can report content
router.post('/', authenticate, requireMember, reportController.createReport);

// GET — moderators/admins review the queue
router.get('/', authenticate, requireModerator, reportController.listReports);

// PATCH — moderators/admins resolve a report
router.patch('/:reportId', authenticate, requireModerator, reportController.resolveReport);

module.exports = router;
