const express = require('express');
const savingsController = require('../controllers/savingsController');
const { protect, logActivity } = require('../middleware/auth');
const {
    validateDeposit,
    validateWithdrawal,
    validateTransfer,
    validateSavingsGoal,
    validateObjectId,
    validatePagination,
    validateDateRange,
    handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// All routes are protected
router.use(protect);

// Account operations
router.get('/account', savingsController.getAccountDetails);

router.post('/deposit',
    validateDeposit,
    handleValidationErrors,
    logActivity('deposit'),
    savingsController.deposit
);

router.post('/withdraw',
    validateWithdrawal,
    handleValidationErrors,
    logActivity('withdrawal'),
    savingsController.withdraw
);

router.post('/transfer',
    validateTransfer,
    handleValidationErrors,
    logActivity('transfer'),
    savingsController.transfer
);

// Transaction history
router.get('/transactions',
    validatePagination,
    validateDateRange,
    handleValidationErrors,
    savingsController.getTransactions
);

// Financial summary
router.get('/financial-summary', savingsController.getFinancialSummary);

// Savings goals
router.route('/goals')
    .get(
        validatePagination,
        handleValidationErrors,
        savingsController.getSavingsGoals
    )
    .post(
        validateSavingsGoal,
        handleValidationErrors,
        logActivity('goal_created'),
        savingsController.setSavingsGoal
    );

router.route('/goals/:id')
    .put(
        validateObjectId,
        validateSavingsGoal,
        handleValidationErrors,
        savingsController.updateSavingsGoal
    )
    .delete(
        validateObjectId,
        handleValidationErrors,
        savingsController.deleteSavingsGoal
    );

router.post('/goals/:id/contribute',
    validateObjectId,
    validateDeposit,
    handleValidationErrors,
    logActivity('goal_contribution'),
    savingsController.contributeToGoal
);

module.exports = router;