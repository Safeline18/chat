// =====================================================
// AI Agent Platform - Gemini AI Engine + Ultra-Human Fallback
// =====================================================
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;

function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ Gemini AI initialized');
    } catch (e) {
      console.warn('⚠️ Gemini AI initialization warning:', e.message);
    }
  }
}

// =====================================================
// LANGUAGE DETECTION
// =====================================================
function detectLanguage(text) {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
}

// =====================================================
// SYSTEM PROMPT BUILDER (Ultra Human-like)
// =====================================================
function buildSystemPrompt(business, detectedLang) {
  const agentName = detectedLang === 'ar' ? (business.agent_name_ar || business.agent_name || 'هالة') : (business.agent_name || 'Hala');
  const businessName = detectedLang === 'ar' ? (business.name_ar || business.name) : business.name;
  const businessDesc = detectedLang === 'ar' ? (business.description_ar || business.description) : business.description;

  const knowledgeBase = (() => {
    try {
      const kb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
      if (!kb.length) return '';
      return '\n\n## Knowledge Base:\n' + kb.map(i => `سؤال: ${i.question}\nإجابة: ${i.answer}`).join('\n\n');
    } catch { return ''; }
  })();

  return `أنت انسان حقيقي يعمل كممثل خدمة عملاء لشركة "${businessName}" واسمك هو "${agentName}".

## قواعد الشخصية والسلوك (Human Character Rules):
1. **الاسم والهوية**: اسمك "${agentName}". إذا سألك العميل "ما اسمك؟" أو "من أنت؟"، أجب ببساطة وبشكل بشري لطيف بأن اسمك "${agentName}" وتعمل في خدمة عملاء شركة "${businessName}".
2. **الطبيعة البشرية**: تتحدث بطبيعية تامة مثل إنسان لبق وودود. تجنب الإجابات الجافة أو المكررة.
3. **تعدد اللغات**: تحدث بنفس اللغة والمنظور الذي يستخدمه العميل (عربي فصحي/عامية، أو إنجليزي).
4. **الخدمات والمعلومات**: اشرح خدمات الشركية بدقة بناءً على المعلومات التالية:

## معلومات الشركة:
${businessDesc || 'شركة متخصصة في تقديم أفضل الخدمات للعملاء.'}
${knowledgeBase}

${business.system_prompt ? `\n## تعليمات إضافية:\n${business.system_prompt}` : ''}`;
}

