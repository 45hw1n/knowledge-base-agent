const bankAccountService = require('../services/bankAccountService');
const { createBankAccountSchema, updateBankAccountSchema } = require('../validations/bankAccountValidation');
const { ZodError } = require('zod');

const sendSuccess = (res, data, statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        data
    });
};

const sendError = (res, error, statusCode = 400) => {
    let errorCode = 'BAD_REQUEST';
    let message = error.message;

    if (error instanceof ZodError) {
        errorCode = 'VALIDATION_ERROR';
        message = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
    } else if (error.message === 'Account not found') {
        errorCode = 'NOT_FOUND';
        statusCode = 404;
    }

    res.status(statusCode).json({
        success: false,
        error: {
            code: errorCode,
            message
        }
    });
};

const create = async (req, res) => {
    try {
        const parsedBody = createBankAccountSchema.parse(req.body);
        const account = await bankAccountService.createBankAccount(req.user._id, parsedBody);
        
        sendSuccess(res, account, 201);
    } catch (error) {
        sendError(res, error);
    }
};

const update = async (req, res) => {
    try {
        const parsedBody = updateBankAccountSchema.parse(req.body);
        const { id } = req.params;
        
        const account = await bankAccountService.updateBankAccount(req.user._id, id, parsedBody);
        
        sendSuccess(res, account, 200);
    } catch (error) {
        sendError(res, error);
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        await bankAccountService.deleteBankAccount(req.user._id, id);
        
        sendSuccess(res, null, 200);
    } catch (error) {
        sendError(res, error);
    }
};

const list = async (req, res) => {
    try {
        const accounts = await bankAccountService.getBankAccounts(req.user._id);
        
        sendSuccess(res, accounts, 200);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch bank accounts'
            }
        });
    }
};

module.exports = {
    create,
    update,
    remove,
    list
};
