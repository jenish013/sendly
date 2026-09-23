const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    if (process.env.NODE_ENV === 'production') {
      const allowed = process.env.CLIENT_URL || 'http://localhost:5173'
      if (!origin || origin === allowed) return callback(null, true)
      return callback(new Error('Not allowed by CORS'), false)
    }
    if (!origin) return callback(null, true)
    const allowedHosts = ['localhost', '127.0.0.1', '0.0.0.0']
    try {
      const url = new URL(origin)
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.trycloudflare.com')) {
        return callback(null, true)
      }
    } catch {}
    if (allowedHosts.includes(origin)) return callback(null, true)
    callback(null, true)
  },
  credentials: true,
  optionsSuccessStatus: 200
};

const isDev = process.env.NODE_ENV !== 'production';

app.use(cors(corsOptions));
app.use(helmet());

// Explicitly skip body parsing for multipart/form-data uploads
// (multer handles these, and body-parser can reject large Content-Lengths)
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) {
    req._body = true;
    req.body = {};
  }
  next();
});

app.use(mongoSanitize());
app.use(xss());
app.use(cookieParser());
app.use(express.json({ limit: isDev ? '500mb' : '10mb', type: 'application/json' }));
app.use(express.urlencoded({ extended: true, limit: isDev ? '500mb' : '10mb' }));

app.use((req, res, next) => {
  res.setTimeout(10 * 60 * 1000);
  next();
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use('/api/v1', routes);

const uploadsDir = path.join(__dirname, '..', 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'sendly-backend',
      timestamp: new Date().toISOString()
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

app.use(errorHandler);

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, { stack: err.stack });
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

module.exports = app;
