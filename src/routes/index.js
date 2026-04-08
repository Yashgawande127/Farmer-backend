const express = require('express');
const authRoutes = require('./auth');
const seedsRoutes = require('./seeds');
const fertilizersRoutes = require('./fertilizers');
const machineryRoutes = require('./machinery');
const savingsRoutes = require('./savings');
const dashboardRoutes = require('./dashboard');
const profileRoutes = require('./profile');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
router.use('/auth', authRoutes);
router.use('/seeds', seedsRoutes);
router.use('/fertilizers', fertilizersRoutes);
router.use('/machinery', machineryRoutes);
router.use('/savings', savingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/profile', profileRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Farmer Management API Documentation',
        version: '1.0.0',
        endpoints: {
            auth: {
                'POST /api/auth/register': 'Register new user',
                'POST /api/auth/login': 'Login user',
                'POST /api/auth/logout': 'Logout user',
                'GET /api/auth/profile': 'Get user profile',
                'PUT /api/auth/profile': 'Update user profile'
            },
            seeds: {
                'GET /api/seeds': 'Get all seeds',
                'POST /api/seeds': 'Add new seed',
                'GET /api/seeds/:id': 'Get specific seed',
                'PUT /api/seeds/:id': 'Update seed',
                'DELETE /api/seeds/:id': 'Delete seed',
                'POST /api/seeds/:id/sell': 'Sell seed',
                'POST /api/seeds/:id/plant': 'Plant seed'
            },
            fertilizers: {
                'GET /api/fertilizers': 'Get available fertilizers',
                'GET /api/fertilizers/my-inventory': 'Get user inventory',
                'POST /api/fertilizers/:id/buy': 'Purchase fertilizer',
                'POST /api/fertilizers/inventory/:id/use': 'Use fertilizer'
            },
            machinery: {
                'GET /api/machinery': 'Get available machinery',
                'GET /api/machinery/my-equipment': 'Get owned machinery',
                'POST /api/machinery/add-personal': 'Add machinery',
                'POST /api/machinery/:id/buy': 'Buy machinery',
                'POST /api/machinery/:id/rent': 'Rent machinery'
            },
            savings: {
                'GET /api/savings/account': 'Get account details',
                'POST /api/savings/deposit': 'Deposit money',
                'POST /api/savings/withdraw': 'Withdraw money',
                'GET /api/savings/transactions': 'Get transaction history',
                'GET /api/savings/goals': 'Get savings goals'
            },
            profile: {
                'GET /api/profile': 'Get user profile',
                'PUT /api/profile': 'Update user profile',
                'PUT /api/profile/image': 'Update profile image',
                'PUT /api/profile/password': 'Update password',
                'PUT /api/profile/notifications': 'Update notification preferences',
                'DELETE /api/profile': 'Delete user account',
                'GET /api/profile/stats': 'Get profile statistics'
            },
            dashboard: {
                'GET /api/dashboard': 'Get dashboard data',
                'GET /api/dashboard/activities': 'Get recent activities',
                'GET /api/dashboard/financial-summary': 'Get financial summary',
                'GET /api/dashboard/inventory-overview': 'Get inventory overview'
            }
        }
    });
});

module.exports = router;