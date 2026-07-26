// =====================================================
// AI Agent Platform - Chat API Routes (Async MongoDB)
// =====================================================
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { businesses, conversations: convDb } = require('../database');
const { generateStreamingResponse, generateResponse, calculateTypingDelay } = require('../gemini');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many messages. Please slow down.' }
});

// ---- SEND MESSAGE ----
router.post('/message', chatLimiter, async (req, res) => {
  try {
    const { businessId, conversationId, message, customerName, customerEmail } = req.body;
    if (!businessId || !message?.trim()) {
      return res.status(400).json({ error: 'businessId and message are required' });
    }

    const business = await businesses.getById(businessId);
    if (!business || !business.is_active) {
      return res.status(404).json({ error: 'Business not found or inactive' });
    }

    const channelUserId = conversationId || `widget_${req.ip}_${Date.now()}`;
    const conv = await convDb.getOrCreate(businessId, 'widget', channelUserId, {
      name: customerName,
      email: customerEmail,
      ip: req.ip
    });

    const response = await generateResponse(business, conv._id, message.trim(), 'widget');

    res.json({
      success: true,
      conversationId: conv._id,
      message: response.text,
      language: response.language,
      typing_delay: calculateTypingDelay(response.text)
    });

  } catch (err) {
    console.error('Chat error:', err.message);
    const { findKbFallback } = require('../gemini');
    const fallbackText = findKbFallback(req.body.business || {}, req.body.message || '', 'ar');
    res.json({
      success: true,
      conversationId: req.body.conversationId || `conv_${Date.now()}`,
      message: fallbackText,
      language: 'ar',
      typing_delay: 800
    });
  }
});

// ---- STREAMING MESSAGE ----
router.post('/stream', chatLimiter, async (req, res) => {
  try {
    const { businessId, conversationId, message, customerName } = req.body;
    if (!businessId || !message?.trim()) {
      return res.status(400).json({ error: 'businessId and message are required' });
    }

    const business = await businesses.getById(businessId);
    if (!business || !business.is_active) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const channelUserId = conversationId || `widget_${req.ip}_${Date.now()}`;
    const conv = await convDb.getOrCreate(businessId, 'widget', channelUserId, {
      name: customerName,
      ip: req.ip
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Conversation-Id': conv._id
    });

    res.write(`data: ${JSON.stringify({ type: 'start', conversationId: conv._id })}\n\n`);

    await generateStreamingResponse(
      business,
      conv._id,
      message.trim(),
      (chunk) => res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`),
      'widget'
    );

    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Generation failed' })}\n\n`);
      res.end();
    }
  }
});

// ---- GET HISTORY ----
router.get('/history/:conversationId', async (req, res) => {
  try {
    const { conversations: convDb, messages: msgDb } = require('../database');
    const conv = await convDb.getById(req.params.conversationId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const msgs = await msgDb.getByConversation(req.params.conversationId, 50);
    res.json({
      conversation: { id: conv._id, status: conv.status, language: conv.language_detected },
      messages: msgs.map(m => ({ id: m._id, role: m.role, content: m.content, created_at: m.created_at }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- BUSINESS CONFIG (for widget) ----
router.get('/config/:businessId', async (req, res) => {
  try {
    const business = await businesses.getById(req.params.businessId);
    if (!business || !business.is_active) {
      return res.status(404).json({ error: 'Business not found' });
    }
    res.json({
      id: business._id,
      name: business.name,
      name_ar: business.name_ar,
      agent_name: business.agent_name,
      agent_name_ar: business.agent_name_ar,
      welcome_message: business.welcome_message,
      welcome_message_ar: business.welcome_message_ar,
      avatar_url: business.avatar_url,
      primary_color: business.primary_color,
      secondary_color: business.secondary_color,
      language: business.language,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