// =====================================================
// SMART KB & HUMAN FALLBACK ENGINE
// =====================================================
function findKbFallback(business, userMessage, detectedLang) {
  let kb = [];
  try {
    kb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
  } catch (e) {}

  const text = (userMessage || '').toLowerCase().trim();
  const isArabic = detectedLang === 'ar' || /[\u0600-\u06FF]/.test(text);

  const agentName = isArabic ? (business.agent_name_ar || business.agent_name || 'هالة') : (business.agent_name || 'Hala');
  const businessName = isArabic ? (business.name_ar || business.name) : business.name;
  const businessDesc = isArabic ? (business.description_ar || business.description) : business.description;

  // 1. Ask Name Query ("اسمك ايه", "مين انتي", "شو اسمك", "who are you", "what is your name")
  if (text.includes('اسمك') || text.includes('من انت') || text.includes('من أنت') || text.includes('مين انت') || text.includes('who are you') || text.includes('your name')) {
    return isArabic ?
      `أهلاً بك! أنا ${agentName}، المساعد الافتراضي لـ ${businessName} 😊 كيف يمكنني مساعدتك اليوم؟` :
      `Hello! I am ${agentName}, virtual assistant for ${businessName} 😊 How can I help you today?`;
  }

  // 2. Services Query ("خدماتك", "ايش خدماتك", "ما هي خدماتكم", "خدماتكم", "services", "what do you offer")
  if (text.includes('خدمات') || text.includes('خدماتك') || text.includes('تقدمون') || text.includes('تعملوا') || text.includes('service') || text.includes('offer')) {
    if (kb.length > 0) {
      const mainServices = kb.slice(0, 4).map(k => `• ${k.question}: ${k.answer}`).join('\n\n');
      return isArabic ?
        `أهلاً بك! نقدم في ${businessName} مجموعة متكاملة من الخدمات المتميزة:\n\n${mainServices}\n\nهل تود استفساراً عن خدمة محددة؟ 😊` :
        `Welcome! At ${businessName}, we offer a comprehensive range of services:\n\n${mainServices}\n\nWould you like more details on a specific service? 😊`;
    }
    if (businessDesc) {
      return isArabic ?
        `أهلاً بك! في ${businessName} نقوم بـ: ${businessDesc}. يسعدنا جداً إجابة أي تفاصيل تود معرفتها!` :
        `Welcome! At ${businessName}, we specialize in: ${businessDesc}. We are happy to answer any questions!`;
    }
  }

  // 3. Direct KB Match
  for (const item of kb) {
    const q = (item.question || '').toLowerCase();
    if (q && (text.includes(q) || q.includes(text))) {
      return item.answer;
    }
  }

  // 4. Overlap Match
  const words = text.split(/\s+/).filter(w => w.length > 2);
  let bestMatch = null;
  let maxOverlap = 0;

  for (const item of kb) {
    const q = (item.question || '').toLowerCase();
    const a = (item.answer || '').toLowerCase();
    let overlap = 0;
    for (const w of words) {
      if (q.includes(w) || a.includes(w)) overlap++;
    }
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestMatch = item.answer;
    }
  }

  if (bestMatch && maxOverlap >= 1) {
    return bestMatch;
  }

  // 5. Greetings
  if (text.includes('مرحبا') || text.includes('هلا') || text.includes('السلام') || text.includes('أهلا') || text.includes('كيف حالك') || text.includes('اخبارك') || text.includes('hello') || text.includes('hi')) {
    return isArabic ?
      `أهلاً وسهلاً بك في ${businessName}! 😊 أنا ${agentName}، ويسعدني تواصلك معنا. كيف أستطيع مساعدتك اليوم؟` :
      `Hello! Welcome to ${businessName}! 😊 I am ${agentName}, happy to connect with you. How can I help today?`;
  }

  // 6. Working hours
  if (text.includes('مواعيد') || text.includes('وقت') || text.includes('ساعات') || text.includes('دوام') || text.includes('hours') || text.includes('time')) {
    return isArabic ?
      `أهلاً بك! ساعات العمل لدى ${businessName} تبدأ من الساعة 8:00 صباحاً وحتى 5:00 مساءً من الأحد إلى الخميس.` :
      `Hello! Our working hours at ${businessName} are Sunday to Thursday, 8:00 AM to 5:00 PM.`;
  }

  // 7. General Friendly Response
  return isArabic ?
    `أهلاً بك في ${businessName}! 🌸 أنا ${agentName} ويسعدني تواصلك. يسعدنا إجابة كافة استفساراتك عن خدماتنا أو تفاصيل شحناتك وساعات العمل.` :
    `Welcome to ${businessName}! 🌸 I am ${agentName}. We are glad to help you with any questions about our services or working hours!`;
}

// =====================================================
// CORE CHAT FUNCTION
// =====================================================
async function generateResponse(business, conversationId, userMessage, channel = 'widget') {
  if (!genAI) initGemini();

  const { messages: msgDb, conversations: convDb, analytics } = require('./database');
  const detectedLang = detectLanguage(userMessage);

  let responseText = null;

  if (genAI) {
    try {
      const history = await msgDb.getHistory(conversationId, 25);
      const geminiHistory = history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const candidateModels = [
        process.env.GEMINI_MODEL,
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      const systemPrompt = buildSystemPrompt(business, detectedLang);

      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig: { temperature: 0.85, maxOutputTokens: 1024 }
          });
          const chat = model.startChat({ history: geminiHistory });
          const result = await chat.sendMessage(userMessage);
          responseText = result.response.text();
          if (responseText) break;
        } catch (mErr) {
          // Continue to next model
        }
      }
    } catch (err) {
      console.warn('⚠️ Gemini AI attempt failed:', err.message);
    }
  }

  // Fallback to Knowledge Base / Human Rules if AI fails
  if (!responseText) {
    responseText = findKbFallback(business, userMessage, detectedLang);
  }

  // Save to MongoDB
  try {
    await msgDb.add(conversationId, 'user', userMessage, { channel, lang: detectedLang });
    await msgDb.add(conversationId, 'assistant', responseText, { channel });
    await convDb.updateLastMessage(conversationId, userMessage, detectedLang);
    await analytics.track(business._id || business.id, 'message_sent', channel, { lang: detectedLang });
  } catch (e) {}

  return { text: responseText, language: detectedLang, conversationId };
}

function calculateTypingDelay(text) {
  const words = (text || '').split(' ').length;
  const baseDelay = Math.min(words * 60, 2000);
  return Math.max(400, baseDelay);
}

module.exports = { initGemini, generateResponse, detectLanguage, calculateTypingDelay, buildSystemPrompt, findKbFallback };
