// =====================================================
// AI Agent Platform - Gemini AI Engine + Smart Fallback
// =====================================================
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

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
  const chinesePattern = /[\u4E00-\u9FFF]/;
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
  const koreanPattern = /[\uAC00-\uD7AF]/;

  if (arabicPattern.test(text)) return 'ar';
  if (chinesePattern.test(text)) return 'zh';
  if (japanesePattern.test(text)) return 'ja';
  if (koreanPattern.test(text)) return 'ko';
  return 'en';
}

// =====================================================
// SYSTEM PROMPT BUILDER
// =====================================================
function buildSystemPrompt(business, detectedLang) {
  const langInstructions = {
    ar: 'تحدث باللغة العربية الفصحى البسيطة والمفهومة.',
    en: 'Respond in clear, professional English.',
  };

  const agentName = detectedLang === 'ar' ? (business.agent_name_ar || business.agent_name) : business.agent_name;
  const businessName = detectedLang === 'ar' ? (business.name_ar || business.name) : business.name;
  const businessDesc = detectedLang === 'ar' ? (business.description_ar || business.description) : business.description;

  const knowledgeBase = (() => {
    try {
      const kb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
      if (!kb.length) return '';
      return '\n\n## Knowledge Base:\n' + kb.map(i => `Q: ${i.question}\nA: ${i.answer}`).join('\n\n');
    } catch { return ''; }
  })();

  return `You are ${agentName}, a professional AI customer service representative for "${businessName}".

## Identity & Personality:
- Name: ${agentName}
- Business: ${businessName}
- Industry: ${business.industry || 'general'}
- You are warm, empathetic, professional, and genuinely helpful.
- Use appropriate emojis occasionally to feel friendly.

## Business Information:
${businessDesc || 'A professional business committed to excellent customer service.'}
${knowledgeBase}

## Communication Guidelines:
1. **Language**: ${langInstructions[detectedLang] || langInstructions.en} ALWAYS respond in the SAME language the customer uses.
2. **Tone**: Professional yet warm and friendly.
3. Keep conversation history context in mind.

${business.system_prompt ? `\n## Additional Instructions:\n${business.system_prompt}` : ''}`;
}

// =====================================================
// SMART KB FALLBACK ENGINE
// =====================================================
function findKbFallback(business, userMessage, detectedLang) {
  let kb = [];
  try {
    kb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
  } catch (e) {}

  const text = (userMessage || '').toLowerCase().trim();
  const isArabic = detectedLang === 'ar' || /[\u0600-\u06FF]/.test(text);

  // 1. Direct or keyword match in KB
  for (const item of kb) {
    const q = (item.question || '').toLowerCase();
    if (q && (text.includes(q) || q.includes(text))) {
      return item.answer;
    }
  }

  // 2. Word overlap match
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

  // 3. Greetings
  if (text.includes('مرحبا') || text.includes('هلا') || text.includes('السلام') || text.includes('أهلا') || text.includes('كيف حالك') || text.includes('hello') || text.includes('hi') || text.includes('hey')) {
    const welcome = isArabic ? (business.welcome_message_ar || business.welcome_message) : business.welcome_message;
    return welcome || (isArabic ?
      `أهلاً وسهلاً بك في ${business.name_ar || business.name}! 😊 كيف يمكنني مساعدتك اليوم؟` :
      `Hello! Welcome to ${business.name}. How can I assist you today? 😊`);
  }

  // 4. Working hours
  if (text.includes('مواعيد') || text.includes('وقت') || text.includes('ساعات') || text.includes('دوام') || text.includes('hours') || text.includes('time')) {
    return isArabic ?
      `أهلاً بك! ساعات العمل لدى ${business.name_ar || business.name} تبدأ من الساعة 8:00 صباحاً وحتى 5:00 مساءً من الأحد إلى الخميس.` :
      `Hello! Our working hours at ${business.name} are Sunday to Thursday, 8:00 AM to 5:00 PM.`;
  }

  // 5. Default business response
  return isArabic ?
    `أهلاً بك في ${business.name_ar || business.name}! 🌸 يسعدنا جداً تواصلك معنا وإجابة جميع استفساراتك. كيف يمكننا مساعدتك بخصوص خدماتنا اليوم؟` :
    `Welcome to ${business.name}! 🌸 We are glad to connect with you. How can we help you with our services today?`;
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

  // Fallback to Knowledge Base / Smart Rules if AI fails
  if (!responseText) {
    console.log('💡 Using Smart KB Fallback Engine for response');
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

// =====================================================
// TYPING DELAY SIMULATION
// =====================================================
function calculateTypingDelay(text) {
  const words = (text || '').split(' ').length;
  const baseDelay = Math.min(words * 60, 2000);
  return Math.max(400, baseDelay);
}

module.exports = { initGemini, generateResponse, detectLanguage, calculateTypingDelay, buildSystemPrompt, findKbFallback };
