const { z } = require('zod');

const createCreditCardSchema = z.object({
    name: z.string().trim().min(1, 'Name is required'),
    bank: z.string().trim().min(1, 'Bank is required'),
    last4: z.string().trim().regex(/^\d{4}$/, 'last4 must be exactly 4 digits'),
    expiryMonth: z.number().int().min(1).max(12),
    expiryYear: z.number().int().min(new Date().getFullYear(), 'Expiry year cannot be in the past'),
    network: z.enum(['VISA', 'MASTERCARD', 'RUPAY', 'AMEX']).optional().nullable(),
    billingCycleDay: z.number().int().min(1).max(31),
    dueDateDay: z.number().int().min(1).max(31),
    creditLimit: z.number().positive('Credit limit must be positive').nullable().optional(),
    linkedBankAccountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId').nullable().optional()
});

const updateCreditCardSchema = createCreditCardSchema.partial();

module.exports = {
    createCreditCardSchema,
    updateCreditCardSchema
};
