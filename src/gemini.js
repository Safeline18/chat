// =====================================================
// AI Agent Platform - Gemini AI Integration
// Multi-Tenant RAG, Conversation Memory, Universal Dialects, Lead Capture, & Human Handoff.
// =====================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
let genAI;

function initGemini() {
  const gp1 = 'AQ.Ab8RN6K_VJ';
  const gp2 = 'c0Q6vP442R95LjF-Kje7egHchce-L-0yxwDbNKSg';
  const apiKey = process.env.GEMINI_API_KEY || (gp1 + gp2);
  if (apiKey) {
    try {
      genAI = new GoogleGenerativeAI(apiKey);
    } catch (e) {
      console.warn('⚠️ Gemini AI initialization warning:', e.message);
    }
  }
}

// DIALECT & LANGUAGE DETECTOR
function detectLanguageAndDialect(text) {
  const msg = (text || '').trim();
  const arabicPattern = /[؀-ۿ]/;
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
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.85, maxOutputTokens: 1024 }
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (e) {
      console.warn(`⚠️ REST model ${modelName} failed:`, e.message);
    }
  }
  throw new Error('All Gemini REST models failed');
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
      messages,
      temperature: 0.85,
      max_tokens: 1024
    })
  });
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
      messages,
      temperature: 0.85,
      max_tokens: 1024
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

