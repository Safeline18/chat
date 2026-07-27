// =====================================================
// AI Agent Platform - Deep Multi-Page Crawler & RAG Extractor
// Discovers internal links (/services, /pricing, /about, /contact, /faq, etc.),
// extracts structured content, chunks it into Knowledge Base RAG storage,
// and uses Gemini AI to auto-populate the Business Profile!
// =====================================================
const { GoogleGenerativeAI } = require('@google/generative-ai');

function cleanHtmlText(html) {
  if (!html) return '';

  let clean = html
    .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<noscript\b[^<]*>([\s\S]*?)<\/noscript>/gi, '')
    .replace(/<svg\b[^<]*>([\s\S]*?)<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const headingMatches = clean.match(/<(h[1-6]|p|li|td|th)[^>]*>([\s\S]*?)<\/\1>/gi) || [];

  const textBlocks = headingMatches.map(block => {
    return block
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }).filter(t => t.length > 8);

  if (textBlocks.length > 0) {
    return textBlocks.join('\n');
  }

  return clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const baseDomain = new URL(baseUrl).hostname.replace(/^www\./, '');
  const linkRegex = /href=["']([^"']+)["']/gi;
  let match;

  const priorityPaths = ['/about', '/services', '/products', '/menu', '/contact', '/faq', '/pricing', '/branches', '/locations', '/shipping', '/returns', '/terms'];

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    try {
      const fullUrl = new URL(href, baseUrl).href;
      const urlObj = new URL(fullUrl);
      const host = urlObj.hostname.replace(/^www\./, '');

      if (host === baseDomain && !/\.(jpg|png|gif|pdf|css|js|zip|svg|ico)$/i.test(urlObj.pathname)) {
        links.add(fullUrl);
      }
    } catch (e) {}
  }

  const sortedLinks = Array.from(links).sort((a, b) => {
    const aPriority = priorityPaths.some(p => a.toLowerCase().includes(p)) ? 0 : 1;
    const bPriority = priorityPaths.some(p => b.toLowerCase().includes(p)) ? 0 : 1;
    return aPriority - bPriority;
  });

  return sortedLinks;
}

async function fetchPage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : url;
    const cleanText = cleanHtmlText(html);

    return { url, title, html, text: cleanText };
  } catch (e) {
    return null;
  }
}

async function crawlWebsite(baseUrl, maxPages = 10) {
  let normalizedUrl = baseUrl.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  const visited = new Set();
  const queue = [normalizedUrl];
  const pagesData = [];

  console.log(`🚀 Starting Deep Crawler for: ${normalizedUrl}`);

  while (queue.length > 0 && pagesData.length < maxPages) {
    const currentUrl = queue.shift();
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    const page = await fetchPage(currentUrl);
    if (!page || !page.text) continue;

    pagesData.push(page);

    // Extract links from homepage to crawl priority internal pages
    if (visited.size === 1) {
      const internalLinks = extractLinks(page.html, currentUrl);
      for (const link of internalLinks) {
        if (!visited.has(link) && queue.length < 20) {
          queue.push(link);
        }
      }
    }

    // Rate limiting delay
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`✅ Deep Crawl complete: Analyzed ${pagesData.length} pages.`);
  return pagesData;
}

function classifyContentType(url, text) {
  const path = url.toLowerCase();
  if (path.includes('service') || path.includes('خدمات') || path.includes('تخليص') || path.includes('شحن')) return 'services';
  if (path.includes('price') || path.includes('pricing') || path.includes('سعر') || path.includes('أسعار')) return 'pricing';
  if (path.includes('about') || path.includes('عن') || path.includes('من_نحن')) return 'about';
  if (path.includes('contact') || path.includes('اتصل') || path.includes('تواصل')) return 'contact';
  if (path.includes('faq') || path.includes('أسئلة') || path.includes('اسئلة')) return 'faq';
  if (path.includes('ship') || path.includes('return') || path.includes('refund') || path.includes('شحن') || path.includes('استرجاع')) return 'policies';
  return 'general';
}

