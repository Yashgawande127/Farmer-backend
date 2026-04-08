const { Fertilizer, FertilizerInventory } = require('../models/Fertilizer');
const { Activity } = require('../models/Activity');
const { Transaction, SavingsAccount } = require('../models/SavingsAccount');
const { asyncHandler } = require('../middleware/errorHandler');

// Get available fertilizers for purchase
exports.getFertilizers = asyncHandler(async (req, res) => {
    const { category, type, search, sortBy = 'name', sortOrder = 'asc', page = 1, limit = 10 } = req.query;

    // Build query
    const query = { isAvailable: true };

    if (category) {
        query.category = category;
    }

    if (type) {
        query.type = type;
    }

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { brand: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const fertilizers = await Fertilizer.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Fertilizer.countDocuments(query);

    res.status(200).json({
        success: true,
        data: fertilizers,
        pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
        }
    });
});

// Get farmer's fertilizer inventory
exports.getMyFertilizers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status = 'active' } = req.query;

    const query = { farmer: req.user.id };
    if (status === 'active') {
        query.isActive = true;
        query.quantityRemaining = { $gt: 0 };
    }

    const skip = (page - 1) * limit;

    const inventory = await FertilizerInventory.find(query)
        .populate('fertilizer', 'name brand category type composition')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await FertilizerInventory.countDocuments(query);

    res.status(200).json({
        success: true,
        data: inventory,
        pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
        }
    });
});

// Purchase fertilizer
exports.buyFertilizer = asyncHandler(async (req, res) => {
    const { quantity, paymentMethod = 'cash', supplier, expiryDate } = req.body;
    const fertilizerId = req.params.id;

    const fertilizer = await Fertilizer.findById(fertilizerId);
    if (!fertilizer) {
        return res.status(404).json({
            success: false,
            message: 'Fertilizer not found'
        });
    }

    if (!fertilizer.isAvailable) {
        return res.status(400).json({
            success: false,
            message: 'Fertilizer is not available for purchase'
        });
    }

    if (quantity > fertilizer.quantityAvailable) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient quantity available'
        });
    }

    const totalCost = quantity * fertilizer.pricePerUnit;

    // Check if user has sufficient balance
    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (!account || account.balance < totalCost) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient balance in savings account'
        });
    }

    // Create inventory record
    const inventoryData = {
        farmer: req.user.id,
        fertilizer: fertilizerId,
        quantityPurchased: quantity,
        quantityRemaining: quantity,
        purchasePrice: totalCost,
        expiryDate: expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
        supplier: supplier || fertilizer.manufacturer
    };

    const inventory = await FertilizerInventory.create(inventoryData);

    // Update fertilizer stock
    fertilizer.quantityAvailable -= quantity;
    await fertilizer.save();

    // Create transaction
    await Transaction.create({
        account: account._id,
        type: 'purchase',
        amount: totalCost,
        description: `Purchase of ${fertilizer.name}`,
        category: 'fertilizers',
        paymentMethod,
        relatedEntity: {
            entityType: 'fertilizer',
            entityId: inventory._id,
            entityName: fertilizer.name
        }
    });

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'fertilizer_purchase',
        'Fertilizer purchased',
        `Purchased ${quantity} ${fertilizer.unit} of ${fertilizer.name}`,
        {
            category: 'farming',
            relatedEntity: {
                entityType: 'fertilizer',
                entityId: inventory._id,
                entityName: fertilizer.name
            },
            amount: totalCost
        }
    );

    await inventory.populate('fertilizer', 'name brand category type');

    res.status(201).json({
        success: true,
        message: 'Fertilizer purchased successfully',
        data: inventory
    });
});

// Use fertilizer from inventory
exports.useFertilizer = asyncHandler(async (req, res) => {
    const { quantityUsed, fieldLocation, cropType, applicationMethod, notes } = req.body;
    const inventoryId = req.params.inventoryId;

    const inventory = await FertilizerInventory.findOne({
        _id: inventoryId,
        farmer: req.user.id,
        isActive: true
    }).populate('fertilizer', 'name brand');

    if (!inventory) {
        return res.status(404).json({
            success: false,
            message: 'Fertilizer inventory not found'
        });
    }

    if (quantityUsed > inventory.quantityRemaining) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient quantity available in inventory'
        });
    }

    // Use fertilizer
    const usageRecord = {
        quantityUsed,
        fieldLocation,
        cropType,
        applicationMethod,
        notes
    };

    await inventory.useFertilizer(quantityUsed, fieldLocation, usageRecord);

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'fertilizer_applied',
        'Fertilizer applied',
        `Applied ${quantityUsed} units of ${inventory.fertilizer.name} in ${fieldLocation}`,
        {
            category: 'farming',
            relatedEntity: {
                entityType: 'fertilizer',
                entityId: inventory._id,
                entityName: inventory.fertilizer.name
            },
            location: fieldLocation
        }
    );

    res.status(200).json({
        success: true,
        message: 'Fertilizer usage recorded successfully',
        data: inventory
    });
});

