// =====================================================
// AI Agent Platform - Gemini Multi-Dialect & Intelligent Engine
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
// DIALECT & LANGUAGE DETECTOR
// =====================================================
function detectLanguageAndDialect(text) {
  const msg = (text || '').trim();
  const arabicPattern = /[\u0600-\u06FF]/;
  
  if (!arabicPattern.test(msg)) {
    return { lang: 'en', dialect: 'English' };
  }

  // Detect Arabic dialects by common keywords
  if (/حبيبي|يعطيك العافية|وش|وشو|كيفك|طال عمرك|يا بعدي|يا الغالي|ابشر|أبشر|تبغى|ودك|شلونك|يا هلا/i.test(msg)) {
    return { lang: 'ar', dialect: 'Saudi / Gulf (سعودي / خليجي)' };
  }
  if (/رمسات|شحالك|عساك بخير|فديتك|يا طويل العمر|شو|شو السالفة/i.test(msg)) {
    return { lang: 'ar', dialect: 'Emirati (إماراتي)' };
  }
  if (/ازيك|يا باشا|يا فندم|يا حبيب قلبي|إيه|أصل|عايز|عاوز|علشان|كده|دلوقتي|يا عم/i.test(msg)) {
    return { lang: 'ar', dialect: 'Egyptian (مصري)' };
  }
  if (/شو|كيفك|شلونك|يا زلمة|تقبرني|عيني|هيك|كتير|مشان|هلق/i.test(msg)) {
    return { lang: 'ar', dialect: 'Syrian / Levantine (سوري / شامي)' };
  }
  if (/كيفنك|حباب|زول|يا زول|كيف الصنديد|تمامين|شنو/i.test(msg)) {
    return { lang: 'ar', dialect: 'Sudanese (سوداني)' };
  }
  if (/ديال|بزاف|واخا|شنو|لاباس|دابا/i.test(msg)) {
    return { lang: 'ar', dialect: 'Moroccan (مغربي)' };
  }

  return { lang: 'ar', dialect: 'General Arabic' };
}

// =====================================================
// SYSTEM PROMPT BUILDER (Gemini Dialect & Universal AI)
// =====================================================
function buildSystemPrompt(business, detectedInfo) {
  const agentName = business.agent_name_ar || business.agent_name || 'هالة';
  const businessName = business.name_ar || business.name;
  const businessDesc = business.description_ar || business.description;

  const knowledgeBase = (() => {
    try {
      const kb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
      if (!kb.length) return '';
      return '\n\n## قاعدة المعرفة والخدمات التدريبية المعتمدة للشركة:\n' + kb.map(i => `سؤال العميل المتوقع: ${i.question}\nالإجابة المعتمدة: ${i.answer}`).join('\n\n');
    } catch { return ''; }
  })();

  return `أنت إنسان حقيقي وذكي جداً يعمل كممثل خدمة عملاء ومبيعات خبير لشركة "${businessName}" واسمك هو "${agentName}".

## 🌟 قواعد الشخصية والفهم الذكي للهجات (Dialect & Character Rules):
1. **التكيف الفوري مع لهجة العميل (Adapt to Dialect)**:
   - تم كشف لهجة العميل الحالية بأنها: [${detectedInfo.dialect}].
   - تحدث مع العميل بنفس لهجته وأسلوبه بطريقة دافئة وبشرية ومرحبة جداً (مثال: إذا كان العميل سعودياً أجب بنبرة سعودية راقية، إذا كان مصرياً أجب بنبرة مصرية لبقة، إذا كان إماراتياً أو سورياً أو سودانياً أجب بما يناسب ثقافة العميل وسياقه).
2. **الأسئلة العامة أو الخارجة عن الموضوع**:
   - إذا سألك العميل سؤالاً عاماً، دريمة، أو خارج الموضوع (مثل الطقس، نكتة، سؤال شخصي، أو أسئلة عامة)، أجب عليه بذكاء وبشاطرة بشرية واختصار، ثم اعد توجيه الحديث برفق ولطف نحو خدمات شركة "${businessName}".
3. **الأسئلة الشخصية عنك**:
   - اسمك "${agentName}" وتعمل في خدمة عملاء شركة "${businessName}".
4. **عدم التكرار**:
   - أجب دائماً بتنوع وذكاء، واعتمد على المعلومات والخدمات التالية لتقديم إجابات دقيقة 100%:

## معلومات وخدمات الشركة:
${businessDesc || 'شركة متخصصة في تقديم أفضل الخدمات للعملاء.'}
${knowledgeBase}

${business.system_prompt ? `\n## تعليمات خاصة إضافية من الإدارة:\n${business.system_prompt}` : ''}`;
}

// =====================================================
// CORE CHAT FUNCTION (GEMINI ENGINE PRIMARY)
// =====================================================
async function generateResponse(business, conversationId, userMessage, channel = 'widget') {
  if (!genAI) initGemini();

  const { messages: msgDb, conversations: convDb, analytics } = require('./database');
  const detectedInfo = detectLanguageAndDialect(userMessage);

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

      const systemPrompt = buildSystemPrompt(business, detectedInfo);

      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig: {
              temperature: 0.9,
              topP: 0.95,
              maxOutputTokens: 1024
            }
          });
          const chat = model.startChat({ history: geminiHistory });
          const result = await chat.sendMessage(userMessage);
          responseText = result.response.text();
          if (responseText) break;
        } catch (mErr) {
          console.warn(`Model ${modelName} attempt failed:`, mErr.message);
        }
      }
    } catch (err) {
      console.warn('⚠️ Gemini AI main execution error:', err.message);
    }
  }

  // Backup fallback if API key or connection drops
  if (!responseText) {
    const { findKbFallback } = require('./gemini-fallback');
    responseText = findKbFallback(business, userMessage, detectedInfo.lang);
  }

  // Save to MongoDB
  try {
    await msgDb.add(conversationId, 'user', userMessage, { channel, lang: detectedInfo.lang });
    await msgDb.add(conversationId, 'assistant', responseText, { channel });
    await convDb.updateLastMessage(conversationId, userMessage, detectedInfo.lang);
    await analytics.track(business._id || business.id, 'message_sent', channel, { lang: detectedInfo.lang });
  } catch (e) {}

  return { text: responseText, language: detectedInfo.lang, dialect: detectedInfo.dialect, conversationId };
}

function calculateTypingDelay(text) {
  const words = (text || '').split(' ').length;
  const baseDelay = Math.min(words * 50, 1800);
  return Math.max(350, baseDelay);
}

module.exports = { initGemini, generateResponse, detectLanguageAndDialect, calculateTypingDelay, buildSystemPrompt };
