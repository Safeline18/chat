// =====================================================
// AI Agent Platform - Fallback Module
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

  // Direct KB Answer Match
  for (const item of kb) {
    const q = (item.question || '').toLowerCase();
    if (q && (text.includes(q) || q.includes(text))) {
      return item.answer;
    }
  }

  // Greetings
  if (text.includes('هلا') || text.includes('مرحبا') || text.includes('السلام') || text.includes('hi') || text.includes('hello')) {
    return isArabic ?
      `أهلاً بك! حياك الله، كيف أقدر أساعدك اليوم؟ 😊` :
      `Hello! Welcome to ${businessName}. How can I assist you today? 😊`;
  }

  return isArabic ?
    `أهلاً بك! تفضل كيف أقدر أساعدك؟` :
    `Hello! How can I assist you today?`;
}

module.exports = { findKbFallback };
