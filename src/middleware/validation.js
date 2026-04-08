const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Auth validation rules
exports.validateRegister = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('farmName')
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Farm name must be between 2 and 200 characters'),
    body('location')
        .trim()
        .isLength({ min: 2 })
        .withMessage('Location is required'),
    body('phoneNumber')
        .isMobilePhone()
        .withMessage('Please provide a valid phone number')
];

exports.validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

exports.validateChangePassword = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long')
];

// Seed validation rules
exports.validateSeed = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Seed name must be between 1 and 100 characters'),
    body('variety')
        .trim()
        .isLength({ min: 1 })
        .withMessage('Seed variety is required'),
    body('category')
        .isIn(['cereals', 'vegetables', 'fruits', 'legumes', 'cash_crops', 'fodder', 'flowers'])
        .withMessage('Invalid seed category'),
    body('quantity')
        .isFloat({ min: 0 })
        .withMessage('Quantity must be a positive number'),
    body('pricePerUnit')
        .isFloat({ min: 0 })
        .withMessage('Price per unit must be a positive number'),
    body('expiryDate')
        .isISO8601()
        .withMessage('Please provide a valid expiry date')
];

// Fertilizer validation rules
exports.validateFertilizerPurchase = [
    body('quantity')
        .isFloat({ min: 0.1 })
        .withMessage('Quantity must be greater than 0'),
    body('paymentMethod')
        .isIn(['cash', 'bank_transfer', 'mobile_payment', 'credit_card'])
        .withMessage('Invalid payment method')
];

exports.validateFertilizerUsage = [
    body('quantityUsed')
        .isFloat({ min: 0.1 })
        .withMessage('Quantity used must be greater than 0'),
    body('fieldLocation')
        .trim()
        .isLength({ min: 1 })
        .withMessage('Field location is required')
];

// Machinery validation rules
exports.validateMachinery = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 150 })
        .withMessage('Machinery name must be between 1 and 150 characters'),
    body('brand')
        .trim()
        .isLength({ min: 1 })
        .withMessage('Brand is required'),
    body('model')
        .trim()
        .isLength({ min: 1 })
        .withMessage('Model is required'),
    body('category')
        .isIn(['tractor', 'harvester', 'planter', 'cultivator', 'sprayer', 'irrigation', 'thresher', 'plow', 'harrow', 'mower', 'other'])
        .withMessage('Invalid machinery category'),
    body('type')
        .isIn(['owned', 'rental', 'for_sale'])
        .withMessage('Invalid machinery type'),
    body('condition')
        .isIn(['excellent', 'good', 'fair', 'poor'])
        .withMessage('Invalid condition')
];

exports.validateMachineryRental = [
    body('startDate')
        .isISO8601()
        .withMessage('Please provide a valid start date'),
    body('endDate')
        .isISO8601()
        .withMessage('Please provide a valid end date'),
    body('deliveryLocation.address')
        .trim()
        .isLength({ min: 5 })
        .withMessage('Delivery address is required')
];

// Savings validation rules
exports.validateDeposit = [
    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be greater than 0'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Description cannot exceed 200 characters')
];

exports.validateWithdrawal = [
    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be greater than 0'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Description cannot exceed 200 characters')
];

exports.validateTransfer = [
    body('recipientId')
        .isMongoId()
        .withMessage('Invalid recipient ID'),
    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be greater than 0'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Description cannot exceed 200 characters')
];

exports.validateSavingsGoal = [
    body('title')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Title must be between 1 and 100 characters'),
    body('targetAmount')
        .isFloat({ min: 1 })
        .withMessage('Target amount must be at least 1'),
    body('targetDate')
        .isISO8601()
        .withMessage('Please provide a valid target date')
];

// Parameter validation
exports.validateObjectId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ID format')
];

// Query validation
exports.validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

exports.validateDateRange = [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
];