const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');

// Generate JWT token
const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '24h'
    });
};

// Generate refresh token
const signRefreshToken = (id) => {
    return jwt.sign({ id, type: 'refresh' }, process.env.JWT_SECRET, {
        expiresIn: '7d'
    });
};

// Create and send token response
const createSendToken = (user, statusCode, res, message = 'Success') => {
    const token = signToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    // Add refresh token to user's tokens array
    user.refreshTokens.push({
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    // Clean expired tokens
    user.cleanExpiredTokens();

    // Save user with refresh tokens (before removing password)
    user.save({ validateBeforeSave: false });

    // Create a copy for response without sensitive data
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;

    res.status(statusCode).json({
        success: true,
        message,
        data: {
            user: userResponse,
            token,
            refreshToken
        }
    });
};

// Register new user
exports.register = async (req, res) => {
    try {
        const { name, email, password, farmName, location, phoneNumber } = req.body;

        // Validate required fields
        if (!name || !email || !password || !farmName || !location || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required (name, email, password, farmName, location, phoneNumber)'
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create new user
        const newUser = await User.create({
            name,
            email,
            password,
            farmName,
            location,
            phoneNumber
        });

        // Create default savings account
        const { SavingsAccount } = require('../models/SavingsAccount');
        await SavingsAccount.create({
            farmer: newUser._id,
            balance: 0
        });

        createSendToken(newUser, 201, res, 'User registered successfully');

    } catch (error) {
        console.error('Registration error:', error);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Internal server error during registration'
        });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password exist
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Check if user exists and get password field
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if password is correct
        const isPasswordCorrect = await user.comparePassword(password);
        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        createSendToken(user, 200, res, 'Login successful');

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login'
        });
    }
};

// Refresh token
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // Verify refresh token
        const decoded = await promisify(jwt.verify)(refreshToken, process.env.JWT_SECRET);

        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token type'
            });
        }

        // Check if user still exists
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists'
            });
        }

        // Check if refresh token exists in user's tokens
        const tokenExists = user.refreshTokens.some(
            tokenObj => tokenObj.token === refreshToken && tokenObj.expiresAt > new Date()
        );

        if (!tokenExists) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }

        // Generate new access token
        const newToken = signToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            token: newToken
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
};

// Logout user
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken && req.user) {
            // Remove the specific refresh token
            req.user.refreshTokens = req.user.refreshTokens.filter(
                tokenObj => tokenObj.token !== refreshToken
            );
            await req.user.save({ validateBeforeSave: false });
        }

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during logout'
        });
    }
};

// Logout from all devices
exports.logoutAll = async (req, res) => {
    try {
        // Clear all refresh tokens
        req.user.refreshTokens = [];
        await req.user.save({ validateBeforeSave: false });

        res.status(200).json({
            success: true,
            message: 'Logged out from all devices successfully'
        });

    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during logout from all devices'
        });
    }
};

// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-refreshTokens');

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user profile'
        });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const {
            name, farmName, location, phoneNumber, farmSize, farmType, preferences
        } = req.body;

        const updateFields = {};
        if (name) updateFields.name = name;
        if (farmName) updateFields.farmName = farmName;
        if (location) updateFields.location = location;
        if (phoneNumber) updateFields.phoneNumber = phoneNumber;
        if (farmSize !== undefined) updateFields.farmSize = farmSize;
        if (farmType) updateFields.farmType = farmType;
        if (preferences) updateFields.preferences = { ...req.user.preferences, ...preferences };

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateFields,
            { new: true, runValidators: true }
        ).select('-refreshTokens');

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });

    } catch (error) {
        console.error('Update profile error:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error changing password'
        });
    }
};