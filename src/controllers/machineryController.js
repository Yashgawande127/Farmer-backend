const { Machinery, MachineryRental } = require('../models/Machinery');
const { Activity } = require('../models/Activity');
const { Transaction, SavingsAccount } = require('../models/SavingsAccount');
const { asyncHandler } = require('../middleware/errorHandler');

// Get available machinery for purchase/rent
exports.getMachinery = asyncHandler(async (req, res) => {
    const { category, type, condition, search, sortBy = 'name', sortOrder = 'asc', page = 1, limit = 10 } = req.query;

    // Build query
    const query = { isActive: true, 'availability.isAvailable': true };

    if (category) {
        query.category = category;
    }

    if (type) {
        query.type = type;
    }

    if (condition) {
        query.condition = condition;
    }

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { model: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const machinery = await Machinery.find(query)
        .populate('owner', 'name farmName location phoneNumber')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Machinery.countDocuments(query);

    res.status(200).json({
        success: true,
        data: machinery,
        pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
        }
    });
});

// Get farmer's owned machinery
exports.getMyMachinery = asyncHandler(async (req, res) => {
    const { category, type, page = 1, limit = 10 } = req.query;

    const query = { owner: req.user.id, isActive: true };

    if (category) {
        query.category = category;
    }

    if (type) {
        query.type = type;
    }

    const skip = (page - 1) * limit;

    const machinery = await Machinery.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Machinery.countDocuments(query);

    res.status(200).json({
        success: true,
        data: machinery,
        pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
        }
    });
});

// Add personal machinery to inventory
exports.addMachinery = asyncHandler(async (req, res) => {
    const machineryData = {
        ...req.body,
        owner: req.user.id
    };

    const machinery = await Machinery.create(machineryData);

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'machinery_purchase',
        'Machinery added',
        `Added ${machinery.name} (${machinery.brand} ${machinery.model}) to inventory`,
        {
            category: 'equipment',
            relatedEntity: {
                entityType: 'machinery',
                entityId: machinery._id,
                entityName: machinery.name
            },
            amount: machinery.purchasePrice
        }
    );

    res.status(201).json({
        success: true,
        message: 'Machinery added successfully',
        data: machinery
    });
});

// Update machinery
exports.updateMachinery = asyncHandler(async (req, res) => {
    const machinery = await Machinery.findOneAndUpdate(
        { _id: req.params.id, owner: req.user.id, isActive: true },
        req.body,
        { new: true, runValidators: true }
    );

    if (!machinery) {
        return res.status(404).json({
            success: false,
            message: 'Machinery not found'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Machinery updated successfully',
        data: machinery
    });
});

// Delete machinery
exports.deleteMachinery = asyncHandler(async (req, res) => {
    const machinery = await Machinery.findOneAndUpdate(
        { _id: req.params.id, owner: req.user.id, isActive: true },
        { isActive: false },
        { new: true }
    );

    if (!machinery) {
        return res.status(404).json({
            success: false,
            message: 'Machinery not found'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Machinery deleted successfully'
    });
});

// Buy machinery
exports.buyMachinery = asyncHandler(async (req, res) => {
    const { paymentMethod = 'cash' } = req.body;
    const machineryId = req.params.id;

    const machinery = await Machinery.findById(machineryId).populate('owner', 'name');

    if (!machinery) {
        return res.status(404).json({
            success: false,
            message: 'Machinery not found'
        });
    }

    if (machinery.type !== 'for_sale') {
        return res.status(400).json({
            success: false,
            message: 'This machinery is not for sale'
        });
    }

    if (!machinery.availability.isAvailable) {
        return res.status(400).json({
            success: false,
            message: 'Machinery is not available for purchase'
        });
    }

    if (machinery.owner._id.toString() === req.user.id) {
        return res.status(400).json({
            success: false,
            message: 'You cannot buy your own machinery'
        });
    }

    const totalCost = machinery.currentValue || machinery.purchasePrice;

    // Check if user has sufficient balance
    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (!account || account.balance < totalCost) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient balance in savings account'
        });
    }

    // Transfer ownership
    machinery.owner = req.user.id;
    machinery.type = 'owned';
    machinery.availability.isAvailable = false;
    machinery.purchasePrice = totalCost;
    await machinery.save();

    // Create transaction for buyer
    await Transaction.create({
        account: account._id,
        type: 'purchase',
        amount: totalCost,
        description: `Purchase of ${machinery.name}`,
        category: 'equipment',
        paymentMethod,
        relatedEntity: {
            entityType: 'machinery',
            entityId: machinery._id,
            entityName: machinery.name
        }
    });

    // Create transaction for seller
    const sellerAccount = await SavingsAccount.findOne({ farmer: machinery.owner });
    if (sellerAccount) {
        await Transaction.create({
            account: sellerAccount._id,
            type: 'sale',
            amount: totalCost,
            description: `Sale of ${machinery.name}`,
            category: 'equipment',
            relatedEntity: {
                entityType: 'machinery',
                entityId: machinery._id,
                entityName: machinery.name
            }
        });
    }

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'machinery_purchase',
        'Machinery purchased',
        `Purchased ${machinery.name} for $${totalCost}`,
        {
            category: 'equipment',
            relatedEntity: {
                entityType: 'machinery',
                entityId: machinery._id,
                entityName: machinery.name
            },
            amount: totalCost
        }
    );

    res.status(200).json({
        success: true,
        message: 'Machinery purchased successfully',
        data: machinery
    });
});

