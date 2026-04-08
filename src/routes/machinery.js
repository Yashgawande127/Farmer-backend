const express = require('express');
const machineryController = require('../controllers/machineryController');
const { protect, logActivity } = require('../middleware/auth');
const {
    validateMachinery,
    validateMachineryRental,
    validateObjectId,
    validatePagination,
    handleValidationErrors
} = require('../middleware/validation');

const router = express.Router();

// All routes are protected
router.use(protect);

// Get available machinery and add personal machinery
router.route('/')
    .get(
        validatePagination,
        handleValidationErrors,
        machineryController.getMachinery
    );

// Get farmer's owned machinery
router.get('/my-equipment',
    validatePagination,
    handleValidationErrors,
    machineryController.getMyMachinery
);

// Add personal machinery
router.post('/add-personal',
    validateMachinery,
    handleValidationErrors,
    logActivity('machinery_purchase'),
    machineryController.addMachinery
);

// Get rental history
router.get('/rentals',
    validatePagination,
    handleValidationErrors,
    machineryController.getRentalHistory
);

// Get machinery categories
router.get('/categories', machineryController.getMachineryCategories);

// Get machinery statistics
router.get('/stats', machineryController.getMachineryStats);

// Operations on specific machinery
router.route('/:id')
    .put(
        validateObjectId,
        validateMachinery,
        handleValidationErrors,
        machineryController.updateMachinery
    )
    .delete(
        validateObjectId,
        handleValidationErrors,
        machineryController.deleteMachinery
    );

// Buy machinery
router.post('/:id/buy',
    validateObjectId,
    handleValidationErrors,
    logActivity('machinery_purchase'),
    machineryController.buyMachinery
);

// Rent machinery
router.post('/:id/rent',
    validateObjectId,
    validateMachineryRental,
    handleValidationErrors,
    logActivity('machinery_rental'),
    machineryController.rentMachinery
);

// Update machinery maintenance
router.put('/:id/maintenance',
    validateObjectId,
    handleValidationErrors,
    logActivity('machinery_maintenance'),
    machineryController.updateMaintenance
);

module.exports = router;