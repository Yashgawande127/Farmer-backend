const express = require('express');
const seedsController = require('../controllers/seedsController');
const { protect, logActivity } = require('../middleware/auth');
const {
    validateSeed,
    validateObjectId,
    validatePagination,
    handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// All routes are protected
router.use(protect);

// Get all seeds and add new seed
router.route('/')
    .get(
        validatePagination,
        handleValidationErrors,
        seedsController.getSeeds
    )
    .post(
        validateSeed,
        handleValidationErrors,
        logActivity('seed_purchase'),
        seedsController.addSeed
    );

// Get seed categories
router.get('/categories', seedsController.getSeedCategories);

// Get seed statistics
router.get('/stats', seedsController.getSeedStats);

// Operations on specific seed
router.route('/:id')
    .get(
        validateObjectId,
        handleValidationErrors,
        seedsController.getSeed
    )
    .put(
        validateObjectId,
        validateSeed,
        handleValidationErrors,
        seedsController.updateSeed
    )
    .delete(
        validateObjectId,
        handleValidationErrors,
        seedsController.deleteSeed
    );

// Sell seed
router.post('/:id/sell',
    validateObjectId,
    handleValidationErrors,
    logActivity('seed_sold'),
    seedsController.sellSeed
);

// Plant seed (record usage)
router.post('/:id/plant',
    validateObjectId,
    handleValidationErrors,
    logActivity('seed_planted'),
    seedsController.plantSeed
);

module.exports = router;