// Rent machinery
exports.rentMachinery = asyncHandler(async (req, res) => {
    const { startDate, endDate, paymentMethod = 'cash', deliveryLocation, terms } = req.body;
    const machineryId = req.params.id;

    const machinery = await Machinery.findById(machineryId).populate('owner', 'name phoneNumber');

    if (!machinery) {
        return res.status(404).json({
            success: false,
            message: 'Machinery not found'
        });
    }

    if (machinery.type !== 'rental') {
        return res.status(400).json({
            success: false,
            message: 'This machinery is not available for rental'
        });
    }

    if (!machinery.availability.isAvailable) {
        return res.status(400).json({
            success: false,
            message: 'Machinery is not available for rental'
        });
    }

    if (machinery.owner._id.toString() === req.user.id) {
        return res.status(400).json({
            success: false,
            message: 'You cannot rent your own machinery'
        });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    let totalCost = 0;
    if (machinery.rentalPrice.daily) {
        totalCost = machinery.rentalPrice.daily * durationDays;
    } else if (machinery.rentalPrice.weekly) {
        totalCost = machinery.rentalPrice.weekly * Math.ceil(durationDays / 7);
    } else if (machinery.rentalPrice.monthly) {
        totalCost = machinery.rentalPrice.monthly * Math.ceil(durationDays / 30);
    }

    // Check if user has sufficient balance
    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (!account || account.balance < totalCost) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient balance in savings account'
        });
    }

    // Create rental record
    const rental = await MachineryRental.create({
        machinery: machineryId,
        renter: req.user.id,
        owner: machinery.owner._id,
        startDate: start,
        endDate: end,
        totalCost,
        paymentMethod,
        deliveryLocation,
        terms,
        status: 'confirmed'
    });

    // Create transaction
    await Transaction.create({
        account: account._id,
        type: 'purchase',
        amount: totalCost,
        description: `Rental of ${machinery.name}`,
        category: 'equipment',
        paymentMethod,
        relatedEntity: {
            entityType: 'machinery',
            entityId: rental._id,
            entityName: machinery.name
        }
    });

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'machinery_rental',
        'Machinery rented',
        `Rented ${machinery.name} for ${durationDays} days`,
        {
            category: 'equipment',
            relatedEntity: {
                entityType: 'machinery',
                entityId: rental._id,
                entityName: machinery.name
            },
            amount: totalCost
        }
    );

    await rental.populate(['machinery', 'owner']);

    res.status(201).json({
        success: true,
        message: 'Machinery rented successfully',
        data: rental
    });
});

