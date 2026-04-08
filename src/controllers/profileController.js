const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

// @desc    Get current user profile
// @route   GET /api/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -refreshTokens');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const {
            name,
            email,
            farmName,
            location,
            phoneNumber,
            farmSize,
            farmType,
            preferences
        } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (farmName) user.farmName = farmName;
        if (location) user.location = location;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (farmSize !== undefined) user.farmSize = farmSize;
        if (farmType) user.farmType = farmType;
        if (preferences) {
            user.preferences = {
                ...user.preferences,
                ...preferences
            };
        }

        await user.save();

        // Return updated user without sensitive data
        const updatedUser = await User.findById(user._id).select('-password -refreshTokens');

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update profile image
// @route   PUT /api/profile/image
// @access  Private
const updateProfileImage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Here you would typically handle file upload to cloud storage
        // For now, we'll just store the file path or URL
        if (req.file) {
            user.profileImage = req.file.path || req.file.filename;
        } else if (req.body.profileImage) {
            user.profileImage = req.body.profileImage;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile image updated successfully',
            data: {
                profileImage: user.profileImage
            }
        });
    } catch (error) {
        console.error('Update profile image error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update password
// @route   PUT /api/profile/password
// @access  Private
const updatePassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
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
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update notification preferences
// @route   PUT /api/profile/notifications
// @access  Private
const updateNotificationPreferences = async (req, res) => {
    try {
        const { notifications } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.preferences.notifications = {
            ...user.preferences.notifications,
            ...notifications
        };

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Notification preferences updated successfully',
            data: {
                notifications: user.preferences.notifications
            }
        });
    } catch (error) {
        console.error('Update notification preferences error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete user account
// @route   DELETE /api/profile
// @access  Private
const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Password is incorrect'
            });
        }

        // Delete user account
        await User.findByIdAndDelete(req.user.id);

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get profile statistics
// @route   GET /api/profile/stats
// @access  Private
const getProfileStats = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Calculate days since joining
        const daysSinceJoining = Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24));

        // You can add more statistics here based on your models
        const stats = {
            memberSince: user.createdAt,
            daysSinceJoining,
            lastLogin: user.lastLogin,
            farmSize: user.farmSize,
            farmType: user.farmType,
            // Add more stats as needed
        };

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get profile stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    updateProfileImage,
    updatePassword,
    updateNotificationPreferences,
    deleteAccount,
    getProfileStats
};