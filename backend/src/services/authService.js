/**
 * Authentication Service
 * Handles core authentication logic for GraphQL endpoints.
 */

/**
 * Returns the Google Catch-all OAuth URL
 * @param {Object} req - Express request object
 * @returns {string} - Full URL to trigger Google OAuth
 */
const getGoogleLoginUrl = (req) => {
    const url = `${process.env.GOOGLE_AUTH_BASE_URL}/auth/google`;
    return url;
};

/**
 * Logs out the user and destroys the session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<boolean>}
 */
const logout = (req, res) => {
    return new Promise((resolve, reject) => {
        // 1. Passport logout
        req.logout((err) => {
            if (err) return reject(err);

            // 2. Destroy session
            req.session.destroy((err) => {
                if (err) return reject(err);

                // 3. Clear cookie
                res.clearCookie('connect.sid');
                resolve(true);
            });
        });
    });
};

/**
 * Returns the currently authenticated user
 * @param {Object} req - Express request object
 * @returns {Object|null}
 */
const getCurrentUser = (req) => {
    return req.user || null;
};

module.exports = {
    getGoogleLoginUrl,
    logout,
    getCurrentUser
};
