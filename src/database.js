// =====================================================
// AI Agent Platform - MongoDB Database Manager
// Using Mongoose ODM
// =====================================================
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// =====================================================
// SCHEMAS
// =====================================================

const BusinessSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  name: { type: String, required: true },
  name_ar: String,
  description: String,
  description_ar: String,
  industry: { type: String, default: 'general' },
  agent_name: { type: String, default: 'Assistant' },
  agent_name_ar: { type: String, default: 'المساعد' },
  system_prompt: String,
  welcome_message: { type: String, default: 'Hello! How can I help you today? 😊' },
  welcome_message_ar: { type: String, default: 'أهلاً! كيف يمكنني مساعدتك اليوم؟ 😊' },
  avatar_url: String,
  primary_color: { type: String, default: '#6C63FF' },
  secondary_color: { type: String, default: '#4ECDC4' },
  language: { type: String, default: 'auto' },
  knowledge_base: { type: String, default: '[]' },
  working_hours: { type: Object, default: { enabled: false } },
  escalation_email: String,
  is_active: { type: Number, default: 1 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const IntegrationSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  business_id: { type: String, required: true, ref: 'Business' },
  channel: { type: String, enum: ['widget', 'whatsapp', 'facebook', 'instagram', 'twitter', 'tiktok', 'telegram'], required: true },
  config: { type: String, default: '{}' },
  is_active: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at' } });

IntegrationSchema.index({ business_id: 1, channel: 1 }, { unique: true });

const ConversationSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  business_id: { type: String, required: true, ref: 'Business' },
  channel: { type: String, required: true },
  channel_user_id: { type: String, required: true },
  customer_name: String,
  customer_phone: String,
  customer_email: String,
  metadata: { type: String, default: '{}' },
  status: { type: String, enum: ['active', 'resolved', 'escalated', 'waiting'], default: 'active' },
  sentiment: { type: String, default: 'neutral' },
  language_detected: { type: String, default: 'auto' },
  message_count: { type: Number, default: 0 },
  last_message: String,
  last_message_at: { type: Date, default: Date.now },
  assigned_to: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

ConversationSchema.index({ business_id: 1, status: 1 });
ConversationSchema.index({ business_id: 1, channel: 1, channel_user_id: 1 });
ConversationSchema.index({ last_message_at: -1 });

const MessageSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  conversation_id: { type: String, required: true, ref: 'Conversation' },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  metadata: { type: String, default: '{}' },
}, { timestamps: { createdAt: 'created_at' } });

MessageSchema.index({ conversation_id: 1, created_at: 1 });

const AnalyticsSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  business_id: { type: String, ref: 'Business' },
  event_type: String,
  channel: String,
  data: { type: String, default: '{}' },
}, { timestamps: { createdAt: 'created_at' } });

AnalyticsSchema.index({ business_id: 1, created_at: -1 });

// =====================================================
// MODELS
// =====================================================
const Business = mongoose.model('Business', BusinessSchema);
const Integration = mongoose.model('Integration', IntegrationSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message = mongoose.model('Message', MessageSchema);
const Analytics = mongoose.model('Analytics', AnalyticsSchema);

// =====================================================
// CONNECTION
// =====================================================
async function initDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in environment variables');

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected:', mongoose.connection.host);
    await seedDemoData();
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;
  }
}

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

async function seedDemoData() {
  const count = await Business.countDocuments();
  if (count > 0) return;

  const demoId = uuidv4();
  await Business.create({
    _id: demoId,
    name: 'Demo Business',
    name_ar: 'نشاط تجريبي',
    description: 'A demo business to showcase the AI agent capabilities.',
    description_ar: 'نشاط تجريبي لعرض قدرات الذكاء الاصطناعي.',
    industry: 'retail',
    agent_name: 'Aria',
    agent_name_ar: 'آريا',
    welcome_message: "Hello! I'm Aria, your virtual assistant. How can I help you today? 😊",
    welcome_message_ar: 'أهلاً! أنا آريا، مساعدتك الافتراضية. كيف يمكنني مساعدتك اليوم؟ 😊',
    primary_color: '#6C63FF',
    secondary_color: '#4ECDC4',
  });

  await Integration.create({
    _id: uuidv4(),
    business_id: demoId,
    channel: 'widget',
    config: '{}',
    is_active: 1,
  });

  console.log('✅ Demo data seeded');
}

