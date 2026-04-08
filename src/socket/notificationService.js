const socketManager = require('./socketManager');
const { Notification } = require('../models/Activity');

// Real-time notification service
class NotificationService {
    constructor() {
        this.socketManager = socketManager;
    }

    async createAndSendNotification(userId, type, title, message, options = {}) {
        try {
            // Create notification in database
            const notification = await Notification.createNotification(
                userId,
                type,
                title,
                message,
                options
            );

            // Send real-time notification if user is online
            if (this.socketManager.isUserOnline(userId)) {
                this.socketManager.sendNotification(userId, notification);
            }

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    // Specific notification types
    async sendLowStockAlert(userId, item, currentQuantity, minQuantity) {
        return this.createAndSendNotification(
            userId,
            'low_stock',
            'Low Stock Alert',
            `${item.name} is running low. Current: ${currentQuantity}, Minimum: ${minQuantity}`,
            {
                priority: 'high',
                actionRequired: true,
                actionUrl: `/inventory/${item.type}/${item.id}`,
                relatedEntity: {
                    entityType: item.type,
                    entityId: item.id
                }
            }
        );
    }

    async sendExpiryWarning(userId, item, daysUntilExpiry) {
        const priority = daysUntilExpiry <= 7 ? 'urgent' : 'high';
        const message = daysUntilExpiry <= 0
            ? `${item.name} has expired!`
            : `${item.name} will expire in ${daysUntilExpiry} days`;

        return this.createAndSendNotification(
            userId,
            'expiry_warning',
            'Expiry Warning',
            message,
            {
                priority,
                actionRequired: true,
                actionUrl: `/inventory/${item.type}/${item.id}`,
                relatedEntity: {
                    entityType: item.type,
                    entityId: item.id
                }
            }
        );
    }

    async sendMaintenanceReminder(userId, machinery, daysOverdue) {
        const message = daysOverdue > 0
            ? `${machinery.name} maintenance is ${daysOverdue} days overdue!`
            : `${machinery.name} is due for maintenance`;

        return this.createAndSendNotification(
            userId,
            'reminder',
            'Maintenance Reminder',
            message,
            {
                priority: daysOverdue > 0 ? 'urgent' : 'high',
                actionRequired: true,
                actionUrl: `/machinery/${machinery.id}/maintenance`,
                relatedEntity: {
                    entityType: 'machinery',
                    entityId: machinery.id
                }
            }
        );
    }

    async sendPaymentDue(userId, amount, description, dueDate) {
        const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        const priority = daysUntilDue <= 3 ? 'urgent' : 'high';

        return this.createAndSendNotification(
            userId,
            'payment_due',
            'Payment Due',
            `Payment of $${amount} for ${description} is due in ${daysUntilDue} days`,
            {
                priority,
                actionRequired: true,
                actionUrl: '/savings/transactions'
            }
        );
    }

    async sendAchievementNotification(userId, achievement) {
        return this.createAndSendNotification(
            userId,
            'achievement',
            'Achievement Unlocked!',
            achievement.message,
            {
                priority: 'medium',
                actionRequired: false,
                channels: { inApp: true, push: true }
            }
        );
    }

    async sendWeatherAlert(userId, location, alert) {
        return this.createAndSendNotification(
            userId,
            'weather_alert',
            'Weather Alert',
            alert.message,
            {
                priority: alert.severity,
                actionRequired: false,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            }
        );
    }

    async sendPriceUpdate(userId, crop, oldPrice, newPrice, changePercent) {
        const trend = newPrice > oldPrice ? 'increased' : 'decreased';
        const message = `${crop} price has ${trend} by ${Math.abs(changePercent)}% to $${newPrice}`;

        return this.createAndSendNotification(
            userId,
            'price_update',
            'Market Price Update',
            message,
            {
                priority: Math.abs(changePercent) > 10 ? 'high' : 'medium',
                actionRequired: false
            }
        );
    }

    async sendGoalAchievement(userId, goal) {
        return this.createAndSendNotification(
            userId,
            'achievement',
            'Savings Goal Achieved!',
            `Congratulations! You've reached your savings goal: ${goal.title}`,
            {
                priority: 'medium',
                actionRequired: false,
                actionUrl: `/savings/goals/${goal.id}`,
                relatedEntity: {
                    entityType: 'goal',
                    entityId: goal.id
                }
            }
        );
    }

    async sendGoalMilestone(userId, goal, milestone) {
        return this.createAndSendNotification(
            userId,
            'achievement',
            'Savings Milestone Reached!',
            `You've reached ${milestone}% of your savings goal: ${goal.title}`,
            {
                priority: 'medium',
                actionRequired: false,
                actionUrl: `/savings/goals/${goal.id}`,
                relatedEntity: {
                    entityType: 'goal',
                    entityId: goal.id
                }
            }
        );
    }

    async sendTransactionAlert(userId, transaction) {
        const isLargeAmount = transaction.amount > 1000;
        const message = `${transaction.type} of $${transaction.amount}: ${transaction.description}`;

        if (isLargeAmount) {
            return this.createAndSendNotification(
                userId,
                'alert',
                'Large Transaction Alert',
                message,
                {
                    priority: 'high',
                    actionRequired: false,
                    actionUrl: '/savings/transactions'
                }
            );
        }
    }

    // Bulk notifications
    async sendToMultipleUsers(userIds, type, title, message, options = {}) {
        const promises = userIds.map(userId =>
            this.createAndSendNotification(userId, type, title, message, options)
        );

        return Promise.allSettled(promises);
    }

    async sendSystemAnnouncement(title, message, priority = 'medium') {
        // Send to all connected users
        this.socketManager.sendSystemAnnouncement(message, priority);

        // Optionally save as notification for offline users
        // This would require getting all user IDs and creating notifications
    }

    // Notification management
    async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findOne({
                _id: notificationId,
                user: userId
            });

            if (notification) {
                await notification.markAsRead();

                // Notify user of status change
                this.socketManager.broadcastToUser(userId, 'notification_read', {
                    notificationId: notificationId
                });
            }

            return notification;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    async dismissNotification(notificationId, userId) {
        try {
            const notification = await Notification.findOne({
                _id: notificationId,
                user: userId
            });

            if (notification) {
                await notification.dismiss();

                // Notify user of status change
                this.socketManager.broadcastToUser(userId, 'notification_dismissed', {
                    notificationId: notificationId
                });
            }

            return notification;
        } catch (error) {
            console.error('Error dismissing notification:', error);
            throw error;
        }
    }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;