// Get fertilizer usage history
exports.getUsageHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, startDate, endDate } = req.query;

    const query = { farmer: req.user.id };

    if (startDate || endDate) {
        query['usageHistory.applicationDate'] = {};
        if (startDate) query['usageHistory.applicationDate'].$gte = new Date(startDate);
        if (endDate) query['usageHistory.applicationDate'].$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const usageHistory = await FertilizerInventory.aggregate([
        { $match: query },
        { $unwind: '$usageHistory' },
        {
            $lookup: {
                from: 'fertilizers',
                localField: 'fertilizer',
                foreignField: '_id',
                as: 'fertilizerInfo'
            }
        },
        { $unwind: '$fertilizerInfo' },
        {
            $project: {
                usage: '$usageHistory',
                fertilizer: {
                    name: '$fertilizerInfo.name',
                    brand: '$fertilizerInfo.brand',
                    category: '$fertilizerInfo.category'
                },
                purchaseDate: 1
            }
        },
        { $sort: { 'usage.applicationDate': -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
    ]);

    res.status(200).json({
        success: true,
        data: usageHistory
    });
});

// Get fertilizer recommendations
exports.getRecommendations = asyncHandler(async (req, res) => {
    const { crop, soil } = req.query;

    let query = { isAvailable: true };

    if (crop) {
        query.suitableCrops = { $in: [crop] };
    }

    if (soil) {
        query.soilTypes = { $in: [soil] };
    }

    const recommendations = await Fertilizer.find(query)
        .sort({ 'ratings.average': -1, 'ratings.count': -1 })
        .limit(10)
        .select('name brand category composition applicationRate pricePerUnit ratings reviews');

    res.status(200).json({
        success: true,
        data: recommendations
    });
});

// Get fertilizer categories
exports.getFertilizerCategories = asyncHandler(async (req, res) => {
    const categories = [
        { value: 'nitrogen', label: 'Nitrogen', description: 'High nitrogen content fertilizers' },
        { value: 'phosphorus', label: 'Phosphorus', description: 'High phosphorus content fertilizers' },
        { value: 'potassium', label: 'Potassium', description: 'High potassium content fertilizers' },
        { value: 'compound', label: 'Compound', description: 'Multi-nutrient fertilizers' },
        { value: 'micronutrient', label: 'Micronutrient', description: 'Trace element fertilizers' },
        { value: 'organic_compost', label: 'Organic Compost', description: 'Organic and compost fertilizers' }
    ];

    res.status(200).json({
        success: true,
        data: categories
    });
});

// Add fertilizer review
exports.addFertilizerReview = asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    const fertilizerId = req.params.id;

    const fertilizer = await Fertilizer.findById(fertilizerId);
    if (!fertilizer) {
        return res.status(404).json({
            success: false,
            message: 'Fertilizer not found'
        });
    }

    // Check if user has already reviewed this fertilizer
    const existingReview = fertilizer.reviews.find(
        review => review.user.toString() === req.user.id
    );

    if (existingReview) {
        // Update existing review
        existingReview.rating = rating;
        existingReview.comment = comment;
        existingReview.createdAt = new Date();
    } else {
        // Add new review
        fertilizer.reviews.push({
            user: req.user.id,
            rating,
            comment
        });
    }

    await fertilizer.save();

    res.status(200).json({
        success: true,
        message: 'Review added successfully',
        data: fertilizer.reviews
    });
});

// Get fertilizer inventory statistics
exports.getInventoryStats = asyncHandler(async (req, res) => {
    const stats = await FertilizerInventory.aggregate([
        { $match: { farmer: req.user._id, isActive: true } },
        {
            $lookup: {
                from: 'fertilizers',
                localField: 'fertilizer',
                foreignField: '_id',
                as: 'fertilizerInfo'
            }
        },
        { $unwind: '$fertilizerInfo' },
        {
            $group: {
                _id: '$fertilizerInfo.category',
                count: { $sum: 1 },
                totalQuantity: { $sum: '$quantityRemaining' },
                totalValue: { $sum: { $multiply: ['$quantityRemaining', '$fertilizerInfo.pricePerUnit'] } },
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
        },
        { $sort: { totalValue: -1 } }
    ]);

    const totalStats = await FertilizerInventory.aggregate([
        { $match: { farmer: req.user._id, isActive: true } },
        {
            $lookup: {
                from: 'fertilizers',
                localField: 'fertilizer',
                foreignField: '_id',
                as: 'fertilizerInfo'
            }
        },
        { $unwind: '$fertilizerInfo' },
        {
            $group: {
                _id: null,
                totalItems: { $sum: 1 },
                totalQuantity: { $sum: '$quantityRemaining' },
                totalValue: { $sum: { $multiply: ['$quantityRemaining', '$fertilizerInfo.pricePerUnit'] } },
                lowStockItems: {
                    $sum: {
                        $cond: [
                            { $lt: ['$quantityRemaining', 10] },
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
                totalItems: 0,
                totalQuantity: 0,
                totalValue: 0,
                lowStockItems: 0
            }
        }
    });
});