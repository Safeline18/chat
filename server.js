// =====================================================
// AI Agent Platform - Main Server
// =====================================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { initDatabase } = require('./src/database');
const { initGemini } = require('./src/gemini');

const adminRoutes = require('./src/routes/admin');
const chatRoutes = require('./src/routes/chat');

const whatsappWebhook = require('./src/webhooks/whatsapp');
const facebookWebhook = require('./src/webhooks/facebook');
const tiktokWebhook = require('./src/webhooks/tiktok');
const telegramWebhook = require('./src/webhooks/telegram');
const twitterWebhook = require('./src/webhooks/twitter');

// =====================================================
// APP
// =====================================================

const app = express();
const server = http.createServer(app);

// =====================================================
// SOCKET.IO
// =====================================================

const socketAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  : [
      'https://www.safelinescc.sa',
      'https://safelinescc.sa',
      'https://chat-eta-gray.vercel.app'
    ];

const io = new SocketServer(server, {
  cors: {
    origin: socketAllowedOrigins,
    methods: ['GET', 'POST']
  }
});

global.io = io;

io.on('connection', (socket) => {
  console.log('📡 Dashboard connected:', socket.id);

  socket.on('join_business', (businessId) => {
    if (businessId) {
      socket.join(`business_${businessId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('📡 Dashboard disconnected:', socket.id);
  });
});

// =====================================================
// SECURITY
// =====================================================

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

// =====================================================
// CORS
// =====================================================

// الدومينات المسموح لها باستخدام الـ API
const allowedOrigins = [
  'https://www.safelinescc.sa',
  'https://safelinescc.sa',
  'https://chat-eta-gray.vercel.app',

  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
    : [])
];

// إزالة التكرار
const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

app.use(
  cors({
    origin: function (origin, callback) {
      // السماح بالطلبات التي لا تحتوي Origin
      // مثل بعض server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      // السماح للدومينات المسجلة
      if (uniqueAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // السماح بالـ localhost أثناء التطوير
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }

      console.warn('⚠️ CORS blocked origin:', origin);

      return callback(new Error('Not allowed by CORS'));
    },

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Admin-Token',
      'Accept'
    ],

    credentials: false,

    optionsSuccessStatus: 204
  })
);

// Preflight
app.options('*', cors());

// =====================================================
// LOGGING
// =====================================================

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// =====================================================
// BODY PARSER
// =====================================================

app.use(
  express.json({
    limit: '10mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb'
  })
);

// =====================================================
// RATE LIMIT
// =====================================================

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,

    message: {
      error: 'Too many requests'
    },

    standardHeaders: true,
    legacyHeaders: false
  })
);

// =====================================================
// DATABASE CONNECTION
// SERVERLESS / VERCEL COMPATIBLE
// =====================================================

app.use(async (req, res, next) => {
  try {
    const mongoose = require('mongoose');

    if (mongoose.connection.readyState !== 1) {
      await initDatabase();
    }

    next();
  } catch (err) {
    console.error(
      '❌ DB middleware connection error:',
      err.message
    );

    // لا نوقف الطلب مباشرة بسبب فشل DB
    // لأن بعض المسارات قد لا تحتاج DB
    next();
  }
});

// =====================================================
// STATIC FILES
// =====================================================

const publicPath = path.join(__dirname, 'public');
const widgetPath = path.join(__dirname, 'public', 'widget');

app.use(
  express.static(publicPath, {
    crossOriginResourcePolicy: false
  })
);

app.use(
  '/widget',
  express.static(widgetPath, {
    crossOriginResourcePolicy: false,
    setHeaders: (res) => {
      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      );

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, OPTIONS'
      );

      res.setHeader(
        'Access-Control-Allow-Headers',
        '*'
      );

      res.setHeader(
        'Cross-Origin-Resource-Policy',
        'cross-origin'
      );
    }
  })
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// =====================================================
// API ROUTES
// =====================================================

app.use('/api/admin', adminRoutes);

app.use('/api/chat', chatRoutes);

app.use(
  '/api/whatsapp',
  whatsappWebhook
);

app.use(
  '/api/facebook',
  facebookWebhook
);

// Instagram uses the same Meta webhook
app.use(
  '/api/instagram',
  facebookWebhook
);

app.use(
  '/api/tiktok',
  tiktokWebhook
);

app.use(
  '/api/telegram',
  telegramWebhook
);

app.use(
  '/api/twitter',
  twitterWebhook
);

// =====================================================
// DASHBOARD
// =====================================================

app.get('/dashboard*', (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      'public',
      'dashboard',
      'index.html'
    )
  );
});

// =====================================================
// WIDGET SCRIPT
// =====================================================

// الرابط:
// https://chat-eta-gray.vercel.app/widget.js

app.get('/widget.js', (req, res) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Cross-Origin-Resource-Policy',
    'cross-origin'
  );

  res.setHeader(
    'Content-Type',
    'application/javascript; charset=utf-8'
  );

  res.sendFile(
    path.join(
      __dirname,
      'public',
      'widget',
      'chat-widget.js'
    )
  );
});

// =====================================================
// WIDGET CHAT-WIDGET.JS
// =====================================================

// الرابط:
// https://chat-eta-gray.vercel.app/widget/chat-widget.js

app.get('/widget/chat-widget.js', (req, res) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    '*'
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    '*'
  );

  res.setHeader(
    'Cross-Origin-Resource-Policy',
    'cross-origin'
  );

  res.setHeader(
    'Content-Type',
    'application/javascript; charset=utf-8'
  );

  res.sendFile(
    path.join(
      __dirname,
      'public',
      'widget',
      'chat-widget.js'
    )
  );
});

// =====================================================
// ROOT
// =====================================================

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// =====================================================
// ERROR HANDLING
// =====================================================

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);

  // معالجة أخطاء CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS origin not allowed',
      origin: req.headers.origin || null
    });
  }

  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message
  });
});

// =====================================================
// 404
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// =====================================================
// SERVER STARTUP
// =====================================================

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDatabase();

    initGemini();

    server.listen(PORT, () => {
      console.log('');
      console.log(
        '╔════════════════════════════════════════════╗'
      );
      console.log(
        '║       🤖 AI Agent Platform - ONLINE        ║'
      );
      console.log(
        '╠════════════════════════════════════════════╣'
      );
      console.log(
        `║ 🌐 Dashboard: http://localhost:${PORT}/dashboard`
      );
      console.log(
        `║ 💚 Health:    http://localhost:${PORT}/health`
      );
      console.log(
        `║ 📡 WebSocket: ws://localhost:${PORT}`
      );
      console.log(
        '╠════════════════════════════════════════════╣'
      );
      console.log(
        '║ WhatsApp Webhook: /api/whatsapp/webhook    ║'
      );
      console.log(
        '║ Facebook Webhook: /api/facebook/webhook    ║'
      );
      console.log(
        '╚════════════════════════════════════════════╝'
      );
      console.log('');
    });

  } catch (err) {
    console.error(
      '❌ Failed to start server:',
      err.message
    );
  }
}

// تشغيل السيرفر محليًا فقط
if (
  !process.env.VERCEL &&
  require.main === module
) {
  start();
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = app;
module.exports.app = app;
module.exports.server = server;
