const Seed = require('../models/Seed');
const { Activity } = require('../models/Activity');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all seeds for the farmer
exports.getSeeds = asyncHandler(async (req, res) => {
    const { category, search, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 } = req.query;

    // Build query
    const query = { farmer: req.user.id, isActive: true };

    if (category) {
        query.category = category;
    }

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { variety: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const seeds = await Seed.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Seed.countDocuments(query);

    res.status(200).json({
        success: true,
        data: seeds,
        pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
        }
    });
});

// Get single seed
exports.getSeed = asyncHandler(async (req, res) => {
    const seed = await Seed.findOne({
        _id: req.params.id,
        farmer: req.user.id,
        isActive: true
    });

    if (!seed) {
        return res.status(404).json({
            success: false,
            message: 'Seed not found'
        });
    }

    res.status(200).json({
        success: true,
        data: seed
    });
});

// Add new seed
exports.addSeed = asyncHandler(async (req, res) => {
    const seedData = {
        ...req.body,
        farmer: req.user.id
    };

    const seed = await Seed.create(seedData);

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'seed_purchase',
        'New seed added',
        `Added ${seed.name} (${seed.variety}) to inventory`,
        {
            category: 'farming',
            relatedEntity: {
                entityType: 'seed',
                entityId: seed._id,
                entityName: seed.name
            },
            amount: seed.quantity * seed.pricePerUnit
        }
    );

    res.status(201).json({
        success: true,
        message: 'Seed added successfully',
        data: seed
    });
});

// Update seed
exports.updateSeed = asyncHandler(async (req, res) => {
    const seed = await Seed.findOneAndUpdate(
        { _id: req.params.id, farmer: req.user.id, isActive: true },
        req.body,
        { new: true, runValidators: true }
    );

    if (!seed) {
        return res.status(404).json({
            success: false,
            message: 'Seed not found'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Seed updated successfully',
        data: seed
    });
});

// Delete seed
exports.deleteSeed = asyncHandler(async (req, res) => {
    const seed = await Seed.findOneAndUpdate(
        { _id: req.params.id, farmer: req.user.id, isActive: true },
        { isActive: false },
        { new: true }
    );

    if (!seed) {
        return res.status(404).json({
            success: false,
            message: 'Seed not found'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Seed deleted successfully'
    });
});

// Sell seed
exports.sellSeed = asyncHandler(async (req, res) => {
    const { quantity, price, buyer } = req.body;

    const seed = await Seed.findOne({
        _id: req.params.id,
        farmer: req.user.id,
        isActive: true
    });

    if (!seed) {
        return res.status(404).json({
            success: false,
            message: 'Seed not found'
        });
    }

    if (quantity > seed.quantity) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient quantity available'
        });
    }

    // Update seed quantity
    seed.quantity -= quantity;

    // Add to sales history
    const saleRecord = {
        quantity,
        pricePerUnit: price,
        totalAmount: quantity * price,
        buyer,
        saleDate: new Date()
    };

    seed.salesHistory.push(saleRecord);
    await seed.save();

    // Create transaction record
    const { Transaction } = require('../models/SavingsAccount');
    const { SavingsAccount } = require('../models/SavingsAccount');

    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (account) {
        await Transaction.create({
            account: account._id,
            type: 'sale',
            amount: saleRecord.totalAmount,
            description: `Sale of ${seed.name} (${seed.variety})`,
            category: 'crop_sale',
            relatedEntity: {
                entityType: 'seed',
                entityId: seed._id,
                entityName: seed.name
            }
        });
    }

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'seed_sold',
        'Seed sold',
        `Sold ${quantity} units of ${seed.name} for $${saleRecord.totalAmount}`,
        {
            category: 'farming',
            relatedEntity: {
                entityType: 'seed',
                entityId: seed._id,
                entityName: seed.name
            },
            amount: saleRecord.totalAmount
        }
    );

    res.status(200).json({
        success: true,
        message: 'Seed sold successfully',
        data: {
            seed,
            saleRecord
        }
    });
});

// Plant seed (usage)
exports.plantSeed = asyncHandler(async (req, res) => {
    const { quantity, fieldLocation, plantingDate, expectedHarvestDate, notes } = req.body;

    const seed = await Seed.findOne({
        _id: req.params.id,
        farmer: req.user.id,
        isActive: true
    });

    if (!seed) {
        return res.status(404).json({
            success: false,
            message: 'Seed not found'
        });
    }

    if (quantity > seed.quantity) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient quantity available'
        });
    }

    // Update seed quantity
    seed.quantity -= quantity;

    // Add to usage history
    const usageRecord = {
        quantity,
        fieldLocation,
        plantingDate: plantingDate || new Date(),
        expectedHarvestDate,
        notes
    };

    seed.usageHistory.push(usageRecord);
    await seed.save();

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'seed_planted',
        'Seed planted',
        `Planted ${quantity} units of ${seed.name} in ${fieldLocation}`,
        {
            category: 'farming',
            relatedEntity: {
                entityType: 'seed',
                entityId: seed._id,
                entityName: seed.name
            },
            location: fieldLocation
        }
    );

    res.status(200).json({
        success: true,
        message: 'Seed planting recorded successfully',
        data: {
            seed,
            usageRecord
        }
    });
});

// Get seed categories
exports.getSeedCategories = asyncHandler(async (req, res) => {
    const categories = [
        { value: 'cereals', label: 'Cereals', description: 'Wheat, Rice, Corn, etc.' },
        { value: 'vegetables', label: 'Vegetables', description: 'Tomatoes, Onions, Carrots, etc.' },
        { value: 'fruits', label: 'Fruits', description: 'Apples, Oranges, Grapes, etc.' },
        { value: 'legumes', label: 'Legumes', description: 'Beans, Peas, Lentils, etc.' },
        { value: 'cash_crops', label: 'Cash Crops', description: 'Cotton, Tobacco, Coffee, etc.' },
        { value: 'fodder', label: 'Fodder', description: 'Alfalfa, Clover, Grass, etc.' },
        { value: 'flowers', label: 'Flowers', description: 'Roses, Marigolds, Sunflowers, etc.' }
    ];

    res.status(200).json({
        success: true,
        data: categories
    });
});

// Get seed statistics
exports.getSeedStats = asyncHandler(async (req, res) => {
    const stats = await Seed.aggregate([
        { $match: { farmer: req.user._id, isActive: true } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalQuantity: { $sum: '$quantity' },
                totalValue: { $sum: { $multiply: ['$quantity', '$pricePerUnit'] } },
                avgPrice: { $avg: '$pricePerUnit' }
            }
        },
        { $sort: { totalValue: -1 } }
    ]);

    const totalStats = await Seed.aggregate([
        { $match: { farmer: req.user._id, isActive: true } },
        {
            $group: {
                _id: null,
                totalSeeds: { $sum: 1 },
                totalQuantity: { $sum: '$quantity' },
                totalValue: { $sum: { $multiply: ['$quantity', '$pricePerUnit'] } },
                expiringThisMonth: {
                    $sum: {
                        $cond: [
                            {
                                $lte: [
                                    '$expiryDate',
                                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                ]
                            },
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
                totalSeeds: 0,
                totalQuantity: 0,
                totalValue: 0,
                expiringThisMonth: 0
            }
        }
    });
});