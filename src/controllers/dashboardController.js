const { Activity } = require('../models/Activity');
const { SavingsAccount, Transaction } = require('../models/SavingsAccount');
const Seed = require('../models/Seed');
const { FertilizerInventory } = require('../models/Fertilizer');
const { Machinery } = require('../models/Machinery');
const { asyncHandler } = require('../middleware/errorHandler');

// Get dashboard overview data
exports.getDashboardData = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get account balance
    const account = await SavingsAccount.findOne({ farmer: userId });

    // Get recent activities
    const recentActivities = await Activity.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type title description createdAt amount');

    // Get inventory summary
    const seedsCount = await Seed.countDocuments({ farmer: userId, isActive: true });
    const fertilizersCount = await FertilizerInventory.countDocuments({ farmer: userId, isActive: true });
    const machineryCount = await Machinery.countDocuments({ owner: userId, isActive: true });

    // Get this month's transaction summary
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

    const monthlyTransactions = await Transaction.aggregate([
        {
            $match: {
                account: account?._id,
                createdAt: { $gte: startOfMonth, $lte: endOfMonth }
            }
        },
        {
            $group: {
                _id: '$type',
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    // Calculate monthly income and expenses
    let monthlyIncome = 0;
    let monthlyExpenses = 0;

    monthlyTransactions.forEach(transaction => {
        if (['deposit', 'transfer_in', 'sale'].includes(transaction._id)) {
            monthlyIncome += transaction.totalAmount;
        } else if (['withdrawal', 'transfer_out', 'purchase'].includes(transaction._id)) {
            monthlyExpenses += transaction.totalAmount;
        }
    });

    res.status(200).json({
        success: true,
        data: {
            user: {
                name: req.user.name,
                farmName: req.user.farmName,
                location: req.user.location
            },
            financialSummary: {
                balance: account?.balance || 0,
                monthlyIncome,
                monthlyExpenses,
                netIncome: monthlyIncome - monthlyExpenses
            },
            inventoryOverview: {
                seeds: seedsCount,
                fertilizers: fertilizersCount,
                machinery: machineryCount
            },
            recentActivities
        }
    });
});

// Get recent activities
exports.getRecentActivities = asyncHandler(async (req, res) => {
    const { limit = 10, category, type } = req.query;

    const query = { user: req.user.id };

    if (category) {
        query.category = category;
    }

    if (type) {
        query.type = type;
    }

    const activities = await Activity.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('type title description createdAt amount location category priority isRead');

    res.status(200).json({
        success: true,
        data: activities
    });
});

// Get financial summary
exports.getFinancialSummary = asyncHandler(async (req, res) => {
    const account = await SavingsAccount.findOne({ farmer: req.user.id });

    if (!account) {
        return res.status(404).json({
            success: false,
            message: 'Savings account not found'
        });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get transaction summaries
    const monthlyStats = await Transaction.aggregate([
        {
            $match: {
                account: account._id,
                createdAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: '$type',
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    const weeklyStats = await Transaction.aggregate([
        {
            $match: {
                account: account._id,
                createdAt: { $gte: sevenDaysAgo }
            }
        },
        {
            $group: {
                _id: '$type',
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    // Get spending by category (last 30 days)
    const spendingByCategory = await Transaction.aggregate([
        {
            $match: {
                account: account._id,
                type: { $in: ['withdrawal', 'purchase'] },
                createdAt: { $gte: thirtyDaysAgo }
            }
        },
        {
            $group: {
                _id: '$category',
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        { $sort: { totalAmount: -1 } }
    ]);

    res.status(200).json({
        success: true,
        data: {
            currentBalance: account.balance,
            accountType: account.accountType,
            interestRate: account.interestRate,
            monthlyStats,
            weeklyStats,
            spendingByCategory
        }
    });
});

// Get inventory overview
exports.getInventoryOverview = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Seeds overview
    const seedsStats = await Seed.aggregate([
        { $match: { farmer: userId, isActive: true } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalQuantity: { $sum: '$quantity' },
                totalValue: { $sum: { $multiply: ['$quantity', '$pricePerUnit'] } }
            }
        }
    ]);

    // Fertilizers overview
    const fertilizersStats = await FertilizerInventory.aggregate([
        { $match: { farmer: userId, isActive: true } },
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
                lowStock: {
                    $sum: {
                        $cond: [{ $lt: ['$quantityRemaining', 10] }, 1, 0]
                    }
                }
            }
        }
    ]);

    // Machinery overview
    const machineryStats = await Machinery.aggregate([
        { $match: { owner: userId, isActive: true } },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                totalValue: { $sum: '$currentValue' },
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

    // Get items requiring attention
    const lowStockSeeds = await Seed.find({
        farmer: userId,
        isActive: true,
        quantity: { $lt: 5 }
    }).select('name quantity');

    const expiringSoon = await Seed.find({
        farmer: userId,
        isActive: true,
        expiryDate: {
            $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
    }).select('name expiryDate');

    const maintenanceDue = await Machinery.find({
        owner: userId,
        isActive: true,
        'maintenance.nextServiceDate': { $lte: new Date() }
    }).select('name maintenance.nextServiceDate');

    res.status(200).json({
        success: true,
        data: {
            seeds: {
                stats: seedsStats,
                lowStock: lowStockSeeds,
                expiringSoon
            },
            fertilizers: {
                stats: fertilizersStats
            },
            machinery: {
                stats: machineryStats,
                maintenanceDue
            },
            alerts: {
                lowStockCount: lowStockSeeds.length,
                expiringSoonCount: expiringSoon.length,
                maintenanceDueCount: maintenanceDue.length
            }
        }
    });
});

// Get weather information (mock data for now)
exports.getWeatherInfo = asyncHandler(async (req, res) => {
    const { location } = req.query;

    // Mock weather data - in production, this would call a real weather API
    const mockWeatherData = {
        location: location || req.user.location,
        current: {
            temperature: 25,
            humidity: 65,
            windSpeed: 12,
            condition: 'Partly Cloudy',
            icon: 'partly-cloudy'
        },
        forecast: [
            {
                date: new Date().toISOString().split('T')[0],
                high: 28,
                low: 18,
                condition: 'Sunny',
                precipitation: 0
            },
            {
                date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                high: 26,
                low: 16,
                condition: 'Partly Cloudy',
                precipitation: 10
            },
            {
                date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                high: 24,
                low: 15,
                condition: 'Rainy',
                precipitation: 80
            }
        ],
        alerts: [
            {
                type: 'info',
                message: 'Good weather for field work today',
                severity: 'low'
            }
        ]
    };

    res.status(200).json({
        success: true,
        data: mockWeatherData
    });
});

// Get market prices (mock data for now)
exports.getMarketPrices = asyncHandler(async (req, res) => {
    // Mock market data - in production, this would call a real market data API
    const mockMarketData = {
        crops: [
            {
                name: 'Wheat',
                currentPrice: 250,
                unit: 'per quintal',
                change: +5.2,
                changePercent: +2.1,
                trend: 'up'
            },
            {
                name: 'Rice',
                currentPrice: 180,
                unit: 'per quintal',
                change: -3.5,
                changePercent: -1.9,
                trend: 'down'
            },
            {
                name: 'Corn',
                currentPrice: 200,
                unit: 'per quintal',
                change: +2.0,
                changePercent: +1.0,
                trend: 'up'
            },
            {
                name: 'Soybeans',
                currentPrice: 320,
                unit: 'per quintal',
                change: +8.5,
                changePercent: +2.7,
                trend: 'up'
            }
        ],
        lastUpdated: new Date().toISOString(),
        marketTrend: 'bullish'
    };

    res.status(200).json({
        success: true,
        data: mockMarketData
    });
});

// Mark activity as read
exports.markActivityAsRead = asyncHandler(async (req, res) => {
    const activityId = req.params.id;

    const activity = await Activity.findOneAndUpdate(
        { _id: activityId, user: req.user.id },
        { isRead: true },
        { new: true }
    );

    if (!activity) {
        return res.status(404).json({
            success: false,
            message: 'Activity not found'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Activity marked as read',
        data: activity
    });
});

// Get dashboard statistics
exports.getDashboardStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { period = '30' } = req.query; // days

    const periodStart = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);

    // Activity stats
    const activityStats = await Activity.aggregate([
        {
            $match: {
                user: userId,
                createdAt: { $gte: periodStart }
            }
        },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 }
            }
        }
    ]);

    // Transaction stats
    const account = await SavingsAccount.findOne({ farmer: userId });
    let transactionStats = [];

    if (account) {
        transactionStats = await Transaction.aggregate([
            {
                $match: {
                    account: account._id,
                    createdAt: { $gte: periodStart }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalIncome: {
                        $sum: {
                            $cond: [
                                { $in: ['$type', ['deposit', 'transfer_in', 'sale']] },
                                '$amount',
                                0
                            ]
                        }
                    },
                    totalExpenses: {
                        $sum: {
                            $cond: [
                                { $in: ['$type', ['withdrawal', 'transfer_out', 'purchase']] },
                                '$amount',
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
    }

    res.status(200).json({
        success: true,
        data: {
            activityStats,
            transactionStats,
            period: parseInt(period)
        }
    });
});