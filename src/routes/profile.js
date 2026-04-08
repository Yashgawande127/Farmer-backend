const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
    getProfile,
    updateProfile,
    updateProfileImage,
    updatePassword,
    updateNotificationPreferences,
    deleteAccount,
    getProfileStats
} = require('../controllers/profileController');

// Validation rules
const updateProfileValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('farmName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Farm name must be between 2 and 200 characters'),
    body('location')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Location must be between 2 and 100 characters'),
    body('phoneNumber')
        .optional()
        .matches(/^\+?[\d\s-()]+$/)
        .withMessage('Please provide a valid phone number'),
    body('farmSize')
        .optional()
        .isNumeric()
        .isFloat({ min: 0 })
        .withMessage('Farm size must be a positive number'),
    body('farmType')
        .optional()
        .isIn(['organic', 'conventional', 'mixed'])
        .withMessage('Farm type must be organic, conventional, or mixed')
];

const updatePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const deleteAccountValidation = [
    body('password')
        .notEmpty()
        .withMessage('Password is required to delete account')
];

// Routes

// @route   GET /api/profile
// @desc    Get current user profile
// @access  Private
router.get('/', protect, getProfile);

// @route   PUT /api/profile
// @desc    Update user profile
// @access  Private
router.put('/', protect, updateProfileValidation, updateProfile);

// @route   PUT /api/profile/image
// @desc    Update profile image
// @access  Private
router.put('/image', protect, updateProfileImage);

// @route   PUT /api/profile/password
// @desc    Update password
// @access  Private
router.put('/password', protect, updatePasswordValidation, updatePassword);

// @route   PUT /api/profile/notifications
// @desc    Update notification preferences
// @access  Private
router.put('/notifications', protect, updateNotificationPreferences);

// @route   DELETE /api/profile
// @desc    Delete user account
// @access  Private
router.delete('/', protect, deleteAccountValidation, deleteAccount);

// @route   GET /api/profile/stats
// @desc    Get profile statistics
// @access  Private
router.get('/stats', protect, getProfileStats);

module.exports = router;