// =====================================================
// BUSINESS OPERATIONS
// =====================================================
const businesses = {
  async getAll() {
    return Business.find().sort({ created_at: -1 }).lean();
  },

  async getById(id) {
    return Business.findById(id).lean();
  },

  async create(data) {
    const business = await Business.create({
      _id: uuidv4(),
      name: data.name || '',
      name_ar: data.name_ar,
      description: data.description,
      description_ar: data.description_ar,
      industry: data.industry || 'general',
      agent_name: data.agent_name || 'Assistant',
      agent_name_ar: data.agent_name_ar || 'المساعد',
      system_prompt: data.system_prompt,
      welcome_message: data.welcome_message || 'Hello! How can I help you today? 😊',
      welcome_message_ar: data.welcome_message_ar || 'أهلاً! كيف يمكنني مساعدتك اليوم؟ 😊',
      avatar_url: data.avatar_url,
      primary_color: data.primary_color || '#6C63FF',
      secondary_color: data.secondary_color || '#4ECDC4',
      language: data.language || 'auto',
      knowledge_base: typeof data.knowledge_base === 'string' ? data.knowledge_base : JSON.stringify(data.knowledge_base || []),
      escalation_email: data.escalation_email,
    });
    return business.toObject();
  },

  async update(id, data) {
    if (data.knowledge_base && typeof data.knowledge_base !== 'string') {
      data.knowledge_base = JSON.stringify(data.knowledge_base);
    }
    const updated = await Business.findByIdAndUpdate(id, data, { new: true }).lean();
    return updated;
  },

  async delete(id) {
    await Business.findByIdAndDelete(id);
    await Integration.deleteMany({ business_id: id });
    const convs = await Conversation.find({ business_id: id }, '_id').lean();
    const convIds = convs.map(c => c._id);
    await Message.deleteMany({ conversation_id: { $in: convIds } });
    await Conversation.deleteMany({ business_id: id });
    return true;
  },

  async getStats(id) {
    const [total, active, todayCount] = await Promise.all([
      Conversation.countDocuments({ business_id: id }),
      Conversation.countDocuments({ business_id: id, status: 'active' }),
      Conversation.countDocuments({
        business_id: id,
        created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
    ]);

    const convIds = (await Conversation.find({ business_id: id }, '_id').lean()).map(c => c._id);
    const totalMessages = await Message.countDocuments({
      conversation_id: { $in: convIds },
      role: 'user'
    });

    return {
      totalConversations: total,
      activeConversations: active,
      totalMessages,
      todayConversations: todayCount
    };
  }
};

// =====================================================
// INTEGRATION OPERATIONS
// =====================================================
const integrations = {
  async getByBusiness(businessId) {
    return Integration.find({ business_id: businessId }).lean();
  },

  async getByChannel(businessId, channel) {
    return Integration.findOne({ business_id: businessId, channel }).lean();
  },

  async upsert(businessId, channel, config, isActive = true) {
    const configStr = typeof config === 'string' ? config : JSON.stringify(config);
    return Integration.findOneAndUpdate(
      { business_id: businessId, channel },
      { config: configStr, is_active: isActive ? 1 : 0, business_id: businessId, channel },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }
};

// =====================================================
// CONVERSATION OPERATIONS
// =====================================================
const conversations = {
  async getOrCreate(businessId, channel, channelUserId, meta = {}) {
    let conv = await Conversation.findOne({
      business_id: businessId,
      channel,
      channel_user_id: channelUserId,
      status: { $ne: 'resolved' }
    }).lean();

    if (!conv) {
      conv = await Conversation.create({
        _id: uuidv4(),
        business_id: businessId,
        channel,
        channel_user_id: channelUserId,
        customer_name: meta.name || null,
        customer_phone: meta.phone || null,
        customer_email: meta.email || null,
        metadata: JSON.stringify(meta),
      });
      conv = conv.toObject();
    }
    return conv;
  },

  async getById(id) {
    return Conversation.findById(id).lean();
  },

  async getByBusiness(businessId, limit = 50, offset = 0, status = null) {
    const query = { business_id: businessId };
    if (status) query.status = status;
    return Conversation.find(query)
      .sort({ last_message_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  },

  async getAll(limit = 100, offset = 0) {
    const convs = await Conversation.find()
      .sort({ last_message_at: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const bizIds = [...new Set(convs.map(c => c.business_id))];
    const bizList = await Business.find({ _id: { $in: bizIds } }, 'name').lean();
    const bizMap = {};
    bizList.forEach(b => bizMap[b._id] = b.name);

    return convs.map(c => ({ ...c, business_name: bizMap[c.business_id] || 'Unknown' }));
  },

  async updateStatus(id, status) {
    await Conversation.findByIdAndUpdate(id, { status });
  },

  async updateLastMessage(id, content, lang = 'auto') {
    await Conversation.findByIdAndUpdate(id, {
      last_message: content.substring(0, 200),
      last_message_at: new Date(),
      language_detected: lang,
      $inc: { message_count: 1 }
    });
  }
};

// =====================================================
// MESSAGE OPERATIONS
// =====================================================
const messages = {
  async add(conversationId, role, content, metadata = {}) {
    const msg = await Message.create({
      _id: uuidv4(),
      conversation_id: conversationId,
      role,
      content,
      metadata: JSON.stringify(metadata),
    });
    return msg.toObject();
  },

  async getByConversation(conversationId, limit = 50) {
    return Message.find({ conversation_id: conversationId })
      .sort({ created_at: 1 })
      .limit(limit)
      .lean();
  },

  async getHistory(conversationId, limit = 20) {
    return Message.find({
      conversation_id: conversationId,
      role: { $ne: 'system' }
    })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean()
      .then(msgs => msgs.reverse());
  }
};

// =====================================================
// ANALYTICS OPERATIONS
// =====================================================
const analytics = {
  async track(businessId, eventType, channel, data = {}) {
    await Analytics.create({
      _id: uuidv4(),
      business_id: businessId,
      event_type: eventType,
      channel,
      data: JSON.stringify(data),
    });
  },

  async getOverview() {
    const [totalBusinesses, totalConversations, totalMessages, activeToday] = await Promise.all([
      Business.countDocuments({ is_active: 1 }),
      Conversation.countDocuments(),
      Message.countDocuments({ role: 'user' }),
      Conversation.countDocuments({
        created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
    ]);

    const byChannelRaw = await Conversation.aggregate([
      { $group: { _id: '$channel', count: { $sum: 1 } } }
    ]);
    const byChannel = byChannelRaw.map(c => ({ channel: c._id, count: c.count }));

    const recentConvs = await Conversation.find()
      .sort({ last_message_at: -1 })
      .limit(10)
      .lean();

    const bizIds = [...new Set(recentConvs.map(c => c.business_id))];
    const bizList = await Business.find({ _id: { $in: bizIds } }, 'name').lean();
    const bizMap = {};
    bizList.forEach(b => bizMap[b._id] = b.name);

    const recentActivity = recentConvs.map(c => ({
      id: c._id,
      channel: c.channel,
      last_message: c.last_message,
      last_message_at: c.last_message_at,
      business_name: bizMap[c.business_id] || ''
    }));

    return { totalBusinesses, totalConversations, totalMessages, activeToday, byChannel, recentActivity };
  }
};

// Helper: get raw db (for legacy compat in webhooks)
function getDb() {
  return { Business, Integration, Conversation, Message, Analytics };
}

module.exports = {
  initDatabase,
  getDb,
  businesses,
  integrations,
  conversations,
  messages,
  analytics,
  // Export models directly
  Business,
  Integration,
  Conversation,
  Message,
  Analytics,
};
