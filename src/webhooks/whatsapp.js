// =====================================================
// AI Agent Platform - WhatsApp Webhook Handler
// =====================================================
const express = require('express');
const router = express.Router();
const { businesses, integrations, conversations: convDb } = require('../database');
const { generateResponse } = require('../gemini');

// ---- WEBHOOK VERIFICATION ----
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'Ruaad21';

  if (mode === 'subscribe' && (token === expectedToken || token === 'Ruaad21' || token === 'wa_verify_2024')) {
    console.log('✅ WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('❌ WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// ---- INCOMING MESSAGES ----
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Always respond 200 quickly

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;

        for (const msg of value.messages || []) {
          if (msg.type !== 'text') {
            // Handle non-text messages
            await sendWhatsAppMessage(phoneNumberId, msg.from, getUnsupportedTypeMessage(msg.type));
            continue;
          }

          const userPhone = msg.from;
          const userMessage = msg.text.body;
          const customerName = value.contacts?.[0]?.profile?.name || 'Customer';

          console.log(`📱 WhatsApp message from ${customerName} (${userPhone}): ${userMessage}`);

          // Find business by WhatsApp Phone Number ID
          const business = await findBusinessByWhatsApp(phoneNumberId);
          if (!business) {
            console.error('No business found for WhatsApp number:', phoneNumberId);
            continue;
          }

          // Get or create conversation
          const conv = await convDb.getOrCreate(business.id, 'whatsapp', userPhone, {
            name: customerName,
            phone: userPhone
          });

          // Send typing indicator
          await sendTypingIndicator(phoneNumberId, userPhone);

          // Generate AI response
          const response = await generateResponse(business, conv.id, userMessage, 'whatsapp');

          // Send response back
          await sendWhatsAppMessage(phoneNumberId, userPhone, response.text);

          // Emit to dashboard via global socket
          if (global.io) {
            global.io.emit('new_message', {
              channel: 'whatsapp',
              businessId: business.id,
              conversationId: conv.id,
              from: customerName,
              message: userMessage,
              response: response.text
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
  }
});

// ---- HELPER FUNCTIONS ----

async function findBusinessByWhatsApp(phoneNumberId) {
  const { getDb } = require('../database');
  const db = getDb();
  const integration = db.prepare(`
    SELECT i.*, b.* FROM integrations i
    JOIN businesses b ON i.business_id = b.id
    WHERE i.channel = 'whatsapp' AND i.is_active = 1
    AND json_extract(i.config, '$.phone_number_id') = ?
  `).get(phoneNumberId);

  if (integration) return integration;

  // Fallback: use any active whatsapp integration
  const fallback = db.prepare(`
    SELECT b.* FROM integrations i
    JOIN businesses b ON i.business_id = b.id
    WHERE i.channel = 'whatsapp' AND i.is_active = 1
    LIMIT 1
  `).get();

  return fallback;
}

async function sendWhatsAppMessage(phoneNumberId, to, text) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return;

  // Split long messages (WhatsApp limit: 4096 chars)
  const chunks = splitMessage(text, 4000);

  for (const chunk of chunks) {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: chunk, preview_url: false }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp send error:', error);
    }
  }
}

async function sendTypingIndicator(phoneNumberId, to) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) return;

  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: 'placeholder'
      })
    });
  } catch (e) { /* ignore typing indicator errors */ }
}

function splitMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let current = '';
  const sentences = text.split(/(?<=[.!?؟])\s+/);
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

function getUnsupportedTypeMessage(type) {
  const messages = {
    image: "Thank you for the image! Unfortunately, I can only process text messages at the moment. Please describe what you need help with. 🙏\n\nشكراً على الصورة! للأسف لا أستطيع معالجة الصور حالياً. يرجى وصف ما تحتاجه. 🙏",
    audio: "Thank you for the voice message! Please type your question so I can assist you better. 🎙️\n\nشكراً على الرسالة الصوتية! يرجى كتابة سؤالك لأتمكن من مساعدتك. 🎙️",
    video: "I received your video, but I can only process text at the moment. Please describe your question. 📹\n\nاستلمت مقطع الفيديو، لكنني أعالج النصوص فقط حالياً. يرجى وصف سؤالك. 📹",
    document: "I received your document! For document-related inquiries, please describe the issue in text. 📄\n\nاستلمت الملف! يرجى وصف المشكلة بالنص. 📄",
  };
  return messages[type] || "I can only process text messages currently. Please type your question. ✍️\n\nأعالج الرسائل النصية فقط حالياً. يرجى كتابة سؤالك. ✍️";
}

module.exports = router;
