const express = require('express');
const passport = require('passport');
const AppStatus = require('../models/AppStatus');
const router = express.Router();

// @desc    Auth with Google
// @route   GET /auth/google
router.get('/google', (req, res, next) => {
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/spreadsheets'
    ],
    state: req.query.state,
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true
  })(req, res, next);
});

// @desc    Google auth callback
// @route   GET /auth/google/callback



router.get(
  "/google/callback",
  (req, res, next) => {
    console.log("🔵 [CALLBACK START]");
    console.log("Query:", req.query);
    console.log("Headers origin:", req.headers.origin);
    next();
  },
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res, next) => {
    console.log("🟢 [AFTER PASSPORT]");
    console.log("User:", req.user?._id || "Unknown");
    console.log("Session AFTER passport:", req.session);
    console.log("Session ID:", req.sessionID);
    next();
  },
  async (req, res) => {
    try {
      console.log("🟣 [BEFORE REDIRECT]");
      console.log("Set-Cookie header:", res.getHeaders()["set-cookie"]);

      const appStatus = await AppStatus.findOne({ userId: req.user._id });
      const onboarded = appStatus ? appStatus.onboarded : false;
      const allowedOrigins = [
        'https://dev.fynverse.app:5173',
        'http://dev.fynverse.app:5173',
        'https://dev.fynverse.app',
        'http://localhost:5173'
      ];
      const stateRedirect = req.query.state;
      let baseUrl = process.env.CLIENT_URL;
      console.log(stateRedirect, 'ash:: stateRedirect')
      if (stateRedirect) {
        const url = new URL(stateRedirect);
        if (allowedOrigins.includes(url.origin)) {
          baseUrl = url.origin;
        }
      }

      console.log(baseUrl, 'ash:: baseUrl');

      // ✅ CRITICAL FIX
      req.session.save(() => {
        // FOR BETA
        return res.redirect(`${baseUrl}/home`);
        // if (onboarded) {
        //   return res.redirect(`${baseUrl}/home`);
        // }
        // return res.redirect(`${baseUrl}/onboarding`);
      });

    } catch (error) {
      console.error('Error in Google OAuth callback redirection:', error);
      req.session.save(() => {
        return res.redirect(`${process.env.CLIENT_URL}/auth_error`);
      });
    }
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
