// =====================================================
// AI Agent Platform - Website Scraper & Content Extractor
// Scrapes website content and extracts Q&As and business services
// =====================================================

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

  // Fallback strip all HTML tags
  return clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function scrapeWebsite(websiteUrl) {
  let url = websiteUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  console.log(`🌐 Fetching website content from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch website (${response.status} ${response.statusText})`);
  }

  const html = await response.text();
  const extractedText = cleanHtmlText(html);

  console.log(`✅ Extracted ${extractedText.length} chars of text from website.`);

  // Auto-generate Knowledge Base Q&A items from text
  const kbItems = [];
  const lines = extractedText.split('\n').filter(l => l.length > 20);

  // Extract potential services and about us
  let aboutText = '';
  let services = [];

  for (const line of lines) {
    if (/عن|من نحن|شركة|نبذة|about|who we are/i.test(line) && !aboutText) {
      aboutText = line.substring(0, 300);
    }
    if (/خدمات|تخريص|لوجست|نقل|تخزين|شحن|سابر|تسجيل|services|clearance|shipping/i.test(line)) {
      if (services.length < 8 && !services.includes(line)) {
        services.push(line);
      }
    }
  }

  if (aboutText) {
    kbItems.push({
      question: "من نحن وما هي نبذة عن الشركة؟",
      answer: aboutText
    });
  }

  if (services.length > 0) {
    kbItems.push({
      question: "ما هي أهم الخدمات المقدمة؟",
      answer: services.join(' • ')
    });
  }

  // Group chunks into Q&A pairs
  for (let i = 0; i < Math.min(lines.length, 12); i += 2) {
    const textChunk = lines[i];
    if (textChunk && textChunk.length > 30) {
      kbItems.push({
        question: `معلومات عن: ${textChunk.substring(0, 40)}...`,
        answer: textChunk
      });
    }
  }

  return {
    rawText: extractedText.substring(0, 3000),
    kbItems: kbItems.slice(0, 10),
    summary: aboutText || extractedText.substring(0, 250)
  };
}

module.exports = { scrapeWebsite, cleanHtmlText };