async function processWebsiteAndGenerateRAG(baseUrl, businessId) {
  const { knowledgeChunks: chunkDb, businesses: bizDb } = require('../database');
  const pages = await crawlWebsite(baseUrl, 10);

  if (!pages.length) {
    throw new Error('Could not access website or extract content. Please check the URL.');
  }

  const allTextChunks = [];
  const rawCombinedText = pages.map(p => `--- PAGE: ${p.title} (${p.url}) ---\n${p.text}`).join('\n\n');

  // Extract contacts & social media links from combined text
  const emails = rawCombinedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const phones = rawCombinedText.match(/(?:\+?966|0)?5\d{8}|\+?\d{10,14}/g) || [];
  const socialMatches = rawCombinedText.match(/(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|linkedin\.com|youtube\.com|snapchat\.com|wa\.me)\/[a-zA-Z0-9_.-]+/gi) || [];
  const uniqueSocials = [...new Set(socialMatches)];

  const addressLines = rawCombinedText.split('\n').filter(line =>
    /شارع|حي|طريق|مبنى|فرع|مكة|الرياض|جدة|دبي|القاهرة|الدمام|المناطق|address|street|building|city|location/i.test(line)
  ).slice(0, 8);

  // Create Knowledge Chunks for each page
  for (const p of pages) {
    const contentType = classifyContentType(p.url, p.text);
    const paragraphs = p.text.split('\n').filter(l => l.length > 25);

    // Group text into ~300-500 char chunks
    let currentChunk = '';
    for (const para of paragraphs) {
      if ((currentChunk + '\n' + para).length > 400) {
        if (currentChunk.trim()) {
          allTextChunks.push({
            business_id: businessId,
            source_url: p.url,
            page_title: p.title,
            content_type: contentType,
            doc_lang: 'ar',
            content: currentChunk.trim(),
            keywords: currentChunk.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 10)
          });
        }
        currentChunk = para;
      } else {
        currentChunk += '\n' + para;
      }
    }
    if (currentChunk.trim()) {
      allTextChunks.push({
        business_id: businessId,
        source_url: p.url,
        page_title: p.title,
        content_type: contentType,
        doc_lang: 'ar',
        content: currentChunk.trim(),
        keywords: currentChunk.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 10)
      });
    }
  }

  // Add Social Media & Address Chunks
  if (uniqueSocials.length > 0) {
    allTextChunks.push({
      business_id: businessId,
      source_url: baseUrl,
      page_title: 'حسابات التواصل الاجتماعي والمعلومات المباشرة',
      content_type: 'contact',
      doc_lang: 'ar',
      content: `روابط التواصل الاجتماعي الرسمية:\n${uniqueSocials.join('\n')}`,
      keywords: ['تواصل', 'انستغرام', 'تويتر', 'سناب', 'فيسبوك', 'واتساب']
    });
  }

  if (addressLines.length > 0) {
    allTextChunks.push({
      business_id: businessId,
      source_url: baseUrl,
      page_title: 'الفروع والعناوين والمواقع الجغرافية',
      content_type: 'branches',
      doc_lang: 'ar',
      content: `العناوين والمواقع الجغرافية المسجلة:\n${addressLines.join('\n')}`,
      keywords: ['عنوان', 'فرع', 'موقع', 'مدينة', 'شارع']
    });
  }

  // Clear previous chunks & save new RAG chunks to MongoDB
  if (businessId) {
    await chunkDb.clearBusinessChunks(businessId);
    if (allTextChunks.length > 0) {
      await chunkDb.addBulk(businessId, allTextChunks);
    }
  }

  // Pass aggregated text to Gemini AI to generate Business Profile
  let profile = null;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `You are a master AI Business Analyst. Analyze the following combined scraped website data and generate a JSON profile object.

Website Homepage Title: "${pages[0].title}"
Crawled Data:
${rawCombinedText.substring(0, 6000)}

Return ONLY a valid raw JSON object (no markdown block formatting) matching this schema:
{
  "name": "English Business Name",
  "name_ar": "اسم النشاط التجاري بالعربي",
  "description_ar": "وصف تفصيلي شامل للنشاط والخدمات باللغة العربية",
  "industry": "one of: logistics, retail, restaurant, healthcare, technology, realestate, general",
  "agent_name_ar": "اسم مناسب للمساعد المالي أو الفني مثل: سارة، هالة، أحمد، مريم",
  "welcome_message_ar": "رسالة ترحيبية بالعميل مناسبة للنشاط",
  "phone": "${phones[0] || ''}",
  "escalation_email": "${emails[0] || ''}",
  "shipping_policy": "سياسة الشحن أو التوصيل المتاحة",
  "return_policy": "سياسة الاسترجاع إن وجدت",
  "knowledge_base": [
    {
      "question": "سؤال العميل المتوقع",
      "answer": "إجابة كاملة ودقيقة"
    }
  ]
}
Include 15+ comprehensive Q&As in "knowledge_base" covering services, pricing, ordering, location, and conditions.
`;

      const res = await model.generateContent(prompt);
      let text = res.response.text().trim();
      if (text.startsWith('```json')) text = text.replace(/```json|```/g, '').trim();
      if (text.startsWith('```')) text = text.replace(/```/g, '').trim();

      profile = JSON.parse(text);
    } catch (e) {
      console.warn('⚠️ Gemini Profile Generation Warning:', e.message);
    }
  }

  if (!profile) {
    const mainTitle = pages[0].title.split(/[-|_|•]/)[0].trim() || 'النشاط التجاري';
    profile = {
      name: mainTitle,
      name_ar: mainTitle,
      description_ar: rawCombinedText.substring(0, 300),
      industry: 'general',
      agent_name_ar: 'هالة',
      welcome_message_ar: `أهلاً وسهلاً بك في ${mainTitle}! 😊 كيف يمكننا مساعدتك اليوم؟`,
      phone: phones[0] || '',
      escalation_email: emails[0] || '',
      knowledge_base: pages.slice(0, 10).map(p => ({
        question: `معلومات عن: ${p.title}`,
        answer: p.text.substring(0, 250)
      }))
    };
  }

  // Update Business in DB if businessId provided
  if (businessId) {
    await bizDb.update(businessId, {
      name: profile.name || pages[0].title,
      name_ar: profile.name_ar || pages[0].title,
      description: profile.description_ar,
      description_ar: profile.description_ar,
      industry: profile.industry || 'general',
      website_url: baseUrl,
      last_scanned_at: new Date(),
      scanned_pages_count: pages.length,
      ai_status: 'active',
      agent_name_ar: profile.agent_name_ar || 'هالة',
      welcome_message_ar: profile.welcome_message_ar,
      phone: profile.phone || phones[0] || '',
      escalation_email: profile.escalation_email || emails[0] || '',
      shipping_policy: profile.shipping_policy || '',
      return_policy: profile.return_policy || '',
      knowledge_base: JSON.stringify(profile.knowledge_base || [])
    });
  }

  return {
    pagesCount: pages.length,
    chunksCount: allTextChunks.length,
    profile,
    chunks: allTextChunks
  };
}

module.exports = { crawlWebsite, processWebsiteAndGenerateRAG, cleanHtmlText };
