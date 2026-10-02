const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getConversations, getMessages, sendMessage } = require('../controllers/messageController');

router.use(authenticate);

router.get('/', getConversations);
router.get('/:conversationId', getMessages);
router.post('/', sendMessage);

module.exports = router;
