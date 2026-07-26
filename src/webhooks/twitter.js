// =====================================================
// AI Agent Platform - Twitter / X Direct Message Webhook
// =====================================================
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { conversations: convDb } = require('../database');
const { generateResponse } = require('../gemini');

// ---- CRC VERIFICATION (Twitter Account Activity API) ----
router.get('/webhook', (req, res) => {
  const crcToken = req.query.crc_token;
  if (crcToken) {
    const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || 'twitter_secret_2024';
    const hmac = crypto.createHmac('sha256', consumerSecret).update(crcToken).digest('base64');
    return res.status(200).json({ response_token: 'sha256=' + hmac });
  }
  res.status(400).send('Error: crc_token missing');
});

// ---- INCOMING DM EVENTS ----
router.post('/webhook', async (req, res) => {
  res.status(200).send('200 OK');

  try {
    const body = req.body;
    if (!body.direct_message_events) return;

    for (const event of body.direct_message_events) {
      if (event.type !== 'message_create') continue;

      const messageData = event.message_create;
      const senderId = messageData.sender_id;
      const text = messageData.message_data.text;

      // Ignore messages sent by bot itself
      if (senderId === body.for_user_id) continue;

      console.log(`🐦 Twitter DM from ${senderId}: ${text}`);

      const business = await findBusinessForTwitter(req.query.business_id);
      if (!business) continue;

      const conv = await convDb.getOrCreate(business._id, 'twitter', senderId, {
        name: `Twitter User (${senderId})`
      });

      const response = await generateResponse(business, conv._id, text, 'twitter');

      await sendTwitterDM(senderId, response.text, business.twitter_bearer_token);

      if (global.io) {
        global.io.emit('new_message', {
          channel: 'twitter',
          businessId: business._id,
          conversationId: conv._id,
          from: `@user_${senderId.slice(-4)}`,
          message: text,
          response: response.text
        });
      }
    }
  } catch (err) {
    console.error('❌ Twitter Webhook Error:', err);
  }
});

async function findBusinessForTwitter(businessId) {
  const { Business, Integration } = require('../database');
  if (businessId) return Business.findById(businessId).lean();
  const integration = await Integration.findOne({ channel: 'twitter', is_active: 1 }).lean();
  if (integration) return Business.findById(integration.business_id).lean();
  return Business.findOne({ is_active: 1 }).lean();
}

async function sendTwitterDM(recipientId, text, bearerToken) {
  const token = bearerToken || process.env.TWITTER_BEARER_TOKEN;
  if (!token) return;

  try {
    await fetch('https://api.twitter.com/2/direct_messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        participant_id: recipientId,
        text: text.substring(0, 1000)
      })
    });
  } catch (e) {
    console.error('❌ Twitter Send DM error:', e.message);
  }
}

module.exports = router;
