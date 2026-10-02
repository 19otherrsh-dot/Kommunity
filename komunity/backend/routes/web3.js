const express = require('express');
const router = express.Router();
const web3Controller = require('../controllers/web3Controller');
const { authenticate } = require('../middleware/auth');

// POST /api/web3/connect
router.post('/connect', authenticate, web3Controller.connectWallet);

// POST /api/web3/communities/:communityId/join
router.post('/communities/:communityId/join', web3Controller.joinWithTokenGate);

module.exports = router;
