const express = require('express');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccountController');

// Define standard RESTful routes for BankAccounts
router.get('/', bankAccountController.list);
router.post('/', bankAccountController.create);
router.patch('/:id', bankAccountController.update);
router.delete('/:id', bankAccountController.remove);

module.exports = router;
