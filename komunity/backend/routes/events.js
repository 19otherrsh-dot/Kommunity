// routes/events.js
const express = require('express');
const eventsRouter = express.Router({ mergeParams: true });
const { authenticate, requireMember, requireAdmin } = require('../middleware/auth');
const eventController = require('../controllers/eventController');

eventsRouter.get('/', authenticate, requireMember, eventController.list);
eventsRouter.post('/', authenticate, requireAdmin, eventController.create);
eventsRouter.get('/:eventId', authenticate, requireMember, eventController.get);
eventsRouter.patch('/:eventId', authenticate, requireAdmin, eventController.update);
eventsRouter.delete('/:eventId', authenticate, requireAdmin, eventController.cancel);
eventsRouter.post('/:eventId/rsvp', authenticate, requireMember, eventController.rsvp);
eventsRouter.delete('/:eventId/rsvp', authenticate, requireMember, eventController.unrsvp);
// Create Daily.co room for live session
eventsRouter.post('/:eventId/room', authenticate, requireAdmin, eventController.createRoom);

module.exports = eventsRouter;
