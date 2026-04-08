const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'seed_purchase', 'seed_planted', 'seed_sold',
            'fertilizer_purchase', 'fertilizer_applied',
            'machinery_purchase', 'machinery_rental', 'machinery_maintenance',
            'deposit', 'withdrawal', 'transfer',
            'goal_created', 'goal_achieved', 'goal_contribution',
            'login', 'profile_update',
            'system_notification'
        ]
    },
    title: {
        type: String,
        required: [true, 'Activity title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Activity description is required'],
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    category: {
        type: String,
        enum: ['farming', 'financial', 'equipment', 'system', 'achievement'],
        default: 'farming'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    relatedEntity: {
        entityType: {
            type: String,
            enum: ['seed', 'fertilizer', 'machinery', 'transaction', 'goal', 'user']
        },
        entityId: mongoose.Schema.Types.ObjectId,
        entityName: String
    },
    amount: {
        type: Number,
        min: 0
    },
    location: {
        type: String,
        trim: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    }
}, {
    timestamps: true
});

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'reminder', 'alert', 'achievement', 'system', 'marketing',
            'expiry_warning', 'low_stock', 'payment_due', 'weather_alert',
            'price_update', 'new_feature'
        ]
    },
    title: {
        type: String,
        required: [true, 'Notification title is required'],
        trim: true,
        maxlength: [150, 'Title cannot exceed 150 characters']
    },
    message: {
        type: String,
        required: [true, 'Notification message is required'],
        trim: true,
        maxlength: [500, 'Message cannot exceed 500 characters']
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    channels: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false }
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'read', 'dismissed', 'failed'],
        default: 'pending'
    },
    scheduledFor: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date
    },
    actionRequired: {
        type: Boolean,
        default: false
    },
    actionUrl: {
        type: String,
        trim: true
    },
    relatedEntity: {
        entityType: {
            type: String,
            enum: ['seed', 'fertilizer', 'machinery', 'transaction', 'goal', 'activity']
        },
        entityId: mongoose.Schema.Types.ObjectId
    },
    deliveryStatus: {
        inApp: {
            delivered: { type: Boolean, default: false },
            deliveredAt: Date,
            readAt: Date
        },
        email: {
            sent: { type: Boolean, default: false },
            sentAt: Date,
            opened: { type: Boolean, default: false },
            openedAt: Date
        },
        sms: {
            sent: { type: Boolean, default: false },
            sentAt: Date,
            delivered: { type: Boolean, default: false },
            deliveredAt: Date
        },
        push: {
            sent: { type: Boolean, default: false },
            sentAt: Date,
            clicked: { type: Boolean, default: false },
            clickedAt: Date
        }
    }
}, {
    timestamps: true
});

// Virtual to check if notification is expired
notificationSchema.virtual('isExpired').get(function () {
    return this.expiresAt && new Date() > this.expiresAt;
});

// Static method to create activity
activitySchema.statics.createActivity = function (userId, type, title, description, options = {}) {
    return this.create({
        user: userId,
        type,
        title,
        description,
        category: options.category || 'farming',
        priority: options.priority || 'medium',
        relatedEntity: options.relatedEntity,
        amount: options.amount,
        location: options.location,
        metadata: options.metadata
    });
};

// Static method to create notification
notificationSchema.statics.createNotification = function (userId, type, title, message, options = {}) {
    return this.create({
        user: userId,
        type,
        title,
        message,
        priority: options.priority || 'medium',
        channels: options.channels || { inApp: true },
        scheduledFor: options.scheduledFor || new Date(),
        expiresAt: options.expiresAt,
        actionRequired: options.actionRequired || false,
        actionUrl: options.actionUrl,
        relatedEntity: options.relatedEntity
    });
};

// Instance method to mark notification as read
notificationSchema.methods.markAsRead = function () {
    this.status = 'read';
    this.deliveryStatus.inApp.readAt = new Date();
    return this.save();
};

// Instance method to dismiss notification
notificationSchema.methods.dismiss = function () {
    this.status = 'dismissed';
    return this.save();
};

// Pre-save middleware to set expiry if not provided
notificationSchema.pre('save', function (next) {
    if (this.isNew && !this.expiresAt) {
        // Set default expiry based on type
        const expiryDays = {
            'reminder': 7,
            'alert': 3,
            'achievement': 30,
            'system': 30,
            'marketing': 7,
            'expiry_warning': 1,
            'low_stock': 3,
            'payment_due': 1,
            'weather_alert': 1,
            'price_update': 7,
            'new_feature': 30
        };

        const days = expiryDays[this.type] || 7;
        this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    next();
});

// Create indexes
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ user: 1, type: 1 });
activitySchema.index({ user: 1, isRead: 1 });
activitySchema.index({ category: 1, priority: 1 });

notificationSchema.index({ user: 1, status: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ type: 1, priority: 1 });

const Activity = mongoose.model('Activity', activitySchema);
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Activity, Notification };