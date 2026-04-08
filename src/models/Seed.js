const mongoose = require('mongoose');

const seedSchema = new mongoose.Schema({
    farmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Seed name is required'],
        trim: true,
        maxlength: [100, 'Seed name cannot exceed 100 characters']
    },
    variety: {
        type: String,
        required: [true, 'Seed variety is required'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['cereals', 'vegetables', 'fruits', 'legumes', 'cash_crops', 'fodder', 'flowers'],
        default: 'vegetables'
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity cannot be negative'],
        default: 0
    },
    unit: {
        type: String,
        required: [true, 'Unit is required'],
        enum: ['kg', 'grams', 'packets', 'bags', 'tons'],
        default: 'kg'
    },
    pricePerUnit: {
        type: Number,
        required: [true, 'Price per unit is required'],
        min: [0, 'Price cannot be negative']
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required']
    },
    supplier: {
        name: { type: String, trim: true },
        contact: { type: String, trim: true },
        location: { type: String, trim: true }
    },
    qualityGrade: {
        type: String,
        enum: ['A', 'B', 'C', 'Premium'],
        default: 'B'
    },
    germination_rate: {
        type: Number,
        min: [0, 'Germination rate cannot be negative'],
        max: [100, 'Germination rate cannot exceed 100%'],
        default: 85
    },
    storage_conditions: {
        temperature: { type: String, default: 'cool_dry' },
        humidity: { type: String, default: 'low' },
        location: { type: String, default: 'warehouse' }
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    images: [{
        url: String,
        description: String
    }],
    isOrganic: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    salesHistory: [{
        quantity: { type: Number, required: true },
        pricePerUnit: { type: Number, required: true },
        buyer: {
            name: String,
            contact: String
        },
        saleDate: { type: Date, default: Date.now },
        totalAmount: Number
    }],
    usageHistory: [{
        quantity: { type: Number, required: true },
        fieldLocation: String,
        plantingDate: { type: Date, default: Date.now },
        expectedHarvestDate: Date,
        notes: String
    }]
}, {
    timestamps: true
});

// Pre-save middleware to calculate total amount for sales
seedSchema.pre('save', function (next) {
    if (this.salesHistory && this.salesHistory.length > 0) {
        this.salesHistory.forEach(sale => {
            if (!sale.totalAmount) {
                sale.totalAmount = sale.quantity * sale.pricePerUnit;
            }
        });
    }
    next();
});

// Virtual for total value
seedSchema.virtual('totalValue').get(function () {
    return this.quantity * this.pricePerUnit;
});

// Virtual for days until expiry
seedSchema.virtual('daysUntilExpiry').get(function () {
    const today = new Date();
    const expiry = new Date(this.expiryDate);
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance method to check if seed is expired
seedSchema.methods.isExpired = function () {
    return new Date() > this.expiryDate;
};

// Instance method to check if seed is near expiry (within 30 days)
seedSchema.methods.isNearExpiry = function () {
    const daysUntilExpiry = this.daysUntilExpiry;
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
};

// Static method to get seeds by category
seedSchema.statics.findByCategory = function (category, farmerId) {
    return this.find({ category, farmer: farmerId, isActive: true });
};

// Create indexes
seedSchema.index({ farmer: 1, category: 1 });
seedSchema.index({ farmer: 1, name: 1 });
seedSchema.index({ expiryDate: 1 });
seedSchema.index({ isActive: 1 });

module.exports = mongoose.model('Seed', seedSchema);