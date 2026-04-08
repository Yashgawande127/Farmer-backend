const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    farmName: {
        type: String,
        required: [true, 'Farm name is required'],
        trim: true,
        maxlength: [200, 'Farm name cannot exceed 200 characters']
    },
    location: {
        type: String,
        required: [true, 'Location is required'],
        trim: true
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    farmSize: {
        type: Number,
        default: 0,
        min: [0, 'Farm size cannot be negative']
    },
    farmType: {
        type: String,
        enum: ['organic', 'conventional', 'mixed'],
        default: 'conventional'
    },
    profileImage: {
        type: String,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        enum: ['farmer', 'admin'],
        default: 'farmer'
    },
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            push: { type: Boolean, default: true }
        },
        language: { type: String, default: 'en' },
        currency: { type: String, default: 'USD' }
    },
    lastLogin: {
        type: Date,
        default: null
    },
    refreshTokens: [{
        token: String,
        createdAt: { type: Date, default: Date.now },
        expiresAt: Date
    }]
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    // Check if password exists and is not empty
    if (!this.password || this.password === '') {
        return next(new Error('Password is required'));
    }

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Remove expired refresh tokens
userSchema.methods.cleanExpiredTokens = function () {
    this.refreshTokens = this.refreshTokens.filter(
        tokenObj => tokenObj.expiresAt > new Date()
    );
};

// Create indexes
userSchema.index({ email: 1 });
userSchema.index({ location: 1 });
userSchema.index({ farmType: 1 });

module.exports = mongoose.model('User', userSchema);