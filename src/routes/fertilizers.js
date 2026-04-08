const express = require('express');
const fertilizersController = require('../controllers/fertilizersController');
const { protect, logActivity } = require('../middleware/auth');
const {
    validateFertilizerPurchase,
    validateFertilizerUsage,
    validateObjectId,
    validatePagination,
    handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// All routes are protected
router.use(protect);

// Get available fertilizers for purchase
router.get('/',
    validatePagination,
    handleValidationErrors,
    fertilizersController.getFertilizers
);

// Get farmer's fertilizer inventory
router.get('/my-inventory',
    validatePagination,
    handleValidationErrors,
    fertilizersController.getMyFertilizers
);

// Get fertilizer usage history
router.get('/usage-history',
    validatePagination,
    handleValidationErrors,
    fertilizersController.getUsageHistory
);

// Get fertilizer recommendations
router.get('/recommendations', fertilizersController.getRecommendations);

// Get fertilizer categories
router.get('/categories', fertilizersController.getFertilizerCategories);

// Get inventory statistics
router.get('/inventory/stats', fertilizersController.getInventoryStats);

// Purchase fertilizer
router.post('/:id/buy',
    validateObjectId,
    validateFertilizerPurchase,
    handleValidationErrors,
    logActivity('fertilizer_purchase'),
    fertilizersController.buyFertilizer
);

// Add fertilizer review
router.post('/:id/review',
    validateObjectId,
    handleValidationErrors,
    fertilizersController.addFertilizerReview
);

// Use fertilizer from inventory
router.post('/inventory/:inventoryId/use',
    validateObjectId,
    validateFertilizerUsage,
    handleValidationErrors,
    logActivity('fertilizer_applied'),
    fertilizersController.useFertilizer
);

module.exports = router;