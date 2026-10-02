const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// POST /api/auth/register
router.post('/register', registerValidation, authController.register);

// POST /api/auth/login
router.post('/login', loginValidation, authController.login);

// POST /api/auth/social
router.post('/social', authController.socialLogin);

// POST /api/auth/refresh
router.post('/refresh', authController.refresh);

// POST /api/auth/logout
router.post('/logout', authenticate, authController.logout);

// GET /api/auth/me
router.get('/me', authenticate, authController.me);
router.get('/me/platform-affiliates', authenticate, authController.getPlatformAffiliates);
router.get('/me/email-preferences', authenticate, authController.getEmailPreferences);
router.patch('/me/email-preferences', authenticate, authController.updateEmailPreferences);
router.patch('/me', authenticate, authController.updateProfile);

// POST /api/auth/forgot-password
router.post('/forgot-password', body('email').isEmail(), authController.forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', authController.resetPassword);

// POST /api/auth/fcm-token
router.post('/fcm-token', authenticate, authController.saveFcmToken);

module.exports = router;
