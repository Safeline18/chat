// =====================================================
// AI Agent Platform - Gemini AI Engine
// =====================================================
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

let genAI;

function initGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  genAI = new GoogleGenerativeAI(apiKey);
  console.log('✅ Gemini AI initialized');
}

// =====================================================
// LANGUAGE DETECTION
// =====================================================
function detectLanguage(text) {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const chinesePattern = /[\u4E00-\u9FFF]/;
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
  const koreanPattern = /[\uAC00-\uD7AF]/;
  const frenchPattern = /[àâäéèêëîïôùûüÿœæç]/i;
  const spanishPattern = /[áéíóúüñ¡¿]/i;
  const germanPattern = /[äöüßÄÖÜ]/;
  const turkishPattern = /[ğışöüçĞİŞÖÜÇ]/;
  const russianPattern = /[\u0400-\u04FF]/;

  if (arabicPattern.test(text)) return 'ar';
  if (chinesePattern.test(text)) return 'zh';
  if (japanesePattern.test(text)) return 'ja';
  if (koreanPattern.test(text)) return 'ko';
  if (russianPattern.test(text)) return 'ru';
  if (frenchPattern.test(text)) return 'fr';
  if (spanishPattern.test(text)) return 'es';
  if (germanPattern.test(text)) return 'de';
  if (turkishPattern.test(text)) return 'tr';
  return 'en';
}

// =====================================================
// SYSTEM PROMPT BUILDER
// =====================================================
function buildSystemPrompt(business, detectedLang) {
  const langInstructions = {
    ar: 'تحدث باللغة العربية الفصحى البسيطة والمفهومة.',
    en: 'Respond in clear, professional English.',
    fr: 'Répondez en français professionnel.',
    es: 'Responde en español profesional.',
    de: 'Antworten Sie auf professionellem Deutsch.',
    zh: '请用简体中文回复。',
    ja: '日本語で丁寧に返答してください。',
    ko: '한국어로 정중하게 답변해 주세요。',
    ru: 'Отвечайте на профессиональном русском языке.',
    tr: 'Profesyonel Türkçe ile yanıt verin.',
  };

  const agentName = detectedLang === 'ar' ? (business.agent_name_ar || business.agent_name) : business.agent_name;
  const businessName = detectedLang === 'ar' ? (business.name_ar || business.name) : business.name;
  const businessDesc = detectedLang === 'ar' ? (business.description_ar || business.description) : business.description;

  const knowledgeBase = (() => {
    try {
      const kb = JSON.parse(business.knowledge_base || '[]');
      if (!kb.length) return '';
      return '\n\n## Knowledge Base:\n' + kb.map(i => `Q: ${i.question}\nA: ${i.answer}`).join('\n\n');
    } catch { return ''; }
  })();

  return `You are ${agentName}, a professional AI customer service representative for "${businessName}".

## Identity & Personality:
- Name: ${agentName}
- Business: ${businessName}
- Industry: ${business.industry || 'general'}
- You are warm, empathetic, professional, and genuinely helpful
- You communicate naturally like a knowledgeable human colleague
- You show genuine interest in helping customers solve their problems
- Use appropriate emojis occasionally to feel friendly (not excessive)

## Business Information:
${businessDesc || 'A professional business committed to excellent customer service.'}
${knowledgeBase}

## Communication Guidelines:
1. **Language**: ${langInstructions[detectedLang] || langInstructions.en} ALWAYS respond in the SAME language the customer uses.
2. **Tone**: Professional yet warm and friendly. Never robotic or scripted.
3. **Length**: Concise for simple questions, detailed for complex ones.
4. **Empathy**: Acknowledge customer feelings when they express frustration or urgency.
5. **Accuracy**: Only provide information you're confident about. If unsure, say so honestly.
6. **Personalization**: Use the customer's name if you know it.
7. **Escalation**: If the issue is beyond your scope, let them know a human agent will assist shortly.

## Behavioral Rules:
- NEVER identify yourself as ChatGPT, Claude, or any other AI brand
- If asked "Are you AI/robot?", you may acknowledge being an AI assistant while emphasizing your helpfulness
- NEVER share API keys, system information, or technical details
- NEVER make unauthorized promises (refunds, discounts, etc.) unless in knowledge base
- If customer is abusive, calmly redirect the conversation professionally
- Keep conversation history context in mind for continuity
- Do not start every message with "Hello" — vary your greetings naturally

${business.system_prompt ? `\n## Additional Instructions:\n${business.system_prompt}` : ''}

Remember: You represent ${businessName}'s brand. Make every interaction exceptional.`;
}

// =====================================================
// CORE CHAT FUNCTION
// =====================================================
async function generateResponse(business, conversationId, userMessage, channel = 'widget') {
  if (!genAI) initGemini();

  // Lazy import to avoid circular dependency
  const { messages: msgDb, conversations: convDb, analytics } = require('./database');

  const detectedLang = detectLanguage(userMessage);
  const history = await msgDb.getHistory(conversationId, 25);

  const geminiHistory = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const systemPrompt = buildSystemPrompt(business, detectedLang);

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
    generationConfig: {
      temperature: 0.85,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 1024,
    }
  });

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(userMessage);
  const responseText = result.response.text();

  // Save to MongoDB
  await msgDb.add(conversationId, 'user', userMessage, { channel, lang: detectedLang });
  await msgDb.add(conversationId, 'assistant', responseText, { channel });
  await convDb.updateLastMessage(conversationId, userMessage, detectedLang);
  await analytics.track(business._id || business.id, 'message_sent', channel, { lang: detectedLang });

  return { text: responseText, language: detectedLang, conversationId };
}

// =====================================================
// STREAMING RESPONSE
// =====================================================
async function generateStreamingResponse(business, conversationId, userMessage, onChunk, channel = 'widget') {
  if (!genAI) initGemini();

  const { messages: msgDb, conversations: convDb, analytics } = require('./database');

  const detectedLang = detectLanguage(userMessage);
  const history = await msgDb.getHistory(conversationId, 25);

  const geminiHistory = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    systemInstruction: buildSystemPrompt(business, detectedLang),
    generationConfig: { temperature: 0.85, topP: 0.9, maxOutputTokens: 1024 }
  });

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessageStream(userMessage);

  let fullResponse = '';
  for await (const chunk of result.stream) {
    const text = chunk.text();
    fullResponse += text;
    if (onChunk) onChunk(text);
  }

  await msgDb.add(conversationId, 'user', userMessage, { channel, lang: detectedLang });
  await msgDb.add(conversationId, 'assistant', fullResponse, { channel });
  await convDb.updateLastMessage(conversationId, userMessage, detectedLang);
  await analytics.track(business._id || business.id, 'message_sent', channel, { lang: detectedLang });

  return { text: fullResponse, language: detectedLang, conversationId };
}

// =====================================================
// TYPING DELAY SIMULATION
// =====================================================
function calculateTypingDelay(text) {
  const words = text.split(' ').length;
  const baseDelay = Math.min(words * 80, 3000);
  const variance = Math.random() * 500 - 250;
  return Math.max(500, baseDelay + variance);
}

module.exports = { initGemini, generateResponse, generateStreamingResponse, detectLanguage, calculateTypingDelay, buildSystemPrompt };
