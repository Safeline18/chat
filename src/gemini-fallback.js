// =====================================================
// AI Agent Platform - Fallback KB Engine
// Backup in case of API Key failure or network drops
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

  // 1. Name query
  if (text.includes('اسمك') || text.includes('من انت') || text.includes('من أنت') || text.includes('مين انت') || text.includes('who are you') || text.includes('your name')) {
    return isArabic ?
      `أهلاً بك! أنا ${agentName}، المساعد الافتراضي لـ ${businessName} 😊 كيف أستطيع مساعدتك اليوم؟` :
      `Hello! I am ${agentName}, virtual assistant for ${businessName} 😊 How can I help you today?`;
  }

  // 2. Services query
  if (text.includes('خدمات') || text.includes('خدماتك') || text.includes('تقدمون') || text.includes('تعملوا') || text.includes('service') || text.includes('offer')) {
    if (kb.length > 0) {
      const mainServices = kb.slice(0, 5).map(k => `• ${k.question}: ${k.answer}`).join('\n\n');
      return isArabic ?
        `أهلاً بك! نقدم في ${businessName} مجموعة متكاملة من الخدمات المتميزة:\n\n${mainServices}\n\nيسعدني جداً إجابة أي استفسار محدد لديك! 😊` :
        `Welcome! At ${businessName}, we offer a comprehensive range of services:\n\n${mainServices}\n\nHow can I assist you with these services today? 😊`;
    }
  }

  // 3. Direct match
  for (const item of kb) {
    const q = (item.question || '').toLowerCase();
    if (q && (text.includes(q) || q.includes(text))) {
      return item.answer;
    }
  }

  // 4. Overlap match
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

  // 5. Friendly general response
  return isArabic ?
    `أهلاً وسهلاً بك في ${businessName}! 🌸 أنا ${agentName} ويسعدني تواصلك معنا. كيف يمكنني مساعدتك اليوم بخصوص خدماتنا؟` :
    `Welcome to ${businessName}! 🌸 I am ${agentName}. How can I assist you with our services today?`;
}

module.exports = { findKbFallback };
