const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
    try {
        // 1) Getting token and check if it exists
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'You are not logged in! Please log in to get access.'
            });
        }

        // 2) Verification token
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        // 3) Check if user still exists
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: 'The user belonging to this token does no longer exist.'
            });
        }

        // 4) Check if user is active
        if (!currentUser.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        // Grant access to protected route
        req.user = currentUser;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Please log in again!'
            });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Your token has expired! Please log in again.'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// Restrict to certain roles
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};

// Optional authentication - doesn't fail if no token provided
exports.optionalAuth = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
            const currentUser = await User.findById(decoded.id);

            if (currentUser && currentUser.isActive) {
                req.user = currentUser;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication if token is invalid
        next();
    }
};

// Rate limiting per user
exports.rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();

    return (req, res, next) => {
        if (!req.user) {
            return next();
        }

        const userId = req.user.id.toString();
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old requests
        if (requests.has(userId)) {
            const userRequests = requests.get(userId).filter(time => time > windowStart);
            requests.set(userId, userRequests);
        } else {
            requests.set(userId, []);
        }

        const userRequests = requests.get(userId);

        if (userRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests. Please try again later.'
            });
        }

        userRequests.push(now);
        next();
    };
};

// Validate user owns resource
exports.validateOwnership = (resourceModel, resourceIdParam = 'id') => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params[resourceIdParam];
            const Model = require(`../models/${resourceModel}`);

            const resource = await Model.findById(resourceId);

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: `${resourceModel} not found`
                });
            }

            // Check if user owns the resource
            const ownerField = resource.farmer || resource.user || resource.owner;
            if (!ownerField || ownerField.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to access this resource'
                });
            }

            req.resource = resource;
            next();
        } catch (error) {
            console.error('Ownership validation error:', error);
            res.status(500).json({
                success: false,
                message: 'Error validating resource ownership'
            });
        }
    };
};

// Log user activity
exports.logActivity = (activityType, getActivityData = null) => {
    return async (req, res, next) => {
        try {
            if (req.user) {
                const { Activity } = require('../models/Activity');

                let activityData = {
                    type: activityType,
                    title: `${activityType.replace(/_/g, ' ')} activity`,
                    description: `User performed ${activityType.replace(/_/g, ' ')} action`
                };

                if (getActivityData && typeof getActivityData === 'function') {
                    const customData = getActivityData(req);
                    activityData = { ...activityData, ...customData };
                }

                await Activity.createActivity(
                    req.user.id,
                    activityData.type,
                    activityData.title,
                    activityData.description,
                    {
                        category: activityData.category,
                        priority: activityData.priority,
                        relatedEntity: activityData.relatedEntity,
                        amount: activityData.amount,
                        location: activityData.location,
                        metadata: {
                            ipAddress: req.ip,
                            userAgent: req.get('User-Agent')
                        }
                    }
                );
            }

            next();
        } catch (error) {
            console.error('Activity logging error:', error);
            // Don't fail the request if activity logging fails
            next();
        }
    };
};