const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const {
    validatePagination,
    validateObjectId,
    handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// All routes are protected
router.use(protect);

// Main dashboard data
router.get('/', dashboardController.getDashboardData);

// Dashboard sections
router.get('/activities',
    validatePagination,
    handleValidationErrors,
    dashboardController.getRecentActivities
);

router.get('/financial-summary', dashboardController.getFinancialSummary);

router.get('/inventory-overview', dashboardController.getInventoryOverview);

router.get('/weather', dashboardController.getWeatherInfo);

router.get('/market-prices', dashboardController.getMarketPrices);

router.get('/stats', dashboardController.getDashboardStats);

// Mark activity as read
router.put('/activities/:id/read',
    validateObjectId,
    handleValidationErrors,
    dashboardController.markActivityAsRead
);

module.exports = router;