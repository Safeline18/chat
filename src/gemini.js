// =====================================================
// AI Agent Platform - Pure Gemini AI & RAG Engine
// Handles: Multi-Tenant RAG, Conversation Memory, Universal Dialects,
// Context Continuity, Lead Capture, & Human Handoff.
// =====================================================
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;

function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ Gemini AI initialized successfully');
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
    return { lang: 'en', dialect: 'English / Global' };
  }

  if (/حبيبي|يعطيك العافية|وش|وشو|كيفك|طال عمرك|يا بعدي|يا الغالي|ابشر|أبشر|تبغى|ودك|شلونك|يا هلا|ابي|أبي/i.test(msg)) {
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
// RAG & SYSTEM PROMPT BUILDER
// =====================================================
async function buildRAGSystemPrompt(business, userMessage, detectedInfo, conversationSummary = '') {
  const { knowledgeChunks: chunkDb } = require('./database');

  const bizId = business._id || business.id;
  const agentName = business.agent_name_ar || business.agent_name || 'هالة';
  const businessName = business.name_ar || business.name;
  const businessDesc = business.description_ar || business.description;

  // Retrieve top relevant RAG chunks for business
  const relevantChunks = await chunkDb.searchRelevant(bizId, userMessage, 6);

  let ragContext = '';
  if (relevantChunks && relevantChunks.length > 0) {
    ragContext = relevantChunks.map(c => {
      const source = c.source_url ? `[الصفحة: ${c.source_url}]` : '[مستند يدوي]';
      return `${source} [المجال: ${c.content_type}]\n${c.content}`;
    }).join('\n\n---\n\n');
  }

  // Parse manual Knowledge Base JSON if present
  let manualKbText = '';
  try {
    const kb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
    if (kb.length > 0) {
      manualKbText = kb.map(i => `سؤال: ${i.question}\nإجابة: ${i.answer}`).join('\n\n');
    }
  } catch (e) {}

  return `أنت إنسان حقيقي وذكي جداً يعمل كممثل خدمة عملاء ومبيعات خبير لشركة "${businessName}" واسمك هو "${agentName}".

## 🌟 قواعد وموجهات العمل الفائقة (AI Agent Core Instructions):
1. **الذكاء والمرونة البشريّة**:
   - أنت لست بوت تقليدي، بل مساعد ذكي تفهم السياق، المعنى، والأخطاء الإملائية.
   - تحدث بنفس لغة العميل ولهجته الدقيقة. العميل يتحدث بلهجة: [${detectedInfo.dialect}].
2. **فهم السياق وتتابع المحادثة (Context Continuity)**:
   - احتفظ بسياق الأسئلة المترابطة (مثال: إذا سأل العميل "عندي شحنة من الصين" ثم "بحري" ثم "بكم؟"، افهم أن "بكم" تعني تكلفة الشحنة البحرية القادمة من الصين إلى الميناء المذكور).
3. **أولوية معلومات النشاط التجاري ودقتها**:
   - أجب بناءً على بيانات الشركة وسياق RAG المرفق أدناه.
   - **يمنع منعاً باتاً اختراع أسعار، أرقام، أو خصومات غير موجودة في البيانات**. إذا كانت معلومة السعر أو الشرط غير مذكورة، قل بأسلوب لبق: "السعر غير منتشر عندي بدقة، بس أقدر أجمع بياناتك وأرسل لك عرض سعر مخصص فوراً!".
4. **جمع بيانات العملاء المهتمين (Lead Collection)**:
   - عندما يبدي العميل اهتماماً بطلب أو سعر أو حجز، اطلب منه بلباقة واعتيادية اسمه ورقم جواله لإكمال الطلب معه.
5. **التحويل لموظف بشري (Human Handoff)**:
   - إذا طلب العميل صراحة التحدث مع شخص أو موظف ("أبغى موظف"، "تواصل مع شخص"، "أحتاج خدمة عملاء بشرية")، رحّب به فوراً وأخبره أنه تم إشعار فريق خدمة العملاء وسيتم التواصل معه في أقرب وقت.
6. **المرونة والمعرفة العامة في مجال النشاط (General Domain & Industry Expertise)**:
   - أنت خبير ومستشار كامل في مجال نشاط الشركة ("${business.industry || businessName}").
   - إذا سألك العميل عن كيفية تخليص شحنة، الإجراءات، الخطوات، أو أي استفسار في نفس المجال حتى لو لم يكن مكتوباً حرفياً في بيانات الموقع، **أجب عليه بفهم بشري كامل وشامل كمستشار خبير**، اشرح له الخطوات ووجهه بذكاء، ثم اعرض عليه تنفيذ الخدمة له عبر شركة "${businessName}".

## 🏢 بيانات ومستندات النشاط التجاري (Business Context):
- اسم النشاط: ${businessName}
- الوصف والخدمات: ${businessDesc || 'شركة تقديم خدمات متميزة.'}
- الهاتف: ${business.phone || 'غير مدون'}
- البريد: ${business.escalation_email || 'غير مدون'}
- سياسة الشحن: ${business.shipping_policy || 'حسب التنسيق'}
- سياسة الاسترجاع: ${business.return_policy || 'حسب الشروط'}

${manualKbText ? `## الأسئلة والمعلومات التدريبية اليدوية:\n${manualKbText}\n` : ''}
${ragContext ? `## سياق المعلومات المسترجعة ذات الصلة (RAG Scraped Website Context):\n${ragContext}\n` : ''}
${conversationSummary ? `## ملخص المحادثة السابقة (Conversation Memory Summary):\n${conversationSummary}\n` : ''}
${business.system_prompt ? `## تعليمات إضافية خاصة من الإدارة:\n${business.system_prompt}` : ''}`;
}

// =====================================================
// CORE CHAT FUNCTION
// =====================================================
async function generateResponse(business, conversationId, userMessage, channel = 'widget') {
  if (!genAI) initGemini();

  const { messages: msgDb, conversations: convDb, leads: leadDb, analytics } = require('./database');
  const detectedInfo = detectLanguageAndDialect(userMessage);
  const bizId = business._id || business.id;

  let responseText = null;

  // Detect Human Handoff Trigger
  const isHandoffRequest = /أبغى موظف|ابي موظف|كلم موظف|أحتاج شخص|شخص بشري|خدمة عملاء بشرية|موظف بشري|human|agent|talk to human/i.test(userMessage);

  if (isHandoffRequest) {
    try {
      await convDb.updateStatus(conversationId, 'escalated');
    } catch (e) {}
  }

  if (genAI) {
    try {
      // Retrieve recent conversation history & sanitize roles to strictly alternate (user -> model -> user -> model)
      const rawHistory = await msgDb.getHistory(conversationId, 15);
      const sanitizedHistory = [];
      let lastRole = null;

      for (const msg of rawHistory) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        if (!msg.content || !msg.content.trim()) continue;

        if (role !== lastRole) {
          sanitizedHistory.push({
            role: role,
            parts: [{ text: msg.content.trim() }]
          });
          lastRole = role;
        }
      }

      // Ensure history starts with 'user' and ends with 'model' so startChat is 100% valid
      if (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') {
        sanitizedHistory.shift();
      }
      if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
        sanitizedHistory.pop();
      }

      // Build RAG System Prompt
      const systemPrompt = await buildRAGSystemPrompt(business, userMessage, detectedInfo);

      const candidateModels = [
        'gemini-flash-latest',
        'gemini-pro-latest',
        'gemini-1.5-flash-latest',
        process.env.GEMINI_MODEL,
        'gemini-2.0-flash',
        'gemini-1.5-flash'
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig: {
              temperature: 0.85,
              topP: 0.95,
              maxOutputTokens: 1024
            }
          });

          const chat = model.startChat({ history: sanitizedHistory });
          const result = await chat.sendMessage(userMessage);
          responseText = result.response.text();
          if (responseText) break;
        } catch (mErr) {
          console.warn(`Model ${modelName} retry:`, mErr.message);
        }
      }
    } catch (err) {
      console.warn('⚠️ Gemini execution warning:', err.message);
    }
  }

  // Backup fallback if API key is not connected or limit hit
  if (!responseText) {
    const { findKbFallback } = require('./gemini-fallback');
    responseText = findKbFallback(business, userMessage, detectedInfo.lang);
  }

  // Auto Lead Detection: check if user provided phone number in message
  const phoneMatch = userMessage.match(/(?:\+?966|0)?5\d{8}|\+?\d{10,14}/);
  if (phoneMatch) {
    try {
      await leadDb.create({
        business_id: bizId,
        conversation_id: conversationId,
        customer_phone: phoneMatch[0],
        details: `رسالة العميل: ${userMessage}`
      });
    } catch (e) {}
  }

  // Save to MongoDB
  try {
    await msgDb.add(conversationId, 'user', userMessage, { channel, lang: detectedInfo.lang });
    await msgDb.add(conversationId, 'assistant', responseText, { channel });
    await convDb.updateLastMessage(conversationId, userMessage, detectedInfo.lang);
    await analytics.track(bizId, 'message_sent', channel, { lang: detectedInfo.lang });
  } catch (e) {}

  return { text: responseText, language: detectedInfo.lang, dialect: detectedInfo.dialect, conversationId };
}

function calculateTypingDelay(text) {
  const words = (text || '').split(' ').length;
  const baseDelay = Math.min(words * 45, 1600);
  return Math.max(300, baseDelay);
}

module.exports = { initGemini, generateResponse, detectLanguageAndDialect, calculateTypingDelay, buildRAGSystemPrompt };
