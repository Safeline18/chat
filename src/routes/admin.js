// =====================================================
// AI Agent Platform - Admin API Routes (Async MongoDB)
// =====================================================
const express = require('express');
const router = express.Router();
const { businesses, integrations, conversations, messages, analytics } = require('../database');

// Simple auth middleware
function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  const adminSecret = process.env.ADMIN_SECRET || 'admin123';
  if (token !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireAuth);

// ---- OVERVIEW ----
router.get('/overview', async (req, res) => {
  try {
    res.json(await analytics.getOverview());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- BUSINESSES ----
router.get('/businesses', async (req, res) => {
  try {
    const list = await businesses.getAll();
    const normalized = list.map(b => ({ ...b, id: b._id || b.id }));
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/businesses/:id', async (req, res) => {
  try {
    const b = await businesses.getById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Business not found' });
    const [stats, ints] = await Promise.all([
      businesses.getStats(req.params.id),
      integrations.getByBusiness(req.params.id)
    ]);
    const normalizedInts = ints.map(i => ({ ...i, id: i._id || i.id }));
    res.json({ ...b, id: b._id || b.id, stats, integrations: normalizedInts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/businesses', async (req, res) => {
  try {
    if (!req.body.name && !req.body.name_ar) {
      return res.status(400).json({ error: 'name is required' });
    }
    const data = {
      name: req.body.name || req.body.name_ar,
      name_ar: req.body.name_ar,
      description: req.body.description,
      description_ar: req.body.description_ar,
      industry: req.body.industry || 'general',
      agent_name: req.body.agent_name || 'Assistant',
      agent_name_ar: req.body.agent_name_ar || 'المساعد',
      system_prompt: req.body.system_prompt,
      welcome_message: req.body.welcome_message || 'Hello! How can I help you today? 😊',
      welcome_message_ar: req.body.welcome_message_ar || 'أهلاً! كيف يمكنني مساعدتك اليوم؟ 😊',
      avatar_url: req.body.avatar_url,
      primary_color: req.body.primary_color || '#6C63FF',
      secondary_color: req.body.secondary_color || '#4ECDC4',
      language: req.body.language || 'auto',
      knowledge_base: req.body.knowledge_base || [],
      escalation_email: req.body.escalation_email,
    };

    const b = await businesses.create(data);
    // Auto-create widget integration
    await integrations.upsert(b._id, 'widget', {}, true);
    res.status(201).json(b);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/businesses/:id', async (req, res) => {
  try {
    const b = await businesses.getById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Business not found' });

    const allowed = ['name', 'name_ar', 'description', 'description_ar', 'industry', 'agent_name', 'agent_name_ar',
      'system_prompt', 'welcome_message', 'welcome_message_ar', 'avatar_url', 'primary_color', 'secondary_color',
      'language', 'escalation_email', 'is_active', 'knowledge_base'];

    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    const updated = await businesses.update(req.params.id, data);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/businesses/:id', async (req, res) => {
  try {
    await businesses.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- SCRAPE WEBSITE FOR BUSINESS ----
router.post('/businesses/:id/scrape', async (req, res) => {
  try {
    const { websiteUrl } = req.body;
    if (!websiteUrl) return res.status(400).json({ error: 'websiteUrl is required' });

    const b = await businesses.getById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Business not found' });

    const { scrapeWebsite } = require('../utils/scraper');
    const scrapedData = await scrapeWebsite(websiteUrl);

    let existingKb = [];
    try {
      existingKb = typeof b.knowledge_base === 'string' ? JSON.parse(b.knowledge_base || '[]') : (b.knowledge_base || []);
    } catch (e) {}

    const newKb = [...existingKb, ...scrapedData.kbItems];
    const updated = await businesses.update(req.params.id, {
      description: scrapedData.summary || b.description,
      description_ar: scrapedData.summary || b.description_ar,
      knowledge_base: JSON.stringify(newKb)
    });

    res.json({ success: true, count: scrapedData.kbItems.length, business: updated });
  } catch (err) {
    console.error('Scrape error:', err);
    res.status(500).json({ error: 'Scraping failed: ' + err.message });
  }
});

router.get('/businesses/:id/stats', async (req, res) => {
  try {
    res.json(await businesses.getStats(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- INTEGRATIONS ----
router.put('/businesses/:id/integrations/:channel', async (req, res) => {
  try {
    const b = await businesses.getById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Business not found' });

    const validChannels = ['widget', 'whatsapp', 'facebook', 'instagram', 'twitter', 'tiktok', 'telegram'];
    if (!validChannels.includes(req.params.channel)) {
      return res.status(400).json({ error: 'Invalid channel' });
    }

    const integration = await integrations.upsert(
      req.params.id,
      req.params.channel,
      req.body.config || {},
      req.body.is_active !== false
    );
    res.json(integration);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- CONVERSATIONS ----
router.get('/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const list = await conversations.getAll(limit, offset);
    res.json(list.map(c => ({ ...c, id: c._id || c.id })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/businesses/:id/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;
    const list = await conversations.getByBusiness(req.params.id, limit, offset, status);
    res.json(list.map(c => ({ ...c, id: c._id || c.id })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const conv = await conversations.getById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const msgs = await messages.getByConversation(req.params.id, 100);
    const normalizedConv = { ...conv, id: conv._id || conv.id };
    const normalizedMsgs = msgs.map(m => ({ ...m, id: m._id || m.id }));
    res.json({ conversation: normalizedConv, messages: normalizedMsgs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/conversations/:id/status', async (req, res) => {
  try {
    const validStatuses = ['active', 'resolved', 'escalated', 'waiting'];
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await conversations.updateStatus(req.params.id, req.body.status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
