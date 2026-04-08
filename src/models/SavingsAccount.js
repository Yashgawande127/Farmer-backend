const mongoose = require('mongoose');

const savingsAccountSchema = new mongoose.Schema({
    farmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true,
        default: function () {
            return 'FA' + Date.now() + Math.floor(Math.random() * 1000);
        }
    },
    balance: {
        type: Number,
        required: true,
        default: 0,
        min: [0, 'Balance cannot be negative']
    },
    interestRate: {
        type: Number,
        default: 2.5, // Annual interest rate percentage
        min: [0, 'Interest rate cannot be negative'],
        max: [20, 'Interest rate seems too high']
    },
    accountType: {
        type: String,
        enum: ['basic', 'premium', 'business'],
        default: 'basic'
    },
    status: {
        type: String,
        enum: ['active', 'frozen', 'closed'],
        default: 'active'
    },
    minimumBalance: {
        type: Number,
        default: 100
    },
    lastInterestCalculation: {
        type: Date,
        default: Date.now
    },
    totalInterestEarned: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const transactionSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SavingsAccount',
        required: true
    },
    transactionId: {
        type: String,
        required: true,
        unique: true,
        default: function () {
            return 'TXN' + Date.now() + Math.floor(Math.random() * 10000);
        }
    },
    type: {
        type: String,
        required: true,
        enum: ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'interest', 'fee', 'purchase', 'sale']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be greater than 0']
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },
    category: {
        type: String,
        enum: [
            'farming_supplies', 'equipment', 'seeds', 'fertilizers', 'pesticides',
            'fuel', 'labor', 'transport', 'insurance', 'taxes', 'loan_payment',
            'crop_sale', 'livestock_sale', 'other_income', 'personal', 'savings_goal', 'other'
        ],
        default: 'other'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'mobile_payment', 'check', 'card'],
        default: 'cash'
    },
    relatedEntity: {
        entityType: {
            type: String,
            enum: ['seed', 'fertilizer', 'machinery', 'user', 'goal']
        },
        entityId: mongoose.Schema.Types.ObjectId,
        entityName: String
    },
    location: {
        type: String,
        trim: true
    },
    receiptNumber: {
        type: String,
        trim: true
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringDetails: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
        },
        nextDate: Date,
        endDate: Date
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'completed'
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        deviceId: String
    }
}, {
    timestamps: true
});

const savingsGoalSchema = new mongoose.Schema({
    farmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: [true, 'Goal title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    targetAmount: {
        type: Number,
        required: [true, 'Target amount is required'],
        min: [1, 'Target amount must be at least 1']
    },
    currentAmount: {
        type: Number,
        default: 0,
        min: [0, 'Current amount cannot be negative']
    },
    targetDate: {
        type: Date,
        required: [true, 'Target date is required']
    },
    category: {
        type: String,
        enum: [
            'equipment_purchase', 'land_purchase', 'emergency_fund', 'crop_investment',
            'education', 'home_improvement', 'debt_repayment', 'retirement', 'other'
        ],
        default: 'other'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    autoContribution: {
        enabled: { type: Boolean, default: false },
        amount: { type: Number, min: 0 },
        frequency: {
            type: String,
            enum: ['weekly', 'monthly', 'quarterly']
        },
        nextContributionDate: Date
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'paused', 'cancelled'],
        default: 'active'
    },
    achievements: [{
        milestone: { type: Number, required: true }, // percentage achieved
        date: { type: Date, default: Date.now },
        amount: Number
    }],
    contributions: [{
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        source: {
            type: String,
            enum: ['manual', 'auto', 'transfer'],
            default: 'manual'
        },
        note: String
    }]
}, {
    timestamps: true
});

// Virtual for progress percentage
savingsGoalSchema.virtual('progressPercentage').get(function () {
    return this.targetAmount > 0 ? (this.currentAmount / this.targetAmount) * 100 : 0;
});

// Virtual for days remaining
savingsGoalSchema.virtual('daysRemaining').get(function () {
    const today = new Date();
    const target = new Date(this.targetDate);
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance method to add contribution to goal
savingsGoalSchema.methods.addContribution = function (amount, source = 'manual', note = '') {
    this.currentAmount += amount;
    this.contributions.push({
        amount,
        source,
        note
    });

    // Check for milestone achievements
    const progressPercentage = this.progressPercentage;
    const milestones = [25, 50, 75, 100];

    milestones.forEach(milestone => {
        const hasAchievement = this.achievements.some(a => a.milestone === milestone);
        if (!hasAchievement && progressPercentage >= milestone) {
            this.achievements.push({
                milestone,
                amount: this.currentAmount
            });
        }
    });

    // Mark as completed if target reached
    if (this.currentAmount >= this.targetAmount) {
        this.status = 'completed';
    }

    return this.save();
};

// Pre-save middleware for transaction to update account balance
transactionSchema.pre('save', async function (next) {
    if (this.isNew) {
        try {
            const SavingsAccount = mongoose.model('SavingsAccount');
            const account = await SavingsAccount.findById(this.account);

            if (!account) {
                return next(new Error('Account not found'));
            }

            let newBalance = account.balance;

            if (['deposit', 'transfer_in', 'interest', 'sale'].includes(this.type)) {
                newBalance += this.amount;
            } else if (['withdrawal', 'transfer_out', 'fee', 'purchase'].includes(this.type)) {
                newBalance -= this.amount;
                if (newBalance < 0) {
                    return next(new Error('Insufficient balance'));
                }
            }

            this.balanceAfter = newBalance;
            account.balance = newBalance;
            await account.save();

        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Create indexes
savingsAccountSchema.index({ farmer: 1 });
savingsAccountSchema.index({ accountNumber: 1 });
savingsAccountSchema.index({ status: 1 });

transactionSchema.index({ account: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ type: 1, category: 1 });
transactionSchema.index({ status: 1 });

savingsGoalSchema.index({ farmer: 1, status: 1 });
savingsGoalSchema.index({ targetDate: 1 });
savingsGoalSchema.index({ priority: 1, status: 1 });

const SavingsAccount = mongoose.model('SavingsAccount', savingsAccountSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const SavingsGoal = mongoose.model('SavingsGoal', savingsGoalSchema);

module.exports = { SavingsAccount, Transaction, SavingsGoal };