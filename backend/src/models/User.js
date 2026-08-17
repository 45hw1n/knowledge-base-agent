const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    /**
     * External auth provider user ID (Google OAuth, etc.)
     */
    providerUserId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    /**
     * Auth provider
     */
    provider: {
      type: String,
      enum: ['GOOGLE'],
      default: 'GOOGLE'
    },

    /**
     * Profile
     */
    displayName: {
      type: String,
      required: true
    },

    firstName: String,
    lastName: String,

    image: String,

    email: {
      type: String,
      index: true
    },

    /**
     * OAuth tokens (never returned by default)
     */
    refreshToken: {
      type: String,
      required: true,
      select: false
    },

    accessToken: {
      type: String,
      required: true,
      select: false
    },

    tokenExpiry: {
      type: Date,
      required: true
    },

    /**
     * OAuth scopes granted by the user
     * Stored as a map: { PROFILE: true, GMAIL_READONLY: true, ... }
     * Keys correspond to GOOGLE_SCOPES in Constants.js
     */
    grantedScopes: {
      type: [String],
      default: []
    },

    /**
     * Gmail integration state
     */
    gmailWatchExpiry: Date,
    historyId: String,

    /**
     * Set to true when Google returns invalid_grant, meaning the refresh token
     * has been revoked and the user must re-authenticate. Cleared on re-auth.
     */
    gmailAuthRevoked: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

const { GOOGLE_SCOPES } = require('../utils/Constants');

/**
 * Helper to check if a specific Google scope key is authorized by this user
 * @param {string} serviceKey - The key from GOOGLE_SCOPES (e.g., 'SPREADSHEETS')
 * @returns {boolean} 
 */
UserSchema.methods.isGoogleServiceEnabled = function (serviceKey) {
  const scopeData = GOOGLE_SCOPES[serviceKey];
  if (!scopeData) return false;
  
  return (this.grantedScopes || []).includes(scopeData.value);
};

module.exports = mongoose.model('User', UserSchema);
