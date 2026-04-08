const { SavingsAccount, Transaction, SavingsGoal } = require('../models/SavingsAccount');
const { Activity } = require('../models/Activity');
const { asyncHandler } = require('../middleware/errorHandler');

// Get account details
exports.getAccountDetails = asyncHandler(async (req, res) => {
    const account = await SavingsAccount.findOne({ farmer: req.user.id });

    if (!account) {
        return res.status(404).json({
            success: false,
            message: 'Savings account not found'
        });
    }

    res.status(200).json({
        success: true,
        data: account
    });
});

// Deposit money
exports.deposit = asyncHandler(async (req, res) => {
    const { amount, description = 'Deposit', category = 'other', paymentMethod = 'cash' } = req.body;

    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (!account) {
        return res.status(404).json({
            success: false,
            message: 'Savings account not found'
        });
    }

    if (account.status !== 'active') {
        return res.status(400).json({
            success: false,
            message: 'Account is not active'
        });
    }

    // Create transaction
    const transaction = await Transaction.create({
        account: account._id,
        type: 'deposit',
        amount,
        description,
        category,
        paymentMethod
    });

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'deposit',
        'Money deposited',
        `Deposited $${amount}: ${description}`,
        {
            category: 'financial',
            amount
        }
    );

    res.status(201).json({
        success: true,
        message: 'Deposit successful',
        data: {
            transaction,
            newBalance: transaction.balanceAfter
        }
    });
});

// Withdraw money
exports.withdraw = asyncHandler(async (req, res) => {
    const { amount, description = 'Withdrawal', category = 'other', paymentMethod = 'cash' } = req.body;

    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (!account) {
        return res.status(404).json({
            success: false,
            message: 'Savings account not found'
        });
    }

    if (account.status !== 'active') {
        return res.status(400).json({
            success: false,
            message: 'Account is not active'
        });
    }

    if (amount > account.balance) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient balance'
        });
    }

    if (account.balance - amount < account.minimumBalance) {
        return res.status(400).json({
            success: false,
            message: `Withdrawal would result in balance below minimum required ($${account.minimumBalance})`
        });
    }

    // Create transaction
    const transaction = await Transaction.create({
        account: account._id,
        type: 'withdrawal',
        amount,
        description,
        category,
        paymentMethod
    });

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'withdrawal',
        'Money withdrawn',
        `Withdrew $${amount}: ${description}`,
        {
            category: 'financial',
            amount
        }
    );

    res.status(201).json({
        success: true,
        message: 'Withdrawal successful',
        data: {
            transaction,
            newBalance: transaction.balanceAfter
        }
    });
});

// Transfer money
exports.transfer = asyncHandler(async (req, res) => {
    const { recipientId, amount, description = 'Transfer' } = req.body;

    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (!account) {
        return res.status(404).json({
            success: false,
            message: 'Savings account not found'
        });
    }

    const recipientAccount = await SavingsAccount.findOne({ farmer: recipientId });
    if (!recipientAccount) {
        return res.status(404).json({
            success: false,
            message: 'Recipient account not found'
        });
    }

    if (account.status !== 'active' || recipientAccount.status !== 'active') {
        return res.status(400).json({
            success: false,
            message: 'One or both accounts are not active'
        });
    }

    if (amount > account.balance) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient balance'
        });
    }

    if (account.balance - amount < account.minimumBalance) {
        return res.status(400).json({
            success: false,
            message: `Transfer would result in balance below minimum required ($${account.minimumBalance})`
        });
    }

    // Create outgoing transaction
    const outgoingTransaction = await Transaction.create({
        account: account._id,
        type: 'transfer_out',
        amount,
        description: `Transfer to ${recipientAccount.farmer}`,
        category: 'other',
        relatedEntity: {
            entityType: 'user',
            entityId: recipientId
        }
    });

    // Create incoming transaction
    const incomingTransaction = await Transaction.create({
        account: recipientAccount._id,
        type: 'transfer_in',
        amount,
        description: `Transfer from ${account.farmer}`,
        category: 'other',
        relatedEntity: {
            entityType: 'user',
            entityId: req.user.id
        }
    });

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'transfer',
        'Money transferred',
        `Transferred $${amount} to another farmer`,
        {
            category: 'financial',
            amount
        }
    );

    res.status(201).json({
        success: true,
        message: 'Transfer successful',
        data: {
            outgoingTransaction,
            newBalance: outgoingTransaction.balanceAfter
        }
    });
});

