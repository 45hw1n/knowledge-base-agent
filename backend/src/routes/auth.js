const express = require('express');
const passport = require('passport');
const { LOGIN_SCOPES, SHEETS_SCOPES } = require('../utils/Constants');
const router = express.Router();

// Only allow relative paths — prevents open redirect attacks.
// Rejects absolute URLs, protocol-relative URLs (//evil.com), etc.
const isValidRedirectPath = (path) =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');

// @desc    Auth with Google (primary login — minimal scopes)
// @route   GET /auth/google
router.get('/google', (req, res, next) => {
  const forceConsent = req.query.forceConsent === '1';
  const loginHint = forceConsent ? req.session?.oauthLoginHint : undefined;
  passport.authenticate('google', {
    scope: LOGIN_SCOPES,
    state: req.query.state,
    accessType: 'offline',
    prompt: forceConsent ? 'consent' : 'select_account',
    ...(loginHint && { loginHint }),
  })(req, res, next);
});

// @desc    Incremental auth — request Gmail scopes
// @route   GET /auth/google/gmail
router.get('/google/gmail', (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Must be logged in to connect Gmail' });
  }

  passport.authenticate('google', {
    scope: LOGIN_SCOPES,
    state: req.query.state,
    accessType: 'offline',
    prompt: 'select_account',
    includeGrantedScopes: true,
  })(req, res, next);
});

// @desc    Incremental auth — request Google Sheets + Drive scopes
// @route   GET /auth/google/sheets
router.get('/google/sheets', (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Must be logged in to connect Google Sheets' });
  }

  passport.authenticate('google', {
    scope: [...LOGIN_SCOPES, ...SHEETS_SCOPES],
    state: req.query.state,
    accessType: 'offline',
    loginHint: req.user.email,
    includeGrantedScopes: true,
  })(req, res, next);
});

// @desc    Google auth callback (handles login, gmail, and sheets flows)
// @route   GET /auth/google/callback
router.get(
  '/google/callback',
  (req, res, next) => {
    // Handle user cancellation — Google sends error=access_denied
    if (req.query.error) {
      console.log('[CALLBACK] OAuth error/cancellation:', req.query.error);
      return res.redirect(`${process.env.CLIENT_URL}/login`);
    }
    next();
  },
  (req, res, next) => {
    passport.authenticate('google', { session: true }, (err, user) => {
      if (err?.code === 'MISSING_REFRESH_TOKEN') {
        const retries = (req.session.oauthConsentRetries || 0) + 1;
        req.session.oauthConsentRetries = retries;

        if (retries > 1) {
          delete req.session.oauthConsentRetries;
          delete req.session.oauthLoginHint;
          return req.session.save(() => {
            res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_refresh_token`);
          });
        }

        const consentBase = `${process.env.GOOGLE_AUTH_BASE_URL}/auth/google?forceConsent=1`;
        const state = req.query.state;
        const consentUrl = isValidRedirectPath(state)
          ? `${consentBase}&state=${encodeURIComponent(state)}`
          : consentBase;
        return req.session.save(() => {
          res.redirect(consentUrl);
        });
      }

      if (err) {
        console.error('Login failed:', err);
        return next(err);
      }

      if (!user) {
        return res.redirect(`${process.env.CLIENT_URL}/login`);
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[CALLBACK] Session login error:', loginErr);
          return next(loginErr);
        }

        try {
          delete req.session.oauthConsentRetries;
          delete req.session.oauthLoginHint;

          const state = req.query.state;
          const redirectPath = isValidRedirectPath(state) ? state : '/dashboard';

          req.session.save(() => {
            return res.redirect(`${process.env.CLIENT_URL}${redirectPath}`);
          });
        } catch (error) {
          console.error('[CALLBACK] Redirect error:', error);
          req.session.save(() => {
            return res.redirect(`${process.env.CLIENT_URL}/login`);
          });
        }
      });
    })(req, res, next);
  }
);

// @desc    Logout user
// @route   POST /auth/logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});

// @desc    Get current user (safe projection — never returns tokens or internal fields)
// @route   GET /auth/current_user
router.get('/current_user', (req, res) => {
  if (!req.user) return res.json(null);
  res.json({
    id: req.user._id,
    displayName: req.user.displayName,
    email: req.user.email,
    image: req.user.image,
  });
});

module.exports = router;