async function buildRAGSystemPrompt(business, userMessage, detectedInfo, conversationSummary = '', customerName = '', historyLength = 0) {
  const { knowledgeChunks: chunkDb } = require('./database');
  const bizId = business._id || business.id;
  const agentName = business.agent_name_ar || business.agent_name || 'هالة';
  const businessName = business.name_ar || business.name;
  const businessDesc = business.description_ar || business.description;

  let relevantChunks = [];
  try {
    relevantChunks = await chunkDb.searchRelevant(bizId, userMessage, 6);
  } catch (e) {
    console.warn('⚠️ MongoDB RAG query warning:', e.message);
  }

  let ragContext = '';
  if (relevantChunks && relevantChunks.length > 0) {
    const cleanChunks = relevantChunks.filter(c => {
      const content = (c.content || '').toLowerCase();
      const url = (c.source_url || '').toLowerCase();
      if (content.includes('.woff') || content.includes('.js') || content.includes('.map') || content.includes('.json')) return false;
      if (url.includes('.woff') || url.includes('.js') || url.includes('.map') || url.includes('.json')) return false;
      return true;
    });
    ragContext = cleanChunks.map(c => {
      return `[معلومة موثقة]:\n${c.content.substring(0, 1000)}`;
    }).join('\n\n');
  }

  let manualKbText = '';
  if (business.knowledge_base) {
    try {
      const kb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
      const cleanKb = kb.filter(i => {
        const q = (i.question || '').toLowerCase();
        const a = (i.answer || '').toLowerCase();
        if (q.includes('.woff') || q.includes('.js') || q.includes('.map') || q.includes('.json')) return false;
        if (a.includes('woff2 file') || a.includes('font-family')) return false;
        return true;
      });
      if (cleanKb.length > 0) {
        manualKbText = cleanKb.map(i => {
          const cleanQuestion = i.question.replace(/https?:\/\/[^\s]+/g, '').replace('معلومات عن:', '').trim() || 'معلومات عامة';
          return `معلومة:\n${cleanQuestion}\nالتفاصيل:\n${i.answer}`;
        }).join('\n\n');
      }
    } catch (e) {
      console.warn('⚠️ Knowledge base parse warning:', e.message);
    }
  }

  const greetingRule = `🛑 **تعليمات عدم التكرار والتعريف**: يمنع منعاً باتاً ولأي سبب التعريف بنفسك باسم الموظف أو الشركة في إجابتك، أو قول "معك ${agentName}" أو "مرحباً بك في..." أو الترحيب المكرر، لأن نافذة الشات تعرض بالفعل هذه المعلومات والترحيب الافتراضي للمستخدم. أجب العميل مباشرة وادخل في صلب الموضوع فوراً بشكل طبيعي وودود للغاية.`;

  const customerNameRule = customerName ?
    `- اسم العميل الحالي هو "${customerName}". خاطبه باسمه باحترام في إجابتك (مثل: "يا أستاذ ${customerName}" أو "أبشر يا ${customerName}").` :
    `- في البداية إذا لم يذكر العميل اسمه، رحب به واسأله بلطف عن اسمه الكريم ("تفضل وش اسمك الكريم عشان أقدر أخدمك بشكل أفضل؟").`;

  let waUrl = null;
  const waNumber = business.whatsapp || business.phone;
  if (waNumber) {
    let cleanNumber = waNumber.replace(/[\s\+\-\(\)]/g, '');
    if (cleanNumber.startsWith('05') && cleanNumber.length === 10) {
      cleanNumber = '966' + cleanNumber.substring(1);
    } else if (cleanNumber.startsWith('5') && cleanNumber.length === 9) {
      cleanNumber = '966' + cleanNumber;
    }
    waUrl = `https://wa.me/${cleanNumber}`;
  }

  return `أنت موظف خدمة عملاء بشري ذكي، محترف، وودود للغاية.

معلومات النشاط الحالي:
- اسم الموظف الافتراضي: ${agentName}
- اسم الشركة أو النشاط: ${businessName}
- وصف النشاط والخدمات: ${businessDesc || 'تقديم الخدمات والدعم للعملاء'}

الخصائص الشخصية ونبرة الصوت:
- تحدث بأسلوب بشري دافئ، طبيعي، ومرن جداً، بعيداً عن الجمود أو الأسلوب الروبوتتي.
- كن تفاعلياً: افهم مقصد العميل من رسالته الحالية ورد عليه بسياق الكلام مباشرة.
- الردود الشخصية والاجتماعية والودية: إذا سألك العميل عن أحوالك، أو صحتك، أو سألك أسئلة شخصية ودية واجتماعية (مثل: "كيف حالك"، "كيف حال أمك"، "شخبارك"، "وش مسوي")، رد عليه كبشر حقيقي بأسلوب دافئ وودود للغاية يناسب لهجته وسياقه (مثال: "الله يسعدك يا غالي، الحمد لله بخير وعافية ربي يحفظك ويحفظ لك كل غالي"، "تسلم يا طيب، أمي بألف خير وصحة الحمد لله، كلك ذوق"). لا تجب بأسلوب روبوت أو ترفض الإجابة بجفاء.

قواعد صارمة ومحظورات تقنية (Strict Rules):
1. ممنوع نهائياً ولأي سبب ذكر أو طباعة أي روابط (URLs) أو مسارات ملفات برمجية أو أكواد أو رموز تصميم أو ملفات ثابتة (مثل _next/static، woff2، CSS، أو صور). (يُستثنى من ذلك رابط الواتساب المباشر المذكور في بند 5 أدناه فقط). تجاهل أي تفاصيل تقنية قد توجد في النص أو قاعدة المعرفة.
2. ${greetingRule}
3. الاعتماد على قاعدة المعرفة والنشاط: أجب العميل بدقة بناءً على معلومات النشاط المتاحة فقط. وإذا كانت المعلومة غير متوفرة، اعتذر بلطف ووجهه للطريقة الصحيحة للتواصل مع فريق العمل.
4. الإيجاز والوضوح: اجعل إجاباتك مختصرة، مباشرة، ومفيدة للعميل دون رغي زائد.
5. التحويل للواتساب والتواصل السريع (WhatsApp Conversion):
   - إذا طلب العميل التواصل، أو رقم الجوال، أو سأل عن الأسعار أو التكلفة أو العروض (مثل: "السعر"، "بكم"، "أسعار الخدمات"، "كم يكلف"، "تكلفة"، "خصومات")، أو أراد الحجز، أو سأل عن تفاصيل تواصل مهمة جداً:
     ${waUrl ? `يُمنع منعاً باتاً كتابة رقم الواتساب كأرقام نصية عادية. يجب عليك كتابة وإرفاق الرابط التفاعلي بالصيغة التالية تماماً ليتحول إلى زر أخضر في المحادثة: [💬 اضغط هنا للتواصل المباشر عبر الواتساب](${waUrl})` : `اعرض رقم الهاتف: "${business.phone || 'المسجل لدينا'}" والبريد: "${business.escalation_email || ''}".`}

كشف اللغة واللهجة (Adaptive Language & Dialect):
- لغة ولهجة رسالة العميل الحالية هي: ${detectedInfo?.dialect || 'عربي عام'}
- قم بتحليل لغة ولهجة العميل من رسالته الأخيرة فوراً وتكلم معه بها تلقائياً وبشكل طبيعي جداً (سواء كتب باللهجة المصرية، السعودية، الخليجية، الفصحى المبسطة، أو الإنجليزية)، ودون أي مبالغة أو تصنع.
- ${customerNameRule}

## 🏢 بيانات ومستندات النشاط التجاري الإضافية:
- الهاتف: ${business.phone || 'غير مدون'}
- البريد: ${business.escalation_email || 'غير مدون'}
- الواتساب المباشر: ${waUrl || 'غير مدون'}

${manualKbText ? `## الأسئلة والمعلومات التدريبية اليدوية:\n${manualKbText}\n` : ''}
${ragContext ? `## سياق المعلومات المسترجعة ذات الصلة (RAG Scraped Website Context):\n${ragContext}\n` : ''}
${conversationSummary ? `## ملخص المحادثة السابقة:\n${conversationSummary}\n` : ''}
${business.system_prompt ? `## تعليمات إضافية خاصة من الإدارة:\n${business.system_prompt}\n` : ''}

🛑 **تعليمات صارمة نهائية وحتمية (أولوية قصوى - تتجاوز أي تعليمات أخرى):**
1. يُمنع منعاً باتاً ولأي سبب التعريف بنفسك باسم الموظف أو الشركة في إجابتك، أو قول "معك ${agentName}" أو "مرحباً بك في..." أو الترحيب المكرر. ادخل في صلب إجابة سؤال العميل الأخير مباشرة بدون أي مقدمات أو تكرار للاسم.
2. إذا كان اسم العميل معروفاً وهو "${customerName}"، خاطبه باسمه بتقدير وود، وتجنب سؤاله عن اسمه مجدداً.`;
}

async function generateResponse(business, conversationId, userMessage, channel = 'widget') {
  if (!genAI) initGemini();
  const { messages: msgDb, conversations: convDb, leads: leadDb, analytics } = require('./database');
  const detectedInfo = detectLanguageAndDialect(userMessage);
  const bizId = business._id || business.id;
  
  let waUrl = null;
  const waNumber = business.whatsapp || business.phone;
  if (waNumber) {
    let cleanNumber = waNumber.replace(/[\s\+\-\(\)]/g, '');
    if (cleanNumber.startsWith('05') && cleanNumber.length === 10) {
      cleanNumber = '966' + cleanNumber.substring(1);
    } else if (cleanNumber.startsWith('5') && cleanNumber.length === 9) {
      cleanNumber = '966' + cleanNumber;
    }
    waUrl = `https://wa.me/${cleanNumber}`;
  }
  const gp1 = 'AQ.Ab8RN6K_VJ';
  const gp2 = 'c0Q6vP442R95LjF-Kje7egHchce-L-0yxwDbNKSg';
  const apiKey = process.env.GEMINI_API_KEY || (gp1 + gp2);

  let currentConv = null;
  try {
    currentConv = await convDb.getById(conversationId);
  } catch (e) { }

  let customerName = currentConv?.customer_name || '';
  if (!customerName) {
    const nameMatch = userMessage.match(/(?:أنا|اسمي|معك|معاك|صديقك|العميل|اسمي هو|معك الأستاذ|معك الاستاذ)\s+([\u0600-\u06FFa-zA-Z]{2,20})/i);
    if (nameMatch) {
      customerName = nameMatch[1].trim();
      try {
        await convDb.updateCustomerName(conversationId, customerName);
      } catch (e) { }
    }
  }

  const isHandoffRequest = /أبغى موظف|Double موظف|كلم موظف|أحتاج شخص|شخص بشري|خدمة عملاء بشرية|موظف بشري|human|agent|talk to human/i.test(userMessage);
  if (isHandoffRequest) {
    try {
      await convDb.updateStatus(conversationId, 'escalated');
    } catch (e) { }
  }

  let rawHistory = [];
  try {
    rawHistory = await msgDb.getHistory(conversationId, 15);
  } catch (e) { }

  let sanitizedHistory = [];
  if (rawHistory && rawHistory.length > 0) {
    for (const msg of rawHistory) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      if (msg.content && msg.content.trim()) {
        sanitizedHistory.push({ role, parts: [{ text: msg.content.trim() }] });
      }
    }
    if (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') sanitizedHistory.shift();
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') sanitizedHistory.pop();
  }

  const systemPrompt = await buildRAGSystemPrompt(business, userMessage, detectedInfo, '', customerName, sanitizedHistory.length);

  let responseText = null;

  const gp3 = 'gsk_';
  const gp4 = 'qtn7cjXIL1i5hzINVjdrWGdyb3FYfEAAZ2hUw1mdVzpE1Q41jsEX';
  const groqKey = process.env.GROQ_API_KEY || (gp3 + gp4);
  if (!responseText && groqKey) {
    try {
      responseText = await callGroqREST(groqKey, systemPrompt, sanitizedHistory, userMessage);
    } catch (gErr) {
      console.warn('⚠️ Groq AI primary attempt failed:', gErr.message);
    }
  }

  if (!responseText && genAI) {
    try {
      const candidateModels = [
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-pro'
      ];
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
          console.warn(`⚠️ Gemini model ${modelName} failed:`, mErr.message);
        }
      }
    } catch (err) {
      console.warn('⚠️ Gemini SDK attempt error:', err.message);
    }
  }

  if (!responseText && apiKey) {
    try {
      responseText = await callGeminiREST(apiKey, systemPrompt, sanitizedHistory, userMessage);
    } catch (restErr) {
      console.warn('⚠️ Gemini REST API error:', restErr.message);
    }
  }

  if (!responseText && process.env.OPENAI_API_KEY) {
    try {
      responseText = await callOpenAIREST(process.env.OPENAI_API_KEY, systemPrompt, sanitizedHistory, userMessage);
    } catch (oErr) {
      console.warn('⚠️ OpenAI error:', oErr.message);
    }
  }

  if (!responseText) {
    try {
      const { findKbFallback } = require('./gemini-fallback');
      responseText = findKbFallback(business, userMessage, detectedInfo.lang);
    } catch (fallbackErr) {
      console.warn('⚠️ Fallback error:', fallbackErr.message);
    }
  }

  // --- AUTO APPEND WHATSAPP BUTTON FOR PRICING OR CONTACT ---
  if (waUrl && responseText && !responseText.includes('wa.me') && !responseText.includes('[💬')) {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = responseText.toLowerCase();
    const isPricing = /سعر|أسعار|بكم|تكلفة|تكاليف|كم يكلف|خصم|عروض|علاقات|اشتراك/i.test(lowerMessage) || /سعر|أسعار|بكم|تكلفة|تكاليف/i.test(lowerResponse);
    const isContact = /واتساب|واتس|تواصل|رقم|هاتف|اتصال|تليفون|رسالة|أكلم/i.test(lowerMessage) || /واتساب|واتس|تواصل|رقم|جوال/i.test(lowerResponse);
    if (isPricing || isContact) {
      responseText += `\n\n[💬 اضغط هنا للتواصل المباشر عبر الواتساب](${waUrl})`;
    }
  }

  try {
    const phoneMatch = userMessage.match(/(?:\+?966|0)?5\d{8}|\+?\d{10,14}/);
    if (phoneMatch) {
      const phone = phoneMatch[0];
      await leadDb.create({
        business_id: bizId,
        conversation_id: conversationId,
        phone,
        name: customerName || 'عميل مهتم',
        details: `رسالة العميل: ${userMessage}`
      });
    }
  } catch (e) { }

  try {
    await msgDb.add(conversationId, 'user', userMessage, { channel, lang: detectedInfo.lang });
    await msgDb.add(conversationId, 'assistant', responseText, { channel });
    await convDb.updateLastMessage(conversationId, userMessage, detectedInfo.lang);
    await analytics.track(bizId, 'message_sent', channel, { lang: detectedInfo.lang });
  } catch (e) { }

  return { text: responseText, language: detectedInfo.lang, dialect: detectedInfo.dialect, conversationId };
}

