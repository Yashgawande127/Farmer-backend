const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const connectDB = require('./src/config/database');
const authMiddleware = require('./src/middleware/auth');
const { globalErrorHandler } = require('./src/middleware/errorHandler');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.io connection handling
const socketManager = require('./src/socket/socketManager');
socketManager.init(server);

// Make io available to other modules
global.io = socketManager.socketIO;

// Connect to database
connectDB();

// Trust proxy (for production deployment)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// API routes
app.use('/api', require('./src/routes'));

// Static file serving (for uploads)
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handling middleware (must be last)
app.use(globalErrorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`
🌾 Farmer Management API Server Started
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV}
🔗 Health Check: http://localhost:${PORT}/health
🚀 Socket.io: Enabled
📡 API Base URL: http://localhost:${PORT}/api
    `);
});

module.exports = app;