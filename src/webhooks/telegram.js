// =====================================================
// AI Agent Platform - Telegram Bot Webhook Handler
// =====================================================
const express = require('express');
const router = express.Router();
const { conversations: convDb } = require('../database');
const { generateResponse } = require('../gemini');

// ---- INCOMING TELEGRAM UPDATES ----
router.post('/webhook', async (req, res) => {
  res.status(200).send('OK');

  try {
    const update = req.body;
    if (!update.message || !update.message.text) return;

    const msg = update.message;
    const chatId = msg.chat.id;
    const userMessage = msg.text;
    const senderName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || msg.from.username || 'Telegram User';

    console.log(`✈️ Telegram message from ${senderName} (${chatId}): ${userMessage}`);

    // Get business
    const business = await findBusinessForTelegram(req.query.business_id);
    if (!business) {
      console.warn('⚠️ No business found for Telegram webhook');
      return;
    }

    // Send typing action
    await sendTelegramAction(chatId, 'typing', business.telegram_bot_token);

    // Get or create conversation
    const conv = await convDb.getOrCreate(business._id, 'telegram', String(chatId), {
      name: senderName,
      username: msg.from.username,
      chat_id: chatId
    });

    // Generate AI response
    const response = await generateResponse(business, conv._id, userMessage, 'telegram');

    // Send response back
    await sendTelegramMessage(chatId, response.text, business.telegram_bot_token);

    // Emit to dashboard
    if (global.io) {
      global.io.emit('new_message', {
        channel: 'telegram',
        businessId: business._id,
        conversationId: conv._id,
        from: senderName,
        message: userMessage,
        response: response.text
      });
    }

  } catch (err) {
    console.error('❌ Telegram webhook error:', err);
  }
});

// ---- HELPER FUNCTIONS ----

async function findBusinessForTelegram(businessId) {
  const { Business, Integration } = require('../database');
  if (businessId) {
    const biz = await Business.findById(businessId).lean();
    if (biz) return biz;
  }

  const integration = await Integration.findOne({ channel: 'telegram', is_active: 1 }).lean();
  if (integration) {
    const biz = await Business.findById(integration.business_id).lean();
    if (biz) {
      try {
        const config = JSON.parse(integration.config || '{}');
        biz.telegram_bot_token = config.bot_token;
      } catch (e) {}
      return biz;
    }
  }

  return Business.findOne({ is_active: 1 }).lean();
}

async function sendTelegramAction(chatId, action, token) {
  const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  } catch (e) {}
}

async function sendTelegramMessage(chatId, text, token) {
  const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('⚠️ Telegram Bot Token not set');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      // Retry without markdown if formatting fails
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text })
      });
    }
  } catch (err) {
    console.error('❌ Telegram Send Error:', err.message);
  }
}

module.exports = router;