// Get rental history
exports.getRentalHistory = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { renter: req.user.id };
    if (status) {
        query.status = status;
    }

    const skip = (page - 1) * limit;

    const rentals = await MachineryRental.find(query)
        .populate('machinery', 'name brand model category')
        .populate('owner', 'name farmName phoneNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await MachineryRental.countDocuments(query);

    res.status(200).json({
        success: true,
        data: rentals,
        pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
        }
    });
});

// Get machinery categories
exports.getMachineryCategories = asyncHandler(async (req, res) => {
    const categories = [
        { value: 'tractor', label: 'Tractor', description: 'Agricultural tractors' },
        { value: 'harvester', label: 'Harvester', description: 'Crop harvesting machines' },
        { value: 'planter', label: 'Planter', description: 'Seed planting equipment' },
        { value: 'cultivator', label: 'Cultivator', description: 'Soil cultivation tools' },
        { value: 'sprayer', label: 'Sprayer', description: 'Chemical application equipment' },
        { value: 'irrigation', label: 'Irrigation', description: 'Water management systems' },
        { value: 'thresher', label: 'Thresher', description: 'Grain threshing machines' },
        { value: 'plow', label: 'Plow', description: 'Soil turning equipment' },
        { value: 'harrow', label: 'Harrow', description: 'Soil preparation tools' },
        { value: 'mower', label: 'Mower', description: 'Grass and crop cutting machines' },
        { value: 'other', label: 'Other', description: 'Other agricultural equipment' }
    ];

    res.status(200).json({
        success: true,
        data: categories
    });
});

// Update machinery maintenance
exports.updateMaintenance = asyncHandler(async (req, res) => {
    const { lastServiceDate, nextServiceDate, operatingHours, notes } = req.body;

    const machinery = await Machinery.findOneAndUpdate(
        { _id: req.params.id, owner: req.user.id, isActive: true },
        {
            $set: {
                'maintenance.lastServiceDate': lastServiceDate,
                'maintenance.nextServiceDate': nextServiceDate,
                'maintenance.totalOperatingHours': operatingHours
            }
        },
        { new: true, runValidators: true }
    );

    if (!machinery) {
        return res.status(404).json({
            success: false,
            message: 'Machinery not found'
        });
    }

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'machinery_maintenance',
        'Machinery maintenance updated',
        `Updated maintenance record for ${machinery.name}`,
        {
            category: 'equipment',
            relatedEntity: {
                entityType: 'machinery',
                entityId: machinery._id,
                entityName: machinery.name
            }
        }
    );

    res.status(200).json({
        success: true,
        message: 'Maintenance record updated successfully',
        data: machinery
    });
});

// Get machinery statistics
exports.getMachineryStats = asyncHandler(async (req, res) => {
    const stats = await Machinery.aggregate([
        { $match: { owner: req.user._id, isActive: true } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalValue: { $sum: '$currentValue' },
                avgAge: { $avg: { $subtract: [new Date().getFullYear(), '$manufacturingYear'] } },
                needsMaintenance: {
                    $sum: {
                        $cond: [
                            { $lte: ['$maintenance.nextServiceDate', new Date()] },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        { $sort: { totalValue: -1 } }
    ]);

    const totalStats = await Machinery.aggregate([
        { $match: { owner: req.user._id, isActive: true } },
        {
            $group: {
                _id: null,
                totalMachinery: { $sum: 1 },
                totalValue: { $sum: '$currentValue' },
                avgAge: { $avg: { $subtract: [new Date().getFullYear(), '$manufacturingYear'] } },
                needsMaintenance: {
                    $sum: {
                        $cond: [
                            { $lte: ['$maintenance.nextServiceDate', new Date()] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: {
            categoryStats: stats,
            totalStats: totalStats[0] || {
                totalMachinery: 0,
                totalValue: 0,
                avgAge: 0,
                needsMaintenance: 0
            }
        }
    });
});