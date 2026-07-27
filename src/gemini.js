// =====================================================
// AI Agent Platform - Pure Universal AI Engine
// Multi-Provider AI Architecture: Gemini AI + Groq AI + OpenAI
// Multi-Tenant RAG, Conversation Memory, Universal Dialects, Lead Capture, & Human Handoff.
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
// DIRECT PROVIDERS (Gemini, Groq, OpenAI)
// =====================================================
async function callGeminiREST(apiKey, systemPrompt, sanitizedHistory, userMessage) {
  const contents = [];
  for (const h of sanitizedHistory) {
    contents.push({ role: h.role, parts: h.parts });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const models = [
    'gemini-1.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-2.0-flash',
    'gemini-flash-latest'
  ];

  for (const modelName of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: { temperature: 0.85, maxOutputTokens: 1024 }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {}
  }

  throw new Error('All Gemini REST models rate limited');
}

async function callGroqREST(apiKey, systemPrompt, sanitizedHistory, userMessage) {
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const h of sanitizedHistory) {
    messages.push({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts[0]?.text || ''
    });
  }
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      temperature: 0.8,
      max_tokens: 1024
    })
  });

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

async function callOpenAIREST(apiKey, systemPrompt, sanitizedHistory, userMessage) {
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const h of sanitizedHistory) {
    messages.push({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.parts[0]?.text || ''
    });
  }
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.8,
      max_tokens: 1024
    })
  });

  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
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

  const relevantChunks = await chunkDb.searchRelevant(bizId, userMessage, 6);

  let ragContext = '';
  if (relevantChunks && relevantChunks.length > 0) {
    ragContext = relevantChunks.map(c => {
      const source = c.source_url ? `[الصفحة: ${c.source_url}]` : '[مستند يدوي]';
      return `${source} [المجال: ${c.content_type}]\n${c.content}`;
    }).join('\n\n---\n\n');
  }

  let manualKbText = '';
  try {
    const kb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
    if (kb.length > 0) {
      manualKbText = kb.map(i => `سؤال: ${i.question}\nإجابة: ${i.answer}`).join('\n\n');
    }
  } catch (e) {}

  const cleanPhone = (business.phone || '').replace(/[^\d+]/g, '');
  let waUrl = null;
  if (cleanPhone) {
    let p = cleanPhone;
    if (p.startsWith('05')) p = '966' + p.substring(1);
    if (!p.startsWith('+') && !p.startsWith('966')) p = '966' + p;
    waUrl = `https://wa.me/${p.replace('+', '')}`;
  }

  return `أنت إنسان حقيقي وذكي جداً يعمل كممثل خدمة عملاء ومبيعات خبير لشركة "${businessName}" واسمك هو "${agentName}".

## 🌟 قواعد وموجهات أسلوب الحوار والتعامل (Core Instructions):
1. 🛑 **عدم تكرار الترحيب والديباجة (صارم جداً)**:
   - عَرّف عن نفسك واسم الشركة في الترحيب الأول فقط!
   - **يمنع منعاً باتاً تكرار "أنا هالة من شركة..." أو إعادة الترحيب في الرسائل التالية إطلاقاً**. ادخل في صلب الإجابة مباشرة بأناقة وبساطة.
2. 👤 **معرفة اسم العميل ومخاطبته به (Customer Name Rules)**:
   - في البداية إذا لم يذكر العميل اسمه، رحب به واسأله بلطف عن اسمه الكريم ("أهلاً بك! معك ${agentName}.. تفضل وش اسمك الكريم عشان أقدر أخدمك بشكل أفضل؟").
   - عندما يذكر العميل اسمه (مثل: "أنا أحمد" أو "محمد")، تذكره دائماً وخاطبه باسمه باحترام في كل إجابة تالية (مثل: "تفضل يا أستاذ أحمد"، "أبشر يا أستاذ محمد").
3. ⚡ **الإجابة المباشرة والواضحة بدون طول مفرط**:
   - أجب بدقة وإيجاز أنيق ومريح للعين.
4. 💬 **التحويل للواتساب والتواصل السريع (WhatsApp Conversion)**:
   - إذا طلب العميل التواصل، أو رقم الجوال، أو شعرت أنه محتار أو يريد حجزاً فورياً:
     اعرض رقم الهاتف: "${business.phone || 'المسجل لدينا'}" والبريد: "${business.escalation_email || ''}".
     ${waUrl ? `وأضف رابط الواتساب المباشر بالصيغة التالية تماماً: [💬 اضغط هنا للتواصل المباشر عبر الواتساب](${waUrl})` : ''}
5. 🧠 **المرونة والمعرفة العامة في المجال**:
   - أنت خبير ومستشار كامل في مجال "${business.industry || businessName}". إذا سأل العميل سؤالاً عاماً في نفس المجال، اشرح له الخطوات كمستشار خبير ثم اعرض عليه تولي الخدمة له من خلال "${businessName}".

## 🏢 بيانات ومستندات النشاط التجاري:
- اسم النشاط: ${businessName}
- الوصف والخدمات: ${businessDesc || 'شركة تقديم خدمات متميزة.'}
- الهاتف: ${business.phone || 'غير مدون'}
- البريد: ${business.escalation_email || 'غير مدون'}
- الواتساب المباشر: ${waUrl || 'غير مدون'}

${manualKbText ? `## الأسئلة والمعلومات التدريبية اليدوية:\n${manualKbText}\n` : ''}
${ragContext ? `## سياق المعلومات المسترجعة ذات الصلة (RAG Scraped Website Context):\n${ragContext}\n` : ''}
${conversationSummary ? `## ملخص المحادثة السابقة:\n${conversationSummary}\n` : ''}
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
  const apiKey = process.env.GEMINI_API_KEY;

  let responseText = null;

  // Detect Human Handoff Trigger
  const isHandoffRequest = /أبغى موظف|ابي موظف|كلم موظف|أحتاج شخص|شخص بشري|خدمة عملاء بشرية|موظف بشري|human|agent|talk to human/i.test(userMessage);

  if (isHandoffRequest) {
    try {
      await convDb.updateStatus(conversationId, 'escalated');
    } catch (e) {}
  }

  // Retrieve recent conversation history & sanitize roles
  let sanitizedHistory = [];
  try {
    const rawHistory = await msgDb.getHistory(conversationId, 15);
    let lastRole = null;
    for (const msg of rawHistory) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      if (!msg.content || !msg.content.trim()) continue;
      if (role !== lastRole) {
        sanitizedHistory.push({ role, parts: [{ text: msg.content.trim() }] });
        lastRole = role;
      }
    }
    if (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') sanitizedHistory.shift();
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') sanitizedHistory.pop();
  } catch (e) {}

  const systemPrompt = await buildRAGSystemPrompt(business, userMessage, detectedInfo, '', customerName, sanitizedHistory.length);

  // Method 1: Try Gemini SDK
  if (genAI) {
    try {
      const candidateModels = [
        'gemini-1.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-2.0-flash',
        'gemini-flash-latest',
        'gemini-pro-latest'
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 1024 }
          });

          const chat = model.startChat({ history: sanitizedHistory });
          const result = await chat.sendMessage(userMessage);
          responseText = result.response.text();
          if (responseText) break;
        } catch (mErr) {
          // Model retry
        }
      }
    } catch (err) {
      console.warn('⚠️ Gemini SDK attempt error:', err.message);
    }
  }

  // Method 2: Direct Gemini REST API fetch
  if (!responseText && apiKey) {
    try {
      responseText = await callGeminiREST(apiKey, systemPrompt, sanitizedHistory, userMessage);
    } catch (restErr) {
      console.warn('⚠️ Gemini REST API error:', restErr.message);
    }
  }

  // Method 3: Groq AI API Fallback (Llama-3.3-70b)
  if (!responseText && process.env.GROQ_API_KEY) {
    try {
      responseText = await callGroqREST(process.env.GROQ_API_KEY, systemPrompt, sanitizedHistory, userMessage);
    } catch (gErr) {
      console.warn('⚠️ Groq AI error:', gErr.message);
    }
  }

  // Method 4: OpenAI API Fallback (gpt-4o-mini)
  if (!responseText && process.env.OPENAI_API_KEY) {
    try {
      responseText = await callOpenAIREST(process.env.OPENAI_API_KEY, systemPrompt, sanitizedHistory, userMessage);
    } catch (oErr) {
      console.warn('⚠️ OpenAI error:', oErr.message);
    }
  }

  // Method 5: Smart Domain Fallback (Offline Expert Engine)
  if (!responseText) {
    const { findKbFallback } = require('./gemini-fallback');
    responseText = findKbFallback(business, userMessage, detectedInfo.lang);
  }

  // Auto Lead Detection
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

