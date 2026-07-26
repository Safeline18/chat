// =====================================================
// AI Agent Platform - TikTok Webhook Handler
// Handles TikTok Direct Messages and Webhook Events
// =====================================================
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { conversations: convDb } = require('../database');
const { generateResponse } = require('../gemini');

// ---- WEBHOOK VERIFICATION (TikTok Developer Webhook) ----
router.get('/webhook', (req, res) => {
  const challenge = req.query['challenge'] || req.query['hub.challenge'];
  const verifyToken = req.query['verify_token'] || req.query['hub.verify_token'];

  if (verifyToken === (process.env.TIKTOK_VERIFY_TOKEN || 'tiktok_verify_2024')) {
    console.log('✅ TikTok webhook verified successfully');
    return res.status(200).send(challenge);
  }
  
  // Return 200 with challenge if present for standard webhook setup
  if (challenge) {
    return res.status(200).send(challenge);
  }
  
  res.status(403).json({ error: 'Verification failed' });
});

// ---- INCOMING MESSAGES / EVENTS ----
router.post('/webhook', async (req, res) => {
  res.status(200).json({ code: 0, message: 'success' }); // Respond quickly to TikTok

  try {
    const body = req.body;
    console.log('🎵 TikTok Webhook Event received:', JSON.stringify(body));

    // Handle direct message events
    const event = body.event || body.type;
    const data = body.data || body;

    // Check if event is a direct message or comment
    if (event === 'direct_message' || body.message || data.message) {
      const senderId = data.sender_open_id || data.from_user_id || body.sender_id || 'tiktok_user';
      const messageText = data.text || data.content || body.message?.text;
      const businessId = req.query.business_id || data.business_id;

      if (!messageText) return;

      console.log(`🎵 TikTok message from ${senderId}: ${messageText}`);

      // Find business
      const business = await findBusinessForTikTok(businessId);
      if (!business) {
        console.warn('⚠️ No business found for TikTok webhook');
        return;
      }

      // Get or create conversation
      const conv = await convDb.getOrCreate(business._id, 'tiktok', senderId, {
        name: `TikTok User (${senderId.substring(0, 6)})`,
        platform: 'tiktok'
      });

      // Generate AI response
      const response = await generateResponse(business, conv._id, messageText, 'tiktok');

      // Send reply back to TikTok user via TikTok API
      await sendTikTokMessage(senderId, response.text, business.tiktok_access_token);

      // Notify Dashboard real-time
      if (global.io) {
        global.io.emit('new_message', {
          channel: 'tiktok',
          businessId: business._id,
          conversationId: conv._id,
          from: `TikTok @${senderId.substring(0, 8)}`,
          message: messageText,
          response: response.text
        });
      }
    }
  } catch (err) {
    console.error('❌ TikTok webhook error:', err);
  }
});

// ---- HELPER FUNCTIONS ----

async function findBusinessForTikTok(businessId) {
  const { Business, Integration } = require('../database');
  if (businessId) {
    const biz = await Business.findById(businessId).lean();
    if (biz) return biz;
  }

  // Find active TikTok integration
  const integration = await Integration.findOne({ channel: 'tiktok', is_active: 1 }).lean();
  if (integration) {
    const biz = await Business.findById(integration.business_id).lean();
    if (biz) {
      try {
        const config = JSON.parse(integration.config || '{}');
        biz.tiktok_access_token = config.access_token;
      } catch (e) {}
      return biz;
    }
  }

  // Fallback to first active business
  return Business.findOne({ is_active: 1 }).lean();
}

async function sendTikTokMessage(recipientOpenId, text, accessToken) {
  const token = accessToken || process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) {
    console.warn('⚠️ TikTok Access Token not configured. Message logged locally.');
    return;
  }

  try {
    const res = await fetch('https://open.tiktokapis.com/v2/messaging/direct_message/send/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient_open_id: recipientOpenId,
        message: {
          text: text.substring(0, 1000) // TikTok message limit
        }
      })
    });

    const data = await res.json();
    if (data.error && data.error.code !== 0) {
      console.error('❌ TikTok Send Error:', data.error);
    } else {
      console.log('✅ TikTok message sent successfully');
    }
  } catch (err) {
    console.error('❌ TikTok API call failed:', err.message);
  }
}

module.exports = router;
