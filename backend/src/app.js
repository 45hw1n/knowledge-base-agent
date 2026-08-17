const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');

const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhook');
const whatsappRoutes = require('./whatsapp/routes/whatsappRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://dev.fynverse.app",
  "https://dev.fynverse.app:5173",
  "https://fynverse.app",
];

if (process.env.CLIENT_URL && !allowedOrigins.includes(process.env.CLIENT_URL)) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

console.log("CORS allowedOrigins:", allowedOrigins);


// Passport config
require('./config/passport')(passport);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("CORS BLOCKED → Origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// JSON parser
app.use(express.json());

// Webhooks first (raw body if needed)
app.use('/webhook', webhookRoutes);
app.use('/webhooks', whatsappRoutes);

// Health check
app.get('/health', (req, res) => {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  console.log(`Health endpoint pinged by "Monitor" at "${formatted}"`);
  res.sendStatus(200);
});

// Trust proxy (for Render / reverse proxy)
app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

const isProd = process.env.NODE_ENV === 'production';

// Sessions
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,              // always true (all envs are HTTPS now)
    sameSite: 'none',          // always needed for cross-subdomain
    domain: '.fynverse.app',   // critical for sharing across subdomains
    maxAge: Number(process.env.SESSION_MAX_AGE) || 604800000
  },
};

console.log("SESSION CONFIG:", {
  cookie: sessionConfig.cookie,
  proxy: app.get("trust proxy"),
  nodeEnv: process.env.NODE_ENV
});

app.use(session(sessionConfig));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Debug session
if (process.env.SESSION_DEBUG === "true") {
  app.use((req, res, next) => {
    console.log('\n[SESSION DEBUG]');
    console.log(`path: ${req.path}`);
    console.log(`sessionID: ${req.sessionID}`);
    console.log(`hasSession: ${!!req.session}`);
    console.log(`hasUser: ${!!req.user}`);
    next();
  });
}

// REST Routes
app.use('/auth', authRoutes);
app.use('/api/ai', aiRoutes);

app.get('/', (req, res) => {
  if (!req.user) return res.send('API is running...');
  res.json({ id: req.user._id, displayName: req.user.displayName });
});

module.exports = app;