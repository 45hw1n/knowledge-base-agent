const mongoose = require('mongoose');
const {
  WHATSAPP_MESSAGE_STATUS,
  WHATSAPP_MESSAGE_DIRECTION,
} = require('../constants/whatsapp.constants');

const WhatsappMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    direction: {
      type: String,
      enum: Object.values(WHATSAPP_MESSAGE_DIRECTION),
      default: WHATSAPP_MESSAGE_DIRECTION.INBOUND,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(WHATSAPP_MESSAGE_STATUS),
      default: WHATSAPP_MESSAGE_STATUS.RECEIVED,
      required: true,
      index: true,
    },
    // Kept for Phase 2+ media / extraction without forcing a migration later.
    mediaId: {
      type: String,
      default: null,
    },
    contacts: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'whatsappMessages',
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
      },
    },
  }
);

module.exports = mongoose.model('WhatsappMessage', WhatsappMessageSchema);