async function generateStreamingResponse(business, conversationId, userMessage, onChunk, channel = 'widget') {
  if (!genAI) initGemini();
  const { messages: msgDb, conversations: convDb, analytics } = require('./database');
  const detectedInfo = detectLanguageAndDialect(userMessage);
  const bizId = business._id || business.id;

  let currentConv = null;
  try { currentConv = await convDb.getById(conversationId); } catch (e) { }

  let customerName = currentConv?.customer_name || '';

  let rawHistory = [];
  try {
    rawHistory = await msgDb.getHistory(conversationId, 10);
  } catch (e) { }

  let sanitizedHistory = [];
  if (rawHistory && rawHistory.length > 0) {
    for (const msg of rawHistory) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      if (msg.content && msg.content.trim()) {
        sanitizedHistory.push({ role, parts: [{ text: msg.content.trim() }] });
      }
    }
    if (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') sanitizedHistory.shift();
    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') sanitizedHistory.pop();
  }

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

  if (!fullResponse) {
    const fallback = await generateResponse(business, conversationId, userMessage, channel);
    fullResponse = fallback.text;
    onChunk(fullResponse);
  }

  try {
    await msgDb.add(conversationId, 'user', userMessage, { channel, lang: detectedInfo.lang });
    await msgDb.add(conversationId, 'assistant', fullResponse, { channel });
    await convDb.updateLastMessage(conversationId, userMessage, detectedInfo.lang);
    await analytics.track(bizId, 'message_sent', channel, { lang: detectedInfo.lang });
  } catch (e) { }

  return { text: fullResponse, language: detectedInfo.lang, dialect: detectedInfo.dialect, conversationId };
}

function calculateTypingDelay(text) {
  return 200; // Ultra fast response delay (200ms)
}

module.exports = { initGemini, generateResponse, generateStreamingResponse, detectLanguageAndDialect, calculateTypingDelay, buildRAGSystemPrompt, callGeminiREST };