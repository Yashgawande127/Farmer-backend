const mongoose = require('mongoose');

const machinerySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Machinery name is required'],
        trim: true,
        maxlength: [150, 'Machinery name cannot exceed 150 characters']
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true
    },
    model: {
        type: String,
        required: [true, 'Model is required'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: [
            'tractor', 'harvester', 'planter', 'cultivator', 'sprayer',
            'irrigation', 'thresher', 'plow', 'harrow', 'mower', 'other'
        ],
        default: 'tractor'
    },
    type: {
        type: String,
        enum: ['owned', 'rental', 'for_sale'],
        required: [true, 'Type is required']
    },
    specifications: {
        power: { type: String }, // e.g., "50 HP"
        engine: { type: String },
        fuelType: {
            type: String,
            enum: ['diesel', 'petrol', 'electric', 'hybrid'],
            default: 'diesel'
        },
        weight: { type: String },
        dimensions: {
            length: String,
            width: String,
            height: String
        },
        capacity: { type: String }, // varies by machinery type
        workingWidth: { type: String }
    },
    condition: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor'],
        default: 'good'
    },
    manufacturingYear: {
        type: Number,
        min: [1950, 'Manufacturing year seems too old'],
        max: [new Date().getFullYear() + 1, 'Manufacturing year cannot be in the future']
    },
    purchasePrice: {
        type: Number,
        min: [0, 'Purchase price cannot be negative']
    },
    currentValue: {
        type: Number,
        min: [0, 'Current value cannot be negative']
    },
    rentalPrice: {
        hourly: { type: Number, min: 0 },
        daily: { type: Number, min: 0 },
        weekly: { type: Number, min: 0 },
        monthly: { type: Number, min: 0 }
    },
    availability: {
        isAvailable: { type: Boolean, default: true },
        availableFrom: Date,
        availableUntil: Date,
        location: { type: String, trim: true }
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    features: [{
        type: String,
        trim: true
    }],
    images: [{
        url: String,
        description: String,
        isPrimary: { type: Boolean, default: false }
    }],
    documents: [{
        type: {
            type: String,
            enum: ['registration', 'insurance', 'manual', 'warranty', 'service_record'],
            required: true
        },
        url: String,
        description: String,
        expiryDate: Date
    }],
    maintenance: {
        lastServiceDate: Date,
        nextServiceDate: Date,
        serviceIntervalHours: { type: Number, default: 500 },
        totalOperatingHours: { type: Number, default: 0 },
        warrantyExpiryDate: Date
    },
    isActive: {
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
        rentalId: { type: mongoose.Schema.Types.ObjectId, ref: 'MachineryRental' },
        createdAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

const machineryRentalSchema = new mongoose.Schema({
    machinery: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machinery',
        required: true
    },
    renter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required']
    },
    totalCost: {
        type: Number,
        required: [true, 'Total cost is required'],
        min: [0, 'Total cost cannot be negative']
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'mobile_payment', 'credit_card'],
        default: 'cash'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'paid', 'refunded'],
        default: 'pending'
    },
    status: {
        type: String,
        enum: ['requested', 'confirmed', 'active', 'completed', 'cancelled'],
        default: 'requested'
    },
    deliveryLocation: {
        address: { type: String, required: true },
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    terms: {
        damageDeposit: { type: Number, default: 0 },
        fuelIncluded: { type: Boolean, default: false },
        operatorIncluded: { type: Boolean, default: false },
        specialConditions: String
    },
    operatingHours: {
        planned: { type: Number, default: 0 },
        actual: { type: Number, default: 0 }
    },
    notes: {
        renterNotes: String,
        ownerNotes: String,
        adminNotes: String
    },
    inspection: {
        preRental: {
            condition: String,
            fuelLevel: String,
            images: [String],
            inspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            date: Date
        },
        postRental: {
            condition: String,
            fuelLevel: String,
            images: [String],
            damages: [String],
            inspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            date: Date
        }
    }
}, {
    timestamps: true
});

// Virtual for rental duration in days
machineryRentalSchema.virtual('durationDays').get(function () {
    const diffTime = this.endDate - this.startDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for machinery age
machinerySchema.virtual('age').get(function () {
    return new Date().getFullYear() - this.manufacturingYear;
});

// Instance method to check if machinery is available for rental period
machinerySchema.methods.isAvailableForPeriod = function (startDate, endDate) {
    // This would typically check against existing rentals
    // For now, just check basic availability
    return this.availability.isAvailable &&
        this.type === 'rental' &&
        this.isActive;
};

// Pre-save middleware to update ratings
machinerySchema.pre('save', function (next) {
    if (this.reviews && this.reviews.length > 0) {
        const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
        this.ratings.average = totalRating / this.reviews.length;
        this.ratings.count = this.reviews.length;
    }
    next();
});

// Pre-save middleware for rental validation
machineryRentalSchema.pre('save', function (next) {
    if (this.startDate >= this.endDate) {
        return next(new Error('End date must be after start date'));
    }
    next();
});

// Create indexes
machinerySchema.index({ owner: 1, category: 1 });
machinerySchema.index({ type: 1, 'availability.isAvailable': 1 });
machinerySchema.index({ category: 1, condition: 1 });
machinerySchema.index({ 'ratings.average': -1 });

machineryRentalSchema.index({ renter: 1, status: 1 });
machineryRentalSchema.index({ owner: 1, status: 1 });
machineryRentalSchema.index({ machinery: 1, startDate: 1, endDate: 1 });

const Machinery = mongoose.model('Machinery', machinerySchema);
const MachineryRental = mongoose.model('MachineryRental', machineryRentalSchema);

module.exports = { Machinery, MachineryRental };