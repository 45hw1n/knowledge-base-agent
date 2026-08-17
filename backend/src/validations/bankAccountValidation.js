const { z } = require('zod');

const debitCardSchema = z.object({
    name: z.string().optional().default('Debit Card'),
    last4: z.string().regex(/^\d{4}$/, 'last4 must be exactly 4 digits'),
    expiryMonth: z.number().int().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
    expiryYear: z.number().int().min(new Date().getFullYear(), 'Expiry year cannot be in the past'),
    network: z.enum(['VISA', 'MASTERCARD', 'RUPAY', 'AMEX']).optional()
});

const createBankAccountSchema = z.object({
    name: z.string().min(1, 'Account name is required'),
    bank: z.string().min(1, 'Bank name is required'),
    last4: z.string().regex(/^\d{4}$/, 'last4 must be exactly 4 digits'),
    accountType: z.enum(['SAVINGS', 'CURRENT', 'SALARY', 'JOINT']),
    upiIds: z.array(z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format')).optional(),
    debitCards: z.array(debitCardSchema).optional(),
    openingBalance: z.number().optional().default(0),
    isPrimary: z.boolean().optional().default(false)
});

// For update, all fields except userId and isActive are partial
const updateBankAccountSchema = createBankAccountSchema.partial();

module.exports = {
    createBankAccountSchema,
    updateBankAccountSchema
};
