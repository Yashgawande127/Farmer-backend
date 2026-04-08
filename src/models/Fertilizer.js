const mongoose = require('mongoose');

const fertilizerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Fertilizer name is required'],
        trim: true,
        maxlength: [150, 'Fertilizer name cannot exceed 150 characters']
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Fertilizer type is required'],
        enum: ['organic', 'inorganic', 'bio-fertilizer', 'liquid', 'granular'],
        default: 'granular'
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['nitrogen', 'phosphorus', 'potassium', 'compound', 'micronutrient', 'organic_compost'],
        default: 'compound'
    },
    composition: {
        nitrogen: { type: Number, min: 0, max: 100, default: 0 },
        phosphorus: { type: Number, min: 0, max: 100, default: 0 },
        potassium: { type: Number, min: 0, max: 100, default: 0 },
        sulfur: { type: Number, min: 0, max: 100, default: 0 },
        other_nutrients: [{
            name: String,
            percentage: Number
        }]
    },
    pricePerUnit: {
        type: Number,
        required: [true, 'Price per unit is required'],
        min: [0, 'Price cannot be negative']
    },
    unit: {
        type: String,
        required: [true, 'Unit is required'],
        enum: ['kg', 'bags', 'tons', 'liters'],
        default: 'kg'
    },
    quantityAvailable: {
        type: Number,
        required: [true, 'Quantity available is required'],
        min: [0, 'Quantity cannot be negative'],
        default: 0
    },
    description: {
        type: String,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    applicationRate: {
        recommended: { type: String }, // e.g., "200-300 kg/hectare"
        minimum: { type: Number },
        maximum: { type: Number },
        unit: { type: String, default: 'kg/hectare' }
    },
    suitableCrops: [{
        type: String,
        trim: true
    }],
    soilTypes: [{
        type: String,
        enum: ['clay', 'sandy', 'loamy', 'silt', 'acidic', 'alkaline', 'neutral'],
        default: 'loamy'
    }],
    manufacturer: {
        name: { type: String, required: true, trim: true },
        contact: { type: String, trim: true },
        location: { type: String, trim: true },
        certifications: [String]
    },
    images: [{
        url: String,
        description: String
    }],
    isOrganic: {
        type: Boolean,
        default: false
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    ratings: {
        average: { type: Number, min: 0, max: 5, default: 0 },
        count: { type: Number, default: 0 }
    },
    reviews: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, maxlength: 500 },
        createdAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

const fertilizerInventorySchema = new mongoose.Schema({
    farmer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fertilizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fertilizer',
        required: true
    },
    quantityPurchased: {
        type: Number,
        required: [true, 'Quantity purchased is required'],
        min: [0, 'Quantity cannot be negative']
    },
    quantityRemaining: {
        type: Number,
        required: [true, 'Quantity remaining is required'],
        min: [0, 'Quantity cannot be negative']
    },
    purchaseDate: {
        type: Date,
        required: [true, 'Purchase date is required'],
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: [true, 'Expiry date is required']
    },
    purchasePrice: {
        type: Number,
        required: [true, 'Purchase price is required'],
        min: [0, 'Price cannot be negative']
    },
    supplier: {
        name: { type: String, trim: true },
        contact: { type: String, trim: true },
        location: { type: String, trim: true }
    },
    storageLocation: {
        type: String,
        trim: true,
        default: 'main_warehouse'
    },
    batchNumber: {
        type: String,
        trim: true
    },
    usageHistory: [{
        quantityUsed: { type: Number, required: true, min: 0 },
        fieldLocation: { type: String, required: true },
        cropType: String,
        applicationDate: { type: Date, default: Date.now },
        applicationMethod: {
            type: String,
            enum: ['broadcast', 'band_application', 'foliar_spray', 'fertigation'],
            default: 'broadcast'
        },
        weatherConditions: String,
        notes: String
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Virtual for utilization percentage
fertilizerInventorySchema.virtual('utilizationPercentage').get(function () {
    if (this.quantityPurchased === 0) return 0;
    return ((this.quantityPurchased - this.quantityRemaining) / this.quantityPurchased) * 100;
});

// Virtual for days until expiry
fertilizerInventorySchema.virtual('daysUntilExpiry').get(function () {
    const today = new Date();
    const expiry = new Date(this.expiryDate);
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance method to use fertilizer
fertilizerInventorySchema.methods.useFertilizer = function (quantity, fieldLocation, options = {}) {
    if (quantity > this.quantityRemaining) {
        throw new Error('Insufficient quantity available');
    }

    this.quantityRemaining -= quantity;
    this.usageHistory.push({
        quantityUsed: quantity,
        fieldLocation,
        ...options
    });

    return this.save();
};

// Instance method to check if expired
fertilizerInventorySchema.methods.isExpired = function () {
    return new Date() > this.expiryDate;
};

// Pre-save middleware to update ratings
fertilizerSchema.pre('save', function (next) {
    if (this.reviews && this.reviews.length > 0) {
        const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
        this.ratings.average = totalRating / this.reviews.length;
        this.ratings.count = this.reviews.length;
    }
    next();
});

// Create indexes
fertilizerSchema.index({ type: 1, category: 1 });
fertilizerSchema.index({ isAvailable: 1 });
fertilizerSchema.index({ 'manufacturer.name': 1 });
fertilizerSchema.index({ 'ratings.average': -1 });

fertilizerInventorySchema.index({ farmer: 1, fertilizer: 1 });
fertilizerInventorySchema.index({ farmer: 1, isActive: 1 });
fertilizerInventorySchema.index({ expiryDate: 1 });

const Fertilizer = mongoose.model('Fertilizer', fertilizerSchema);
const FertilizerInventory = mongoose.model('FertilizerInventory', fertilizerInventorySchema);

module.exports = { Fertilizer, FertilizerInventory };