// Get transaction history
exports.getTransactions = asyncHandler(async (req, res) => {
    const {
        type,
        category,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (!account) {
        return res.status(404).json({
            success: false,
            message: 'Savings account not found'
        });
    }

    // Build query
    const query = { account: account._id };

    if (type) {
        query.type = type;
    }

    if (category) {
        query.category = category;
    }

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const transactions = await Transaction.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
        success: true,
        data: transactions,
        pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
        }
    });
});

// Set savings goal
exports.setSavingsGoal = asyncHandler(async (req, res) => {
    const { title, description, targetAmount, targetDate, category, priority } = req.body;

    const goal = await SavingsGoal.create({
        farmer: req.user.id,
        title,
        description,
        targetAmount,
        targetDate,
        category,
        priority
    });

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'goal_created',
        'Savings goal created',
        `Created savings goal: ${title} ($${targetAmount})`,
        {
            category: 'financial',
            relatedEntity: {
                entityType: 'goal',
                entityId: goal._id,
                entityName: title
            },
            amount: targetAmount
        }
    );

    res.status(201).json({
        success: true,
        message: 'Savings goal created successfully',
        data: goal
    });
});

// Get savings goals
exports.getSavingsGoals = asyncHandler(async (req, res) => {
    const { status, category, page = 1, limit = 10 } = req.query;

    const query = { farmer: req.user.id };

    if (status) {
        query.status = status;
    }

    if (category) {
        query.category = category;
    }

    const skip = (page - 1) * limit;

    const goals = await SavingsGoal.find(query)
        .sort({ priority: 1, targetDate: 1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await SavingsGoal.countDocuments(query);

    res.status(200).json({
        success: true,
        data: goals,
        pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
        }
    });
});

// Update savings goal
exports.updateSavingsGoal = asyncHandler(async (req, res) => {
    const goal = await SavingsGoal.findOneAndUpdate(
        { _id: req.params.id, farmer: req.user.id },
        req.body,
        { new: true, runValidators: true }
    );

    if (!goal) {
        return res.status(404).json({
            success: false,
            message: 'Savings goal not found'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Savings goal updated successfully',
        data: goal
    });
});

// Contribute to savings goal
exports.contributeToGoal = asyncHandler(async (req, res) => {
    const { amount, note = '' } = req.body;
    const goalId = req.params.id;

    const goal = await SavingsGoal.findOne({ _id: goalId, farmer: req.user.id });
    if (!goal) {
        return res.status(404).json({
            success: false,
            message: 'Savings goal not found'
        });
    }

    if (goal.status !== 'active') {
        return res.status(400).json({
            success: false,
            message: 'Goal is not active'
        });
    }

    const account = await SavingsAccount.findOne({ farmer: req.user.id });
    if (!account || account.balance < amount) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient balance'
        });
    }

    // Create transaction
    await Transaction.create({
        account: account._id,
        type: 'withdrawal',
        amount,
        description: `Contribution to savings goal: ${goal.title}`,
        category: 'savings_goal',
        relatedEntity: {
            entityType: 'goal',
            entityId: goal._id,
            entityName: goal.title
        }
    });

    // Add contribution to goal
    await goal.addContribution(amount, 'manual', note);

    // Log activity
    await Activity.createActivity(
        req.user.id,
        'goal_contribution',
        'Goal contribution',
        `Contributed $${amount} to ${goal.title}`,
        {
            category: 'financial',
            relatedEntity: {
                entityType: 'goal',
                entityId: goal._id,
                entityName: goal.title
            },
            amount
        }
    );

    res.status(200).json({
        success: true,
        message: 'Contribution added successfully',
        data: goal
    });
});

// Delete savings goal
exports.deleteSavingsGoal = asyncHandler(async (req, res) => {
    const goal = await SavingsGoal.findOneAndUpdate(
        { _id: req.params.id, farmer: req.user.id },
        { status: 'cancelled' },
        { new: true }
    );

    if (!goal) {
        return res.status(404).json({
            success: false,
            message: 'Savings goal not found'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Savings goal cancelled successfully'
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

    // Get transaction summary for last 30 days
    const transactionSummary = await Transaction.aggregate([
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

    // Get spending by category
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

    // Get active goals
    const activeGoals = await SavingsGoal.find({
        farmer: req.user.id,
        status: 'active'
    }).limit(5);

    res.status(200).json({
        success: true,
        data: {
            account: {
                balance: account.balance,
                accountNumber: account.accountNumber,
                accountType: account.accountType,
                interestRate: account.interestRate
            },
            monthlyStats: transactionSummary,
            spendingByCategory,
            activeGoals: activeGoals.map(goal => ({
                id: goal._id,
                title: goal.title,
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                progressPercentage: goal.progressPercentage,
                daysRemaining: goal.daysRemaining
            }))
        }
    });
});