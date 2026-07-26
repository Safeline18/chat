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

const app = express();
const server = http.createServer(app);

// =====================================================
// SOCKET.IO (Real-time dashboard updates)
// =====================================================
const io = new SocketServer(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST']
  }
});

global.io = io; // Make globally accessible

io.on('connection', (socket) => {
  console.log('📡 Dashboard connected:', socket.id);

  socket.on('join_business', (businessId) => {
    socket.join(`business_${businessId}`);
  });

  socket.on('disconnect', () => {
    console.log('📡 Dashboard disconnected:', socket.id);
  });
});

// =====================================================
// MIDDLEWARE
// =====================================================

// Security headers (relaxed for dashboard)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token']
}));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests' }
}));

// =====================================================
// DB CONNECTION MIDDLEWARE (SERVERLESS / VERCEL COMPATIBLE)
// =====================================================
app.use(async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      await initDatabase();
    }
  } catch (err) {
    console.error('DB middleware connection error:', err.message);
  }
  next();
});

// =====================================================
// STATIC FILES
// =====================================================
app.use(express.static(path.join(__dirname, 'public')));
app.use('/widget', express.static(path.join(__dirname, 'public/widget')));

// =====================================================
// ROUTES
// =====================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/whatsapp', whatsappWebhook);
app.use('/api/facebook', facebookWebhook);
app.use('/api/instagram', facebookWebhook); // Instagram uses same webhook
app.use('/api/tiktok', tiktokWebhook);
app.use('/api/telegram', telegramWebhook);
app.use('/api/twitter', twitterWebhook);

// Dashboard
app.get('/dashboard*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/dashboard/index.html'));
});

// Widget script endpoint (dynamic)
app.get('/widget.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/widget/chat-widget.js'));
});

// Default
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// =====================================================
// ERROR HANDLING
// =====================================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// =====================================================
// STARTUP (Only when running directly, not on Vercel)
// =====================================================
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initDatabase();
    initGemini();
    isDbInitialized = true;

    server.listen(PORT, () => {
      console.log('\n╔════════════════════════════════════════════╗');
      console.log('║       🤖 AI Agent Platform - ONLINE        ║');
      console.log('╠════════════════════════════════════════════╣');
      console.log(`║  🌐 Dashboard:  http://localhost:${PORT}/dashboard ║`);
      console.log(`║  💚 Health:     http://localhost:${PORT}/health    ║`);
      console.log(`║  📡 WebSocket:  ws://localhost:${PORT}             ║`);
      console.log('╠════════════════════════════════════════════╣');
      console.log('║  WhatsApp Webhook: /api/whatsapp/webhook   ║');
      console.log('║  Facebook Webhook: /api/facebook/webhook   ║');
      console.log('╚════════════════════════════════════════════╝\n');
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
  }
}

if (!process.env.VERCEL && require.main === module) {
  start();
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;
