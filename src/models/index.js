// Export all models from a single file
const User = require('./User');
const Seed = require('./Seed');
const { Fertilizer, FertilizerInventory } = require('./Fertilizer');
const { Machinery, MachineryRental } = require('./Machinery');
const { SavingsAccount, Transaction, SavingsGoal } = require('./SavingsAccount');
const { Activity, Notification } = require('./Activity');

module.exports = {
    User,
    Seed,
    Fertilizer,
    FertilizerInventory,
    Machinery,
    MachineryRental,
    SavingsAccount,
    Transaction,
    SavingsGoal,
    Activity,
    Notification
};