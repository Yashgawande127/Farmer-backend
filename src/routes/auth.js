const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter, createAccountLimiter } = require('../middleware/rateLimiter');
const {
    validateRegister,
    validateLogin,
    validateChangePassword,
    handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register',
    createAccountLimiter,
    validateRegister,
    handleValidationErrors,
    authController.register
);

router.post('/login',
    authLimiter,
    validateLogin,
    handleValidationErrors,
    authController.login
);

router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.use(protect); // All routes after this middleware are protected

router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.put('/change-password',
    validateChangePassword,
    handleValidationErrors,
    authController.changePassword
);

module.exports = router;