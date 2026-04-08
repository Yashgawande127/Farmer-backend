const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class SocketManager {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // userId -> socketId
        this.userSockets = new Map(); // socketId -> userId
    }

    init(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });

        this.setupEventHandlers();
        console.log('Socket.io server initialized');

        // Return io instance for external access
        return this.io;
    }

    // Getter for io instance
    get socketIO() {
        return this.io;
    }

    setupEventHandlers() {
        this.io.use(this.authenticateSocket.bind(this));

        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
            this.setupSocketEventHandlers(socket);
        });
    }

    async authenticateSocket(socket, next) {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                return next(new Error('Authentication token required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (!user || !user.isActive) {
                return next(new Error('Invalid or inactive user'));
            }

            socket.userId = user._id.toString();
            socket.user = user;
            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                console.warn('Socket authentication error: Token expired');
                return next(new Error('Token expired'));
            }
            console.error('Socket authentication error:', error);
            next(new Error('Authentication failed'));
        }
    }

    handleConnection(socket) {
        const userId = socket.userId;

        // Store user connection
        this.connectedUsers.set(userId, socket.id);
        this.userSockets.set(socket.id, userId);

        console.log(`User ${socket.user.name} connected: ${socket.id}`);

        // Join user to their personal room
        socket.join(`user:${userId}`);

        // Send welcome message
        socket.emit('connected', {
            message: 'Connected to real-time updates',
            userId: userId,
            timestamp: new Date().toISOString()
        });

        // Notify about online status
        this.broadcastUserStatus(userId, 'online');
    }

    setupSocketEventHandlers(socket) {
        const userId = socket.userId;

        // Handle disconnection
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });

        // Join specific rooms
        socket.on('join_room', (roomName) => {
            socket.join(roomName);
            console.log(`User ${userId} joined room: ${roomName}`);
        });

        socket.on('leave_room', (roomName) => {
            socket.leave(roomName);
            console.log(`User ${userId} left room: ${roomName}`);
        });

        // Handle real-time activity updates
        socket.on('activity_update', (data) => {
            this.broadcastToUser(userId, 'activity_update', data);
        });

        // Handle financial updates
        socket.on('balance_update', (data) => {
            this.broadcastToUser(userId, 'balance_update', data);
        });

        // Handle inventory updates
        socket.on('inventory_update', (data) => {
            this.broadcastToUser(userId, 'inventory_update', data);
        });

        // Handle ping/pong for connection health
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date().toISOString() });
        });

        // Handle typing indicators for chat (if implemented)
        socket.on('typing_start', (data) => {
            socket.to(data.room).emit('user_typing', {
                userId: userId,
                userName: socket.user.name,
                isTyping: true
            });
        });

        socket.on('typing_stop', (data) => {
            socket.to(data.room).emit('user_typing', {
                userId: userId,
                userName: socket.user.name,
                isTyping: false
            });
        });
    }

    handleDisconnection(socket) {
        const userId = socket.userId;

        // Remove user from maps
        this.connectedUsers.delete(userId);
        this.userSockets.delete(socket.id);

        console.log(`User ${socket.user.name} disconnected: ${socket.id}`);

        // Notify about offline status
        this.broadcastUserStatus(userId, 'offline');
    }

    // Broadcast methods
    broadcastToUser(userId, event, data) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, {
                ...data,
                timestamp: new Date().toISOString()
            });
        }
    }

    broadcastToRoom(room, event, data) {
        this.io.to(room).emit(event, {
            ...data,
            timestamp: new Date().toISOString()
        });
    }

    broadcastToAll(event, data) {
        this.io.emit(event, {
            ...data,
            timestamp: new Date().toISOString()
        });
    }

    broadcastUserStatus(userId, status) {
        this.io.emit('user_status_change', {
            userId,
            status,
            timestamp: new Date().toISOString()
        });
    }

    // Notification methods
    sendNotification(userId, notification) {
        this.broadcastToUser(userId, 'notification', {
            id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            actionRequired: notification.actionRequired,
            actionUrl: notification.actionUrl
        });
    }

    sendActivityUpdate(userId, activity) {
        this.broadcastToUser(userId, 'new_activity', {
            id: activity._id,
            type: activity.type,
            title: activity.title,
            description: activity.description,
            category: activity.category,
            amount: activity.amount,
            location: activity.location,
            createdAt: activity.createdAt
        });
    }

    sendBalanceUpdate(userId, balance, transaction) {
        this.broadcastToUser(userId, 'balance_update', {
            newBalance: balance,
            transaction: {
                id: transaction._id,
                type: transaction.type,
                amount: transaction.amount,
                description: transaction.description,
                balanceAfter: transaction.balanceAfter
            }
        });
    }

    sendInventoryAlert(userId, alert) {
        this.broadcastToUser(userId, 'inventory_alert', {
            type: alert.type, // 'low_stock', 'expiry_warning', 'maintenance_due'
            message: alert.message,
            item: alert.item,
            severity: alert.severity,
            actionRequired: alert.actionRequired
        });
    }

    sendMarketUpdate(marketData) {
        this.broadcastToAll('market_update', marketData);
    }

    sendWeatherAlert(location, alert) {
        // Send to users in specific location
        this.io.emit('weather_alert', {
            location,
            alert
        });
    }

    // Utility methods
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }

    getOnlineUsers() {
        return Array.from(this.connectedUsers.keys());
    }

    getConnectedSocketsCount() {
        return this.io.sockets.sockets.size;
    }

    getUserSocket(userId) {
        const socketId = this.connectedUsers.get(userId);
        return socketId ? this.io.sockets.sockets.get(socketId) : null;
    }

    // Admin methods
    sendSystemAnnouncement(message, priority = 'medium') {
        this.broadcastToAll('system_announcement', {
            message,
            priority,
            type: 'announcement'
        });
    }

    sendMaintenanceNotice(startTime, endTime, message) {
        this.broadcastToAll('maintenance_notice', {
            startTime,
            endTime,
            message,
            type: 'maintenance'
        });
    }
}

// Create singleton instance
const socketManager = new SocketManager();

module.exports = socketManager;