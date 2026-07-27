// =====================================================
// AI Agent Platform - Facebook & Instagram Webhook
// =====================================================
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { conversations: convDb } = require('../database');
const { generateResponse } = require('../gemini');

// ---- WEBHOOK VERIFICATION (Facebook & Instagram) ----
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log('✅ Facebook/Instagram webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ---- VERIFY SIGNATURE ----
function verifySignature(req) {
  if (!process.env.FACEBOOK_APP_SECRET) return true; // Skip in dev
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.FACEBOOK_APP_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ---- INCOMING MESSAGES ----
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Always respond 200 quickly

  if (!verifySignature(req)) {
    console.error('❌ Invalid Facebook signature');
    return;
  }

  try {
    const body = req.body;

    // Facebook Messenger
    if (body.object === 'page') {
      await handleFacebookMessages(body);
    }

    // Instagram
    if (body.object === 'instagram') {
      await handleInstagramMessages(body);
    }

  } catch (err) {
    console.error('Facebook/Instagram webhook error:', err);
  }
});

// ---- FACEBOOK MESSENGER ----
async function handleFacebookMessages(body) {
  for (const entry of body.entry || []) {
    const pageId = entry.id;

    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const messageText = event.message.text;

      if (!messageText) continue;

      console.log(`💬 Facebook message from ${senderId}: ${messageText}`);

      // Find business by page ID
      const business = await findBusinessByPage(pageId, 'facebook');
      if (!business) continue;

      // Get sender profile
      const senderName = await getFacebookUserName(senderId, business.page_access_token);

      // Get or create conversation
      const conv = await convDb.getOrCreate(business.id, 'facebook', senderId, { name: senderName });

      // Show typing indicator
      await sendFacebookTyping(pageId, senderId, business.page_access_token);

      // Generate response
      const response = await generateResponse(business, conv.id, messageText, 'facebook');

      // Send reply
      await sendFacebookMessage(pageId, senderId, response.text, business.page_access_token);

      // Emit to dashboard
      if (global.io) {
        global.io.emit('new_message', {
          channel: 'facebook',
          businessId: business.id,
          conversationId: conv.id,
          from: senderName,
          message: messageText,
          response: response.text
        });
      }
    }
  }
}

// ---- INSTAGRAM ----
async function handleInstagramMessages(body) {
  for (const entry of body.entry || []) {
    const igAccountId = entry.id;

    for (const event of entry.messaging || []) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const messageText = event.message.text;

      if (!messageText) continue;

      console.log(`📸 Instagram DM from ${senderId}: ${messageText}`);

      const business = await findBusinessByPage(igAccountId, 'instagram');
      if (!business) continue;

      const conv = await convDb.getOrCreate(business.id, 'instagram', senderId, {});

      // Generate response
      const response = await generateResponse(business, conv.id, messageText, 'instagram');

      // Send reply via Instagram API
      await sendInstagramMessage(igAccountId, senderId, response.text, business.page_access_token);

      if (global.io) {
        global.io.emit('new_message', {
          channel: 'instagram',
          businessId: business.id,
          conversationId: conv.id,
          from: `IG_${senderId.slice(-6)}`,
          message: messageText,
          response: response.text
        });
      }
    }
  }
}

// ---- API FUNCTIONS ----

async function findBusinessByPage(pageId, channel) {
  try {
    const { getDb } = require('../database');
    const db = getDb();
    const integration = db.prepare(`
      SELECT b.*, json_extract(i.config, '$.page_access_token') as page_access_token
      FROM integrations i
      JOIN businesses b ON i.business_id = b.id
      WHERE i.channel = ? AND i.is_active = 1
      AND json_extract(i.config, '$.page_id') = ?
      LIMIT 1
    `).get(channel, pageId);
    return integration;
  } catch { return null; }
}

async function getFacebookUserName(userId, accessToken) {
  if (!accessToken) return 'Customer';
  try {
    const res = await fetch(`https://graph.facebook.com/${userId}?fields=name&access_token=${accessToken}`);
    const data = await res.json();
    return data.name || 'Customer';
  } catch { return 'Customer'; }
}

async function sendFacebookTyping(pageId, recipientId, accessToken) {
  if (!accessToken) return;
  try {
    await fetch(`https://graph.facebook.com/v19.0/${pageId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: 'typing_on'
      })
    });
    // Small delay to show typing
    await new Promise(resolve => setTimeout(resolve, 1500));
  } catch (e) { }
}

async function sendFacebookMessage(pageId, recipientId, text, accessToken) {
  if (!accessToken) { console.warn('No Facebook access token'); return; }

  const chunks = splitMessage(text, 2000);
  for (const chunk of chunks) {
    await fetch(`https://graph.facebook.com/v19.0/${pageId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: chunk }
      })
    });
  }
}

async function sendInstagramMessage(accountId, recipientId, text, accessToken) {
  if (!accessToken) return;
  try {
    await fetch(`https://graph.facebook.com/v19.0/${accountId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text.substring(0, 1000) } // Instagram limit
      })
    });
  } catch (err) {
    console.error('Instagram send error:', err);
  }
}

function splitMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}

module.exports = router;
