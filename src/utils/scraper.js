// =====================================================
// AI Agent Platform - 1-Click AI Business Generator from URL
// Scrapes website URL and uses Gemini AI to automatically populate
// Business Name, Description, Phone, Email, Services, and 15+ FAQs!
// =====================================================
const { GoogleGenerativeAI } = require('@google/generative-ai');

function cleanHtmlText(html) {
  if (!html) return '';

  // Remove scripts, styles, navs, footers, headers
  let clean = html
    .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<noscript\b[^<]*>([\s\S]*?)<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*>([\s\S]*?)<\/svg>/gi, '');

  // Extract headings and paragraphs
  const headingMatches = clean.match(/<(h[1-6]|p|li|td)[^>]*>([\s\S]*?)<\/\1>/gi) || [];

  const textBlocks = headingMatches.map(block => {
    return block
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }).filter(t => t.length > 10);

  if (textBlocks.length > 0) {
    return textBlocks.join('\n');
  }

  return clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchWebsiteHtml(websiteUrl) {
  let url = websiteUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  console.log(`🌐 1-Click Setup: Fetching website ${url}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Could not access website (${response.status} ${response.statusText}). Please check URL.`);
  }

  const html = await response.text();

  // Extract title, email, phone
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const phones = html.match(/(?:\+?966|0)?5\d{8}|\+?\d{10,14}/g) || [];

  const textContent = cleanHtmlText(html);

  return {
    url,
    title,
    email: emails[0] || '',
    phone: phones[0] || '',
    rawText: textContent
  };
}

async function generateBusinessFromUrl(websiteUrl) {
  const pageData = await fetchWebsiteHtml(websiteUrl);

  const apiKey = process.env.GEMINI_API_KEY;
  let resultJson = null;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `You are an expert AI business analyst. Analyze the following website text and extract/generate a complete structured JSON profile for an AI Customer Assistant.

Website Title: "${pageData.title}"
Website Text Content (truncated):
${pageData.rawText.substring(0, 4000)}

Generate a JSON object with EXACTLY the following structure (return ONLY valid raw JSON, no markdown codeblock formatting):
{
  "name": "English business name",
  "name_ar": "اسم الشركة بالعربي",
  "description_ar": "وصف تفصيلي شامل للشركة وخدماتها ومميزاتها باللغة العربية",
  "industry": "one of: logistics, retail, restaurant, healthcare, technology, realestate, general",
  "agent_name_ar": "اسم مناسب للمساعد مثل: سارة، هالة، أحمد، مريم",
  "welcome_message_ar": "رسالة ترحيبية ودية ومميزة بالعملاء",
  "escalation_email": "${pageData.email}",
  "knowledge_base": [
    {
      "question": "سؤال متوقع يطرحه العميل",
      "answer": "إجابة كاملة وتفصيلية ودقيقة"
    }
  ]
}

Provide at least 10 to 15 comprehensive Q&As in "knowledge_base" covering:
1. What services/products are offered in detail
2. How to order / request quotes or clearance
3. Working hours & location
4. Required documents or conditions
5. Contact methods
6. General customer inquiries about the business
`;

      const res = await model.generateContent(prompt);
      let text = res.response.text().trim();
      if (text.startsWith('```json')) text = text.replace(/```json|```/g, '').trim();
      if (text.startsWith('```')) text = text.replace(/```/g, '').trim();

      resultJson = JSON.parse(text);
    } catch (e) {
      console.warn('⚠️ Gemini AI auto-parsing warning:', e.message);
    }
  }

  // Fallback if Gemini AI auto-parsing is unavailable
  if (!resultJson) {
    const bizName = pageData.title.split(/[-|_|•]/)[0].trim() || 'المشروع الجديد';
    const lines = pageData.rawText.split('\n').filter(l => l.length > 20);

    const kbItems = lines.slice(0, 10).map((line, i) => ({
      question: `معلومات عن: ${line.substring(0, 35)}...`,
      answer: line
    }));

    kbItems.unshift({
      question: "ما هي خدمات ورؤية الشركة؟",
      answer: pageData.rawText.substring(0, 300)
    });

    resultJson = {
      name: bizName,
      name_ar: bizName,
      description_ar: pageData.rawText.substring(0, 250),
      industry: 'general',
      agent_name_ar: 'هالة',
      welcome_message_ar: `أهلاً وسهلاً بك في ${bizName}! 😊 كيف يمكننا مساعدتك اليوم؟`,
      escalation_email: pageData.email,
      knowledge_base: kbItems
    };
  }

  return {
    name: resultJson.name || pageData.title,
    name_ar: resultJson.name_ar || pageData.title,
    description: resultJson.description_ar,
    description_ar: resultJson.description_ar,
    industry: resultJson.industry || 'general',
    agent_name: 'Aria',
    agent_name_ar: resultJson.agent_name_ar || 'هالة',
    welcome_message: `Welcome to ${resultJson.name || pageData.title}! How can I help you today? 😊`,
    welcome_message_ar: resultJson.welcome_message_ar || `أهلاً وسهلاً بك! كيف يمكننا مساعدتك اليوم؟ 😊`,
    escalation_email: resultJson.escalation_email || pageData.email,
    knowledge_base: resultJson.knowledge_base || []
  };
}

module.exports = { generateBusinessFromUrl, cleanHtmlText };
