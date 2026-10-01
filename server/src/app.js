const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('./config/env');
const { notFound, errorHandler } = require('./middlewares/error');
const coreRoutes = require('./routes/core.routes');
const integrityRoutes = require('./routes/integrity.routes');

const app = express();

app.set('trust proxy', 1); // behind Render's proxy
app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(mongoSanitize()); // strips $ and . operators from user input
if (!config.isProd) app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' },
    }),
});
app.use('/api/v1/auth', authLimiter);

app.use('/api/v1', coreRoutes);
app.use('/api/v1', integrityRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
