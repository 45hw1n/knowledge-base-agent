const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/', chatController.createConversation);
router.get('/', chatController.listConversations);
router.post('/:conversationId/messages', chatController.postMessage);
router.get('/:conversationId/messages', chatController.getMessages);
router.get('/:conversationId/messages/:messageId/status', chatController.getMessageStatus);

module.exports = router;
