const BankAccount = require('../models/BankAccount');

const normalizeUpiIds = (upiIds) => {
    if (!upiIds || !Array.isArray(upiIds)) return upiIds;
    // Trim, lowercase, and remove duplicates
    const normalized = upiIds.map(id => id.trim().toLowerCase());
    return [...new Set(normalized)];
};

const createBankAccount = async (userId, payload) => {
    let { isPrimary, upiIds, ...rest } = payload;

    const normalizedUpiIds = normalizeUpiIds(upiIds);

    // Check if the user has any active accounts
    const activeAccountsCount = await BankAccount.countDocuments({ userId, isActive: true });

    // If no active accounts, force isPrimary to true
    if (activeAccountsCount === 0) {
        isPrimary = true;
    }

    if (isPrimary) {
        // If promoting this to primary, unset previous primary
        await BankAccount.updateMany(
            { userId, isActive: true, isPrimary: true },
            { $set: { isPrimary: false } }
        );
    }

    try {
        const newAccount = await BankAccount.create({
            userId,
            isPrimary,
            upiIds: normalizedUpiIds,
            isActive: true,
            ...rest
        });

        return newAccount.toJSON();
    } catch (error) {
        // Handle duplicate key error strictly for the new DB constraint
        if (error.code === 11000) {
            throw new Error('A primary account already exists and could not be unset due to a race condition. Please try again.');
        }
        throw error;
    }
};

const updateBankAccount = async (userId, accountId, payload) => {
    let { isPrimary, upiIds, debitCards, ...rest } = payload;

    // First ensure the account exists and belongs to user
    const account = await BankAccount.findOne({ _id: accountId, userId, isActive: true });

    if (!account) {
        throw new Error('Account not found');
    }

    const updates = { ...rest };

    if (upiIds !== undefined) {
        updates.upiIds = normalizeUpiIds(upiIds);
    }

    if (debitCards !== undefined) {
        // FULL REPLACE only for debit cards as per requirements
        updates.debitCards = debitCards;
    }

    if (isPrimary !== undefined) {
        if (isPrimary && !account.isPrimary) {
            // Unset other primaries first to avoid unique constraint clash
            await BankAccount.updateMany(
                { userId, isActive: true, isPrimary: true, _id: { $ne: account._id } },
                { $set: { isPrimary: false } }
            );
            updates.isPrimary = true;
        } else if (!isPrimary && account.isPrimary) {
            throw new Error('Cannot unset primary manually. Set another account as primary instead.');
        }
    }

    try {
        const updatedAccount = await BankAccount.findOneAndUpdate(
            { _id: accountId, userId, isActive: true },
            { $set: updates },
            { new: true, runValidators: true } // Return updated doc
        );
        return updatedAccount ? updatedAccount.toJSON() : null;
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('A primary account already exists context constraint violated.');
        }
        throw error;
    }
};

const deleteBankAccount = async (userId, accountId) => {
    // Step 1: Fetch account
    const account = await BankAccount.findOne({
        _id: accountId,
        userId,
        isActive: true
    });

    if (!account) {
        throw new Error('Bank account not found or already deleted');
    }

    // Step 2: Ensure at least one active account remains
    const activeAccountsCount = await BankAccount.countDocuments({
        userId,
        isActive: true
    });

    if (activeAccountsCount <= 1) {
        throw new Error(
            'You must have at least one active bank account. Please add another account before deleting this one.'
        );
    }

    // Step 3: Handle primary reassignment
    if (account.isPrimary) {
        const otherAccount = await BankAccount.findOne({
            userId,
            isActive: true,
            _id: { $ne: accountId }
        }).sort({ createdAt: -1 });

        if (!otherAccount) {
            // This should never happen due to validation, but defensive coding
            throw new Error('Unable to reassign primary account. Please try again.');
        }

        await BankAccount.updateOne(
            { _id: otherAccount._id, userId, isActive: true },
            { $set: { isPrimary: true } }
        );
    }

    // Step 4: Soft delete
    const deletedAccount = await BankAccount.findOneAndUpdate(
        { _id: accountId, userId, isActive: true },
        { $set: { isActive: false, isPrimary: false } },
        { new: true }
    );

    if (!deletedAccount) {
        throw new Error('Failed to delete bank account. Please try again.');
    }

    return deletedAccount.toJSON();
};

const getBankAccounts = async (userId) => {
    const accounts = await BankAccount.find({ userId, isActive: true })
        .sort({ isPrimary: -1, createdAt: -1 });
    return accounts.map(acc => acc.toJSON());
};

const getBankAccountById = async (userId, accountId) => {
    const account = await BankAccount.findOne({ _id: accountId, userId, isActive: true });
    return account ? account.toJSON() : null;
};

module.exports = {
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    getBankAccounts,
    getBankAccountById
};