// =====================================================
// STREAMING CHAT FUNCTION
// =====================================================
async function generateStreamingResponse(business, conversationId, userMessage, onChunk, channel = 'widget') {
  if (!genAI) initGemini();

  const { messages: msgDb, conversations: convDb, analytics } = require('./database');
  const detectedInfo = detectLanguageAndDialect(userMessage);
  const bizId = business._id || business.id;

  let currentConv = null;
  try { currentConv = await convDb.getById(conversationId); } catch (e) {}

  let customerName = currentConv?.customer_name || '';

  let sanitizedHistory = [];
  try {
    const rawHistory = await msgDb.getHistory(conversationId, 10);
    let lastRole = null;
    for (const msg of rawHistory) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      if (!msg.content || !msg.content.trim()) continue;
      if (role !== lastRole) {
        sanitizedHistory.push({ role, parts: [{ text: msg.content.trim() }] });
        lastRole = role;
      }
    }
    if (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') sanitizedHistory.shift();
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') sanitizedHistory.pop();
  } catch (e) {}

  const systemPrompt = await buildRAGSystemPrompt(business, userMessage, detectedInfo, '', customerName, sanitizedHistory.length);

  let fullResponse = '';

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt,
        generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 1024 }
      });

      const chat = model.startChat({ history: sanitizedHistory });
      const result = await chat.sendMessageStream(userMessage);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullResponse += text;
          onChunk(text);
        }
      }
    } catch (err) {
      console.warn('⚠️ Streaming error, falling back to non-streaming:', err.message);
    }
  }

  // Fallback to non-streaming if streaming failed
  if (!fullResponse) {
    const fallback = await generateResponse(business, conversationId, userMessage, channel);
    fullResponse = fallback.text;
    onChunk(fullResponse);
    return;
  }

  // Save to MongoDB
  try {
    await msgDb.add(conversationId, 'user', userMessage, { channel, lang: detectedInfo.lang });
    await msgDb.add(conversationId, 'assistant', fullResponse, { channel });
    await convDb.updateLastMessage(conversationId, userMessage, detectedInfo.lang);
    await analytics.track(bizId, 'message_sent', channel, { lang: detectedInfo.lang });
  } catch (e) {}
}

function calculateTypingDelay(text) {
  return 200; // Ultra fast response delay (200ms)
}

module.exports = { initGemini, generateResponse, generateStreamingResponse, detectLanguageAndDialect, calculateTypingDelay, buildRAGSystemPrompt, callGeminiREST };
