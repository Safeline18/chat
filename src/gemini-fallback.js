// =====================================================
// AI Agent Platform - Smart Domain & Fallback Engine
// Provides rich, human-like expert responses tailored to the business domain
// even if Google AI Studio free key hits daily quota limit!
// =====================================================

function findKbFallback(business, userMessage, detectedLang) {
  let kb = [];
  try {
    const rawKb = typeof business.knowledge_base === 'string' ? JSON.parse(business.knowledge_base || '[]') : (business.knowledge_base || []);
    kb = rawKb.filter(i => {
      const q = (i.question || '').toLowerCase();
      const a = (i.answer || '').toLowerCase();
      if (q.includes('.woff') || q.includes('.js') || q.includes('.map') || q.includes('.json')) return false;
      if (a.includes('woff2 file') || a.includes('font-family')) return false;
      return true;
    });
  } catch (e) {}

  const text = (userMessage || '').toLowerCase().trim();
  const isArabic = detectedLang === 'ar' || /[\u0600-\u06FF]/.test(text);

  const agentName = isArabic ? (business?.agent_name_ar || business?.agent_name || 'هالة') : (business?.agent_name || 'Hala');
  const businessName = isArabic ? (business?.name_ar || business?.name || 'الشركة') : (business?.name || 'the company');
  const businessDesc = isArabic ? (business?.description_ar || business?.description || 'خدمات متميزة') : (business?.description || 'premium services');

  // 1. Direct KB Match
  for (const item of kb) {
    const q = (item.question || '').toLowerCase();
    if (q && (text.includes(q) || q.includes(text))) {
      return item.answer;
    }
  }

  // 2. Customs Clearance & Shipping Queries ("شحنة", "تخليص", "جمركي", "بضاعة", "كونتينر", "شحن")
  if (/شحن|شحنة|شحنتك|تخليص|جمرك|جمركي|جمركيا|كونتينر|بضاعة|ميناء|مطار|فسح|سابر/i.test(text)) {
    return isArabic ?
      `أهلاً بك! نسعد بخدمتك في شركة ${businessName} للتخليص الجمركي والخدمات اللوجستية 🚢✈️.\n\nلتخليص شحنتك الجمركية وإتمام إجراءاتها بسرعة ودقة، نحتاج لمعرفة التفاصيل التالية:\n1. هل الشحنة (بحرية أم جوية) وما هو ميناء الوصول؟\n2. هل الشحنة تجارية (شركة/مؤسسة) أم شخصية؟\n3. نوع البضاعة وهل صدرت لها شهادات (مثل سابر أو الغذاء والدواء)؟\n\nتفضل بتزويدنا بالتفاصيل أو ترك رقم جوالك، وسيتواصل معك موظف التخليص الجمركي لدينا فوراً لإكمال كافة الإجراءات!` :
      `Welcome to ${businessName}! 🚢✈️\n\nTo assist you with customs clearance for your shipment, please provide:\n1. Mode of transport (Sea/Air) and port of arrival.\n2. Is the shipment commercial or personal?\n3. Type of goods.\n\nAlternatively, please leave your phone number, and our customs clearance specialist will contact you immediately!`;
  }

  // 3. Asking About Name / Identity ("مين انت", "اسمك", "من انت")
  if (/اسمك|من انت|من أنت|مين انت|who are you|your name/i.test(text)) {
    return isArabic ?
      `أهلاً بك! أنا ${agentName}، المساعد الذكي لشركة ${businessName} 😊 يسعدني تواصلك وإجابة أي استفسارات تخص خدماتنا.` :
      `Hello! I am ${agentName}, virtual assistant for ${businessName} 😊 How can I help you today?`;
  }

  // 4. Asking About Services ("خدماتك", "ايش خدماتك", "ما هي خدماتكم")
  if (/خدمات|خدماتك|تقدمون|تعملوا|services|offer/i.test(text)) {
    if (kb.length > 0) {
      const mainServices = kb.slice(0, 5).map(k => `• ${k.question}: ${k.answer}`).join('\n\n');
      return isArabic ?
        `أهلاً بك! نقدم في ${businessName} مجموعة متكاملة من الخدمات المتميزة:\n\n${mainServices}\n\nيسعدني تزويدك بأي تفاصيل إضافية!` :
        `Welcome! At ${businessName}, we offer comprehensive services:\n\n${mainServices}\n\nHow can I help you with our services today?`;
    }
    if (businessDesc) {
      return isArabic ?
        `أهلاً بك! في ${businessName} نقوم بـ: ${businessDesc}. يسعدنا تواصلك وإجابة كافة استفساراتك!` :
        `Welcome! At ${businessName}, we specialize in: ${businessDesc}. How can I assist you today?`;
    }
  }

  // 5. Working Hours & Contact
  if (/مواعيد|ساعات|دوام|وقت|هاتف|رقم|تواصل|working hours|contact/i.test(text)) {
    return isArabic ?
      `أهلاً بك! ساعات العمل لدى ${businessName} تبدأ من 8:00 صباحاً وحتى 5:00 مساءً من الأحد إلى الخميس.\nهاتف التواصل: ${business.phone || 'المتاح في الموقع'}.` :
      `Hello! Our working hours at ${businessName} are Sunday to Thursday, 8:00 AM to 5:00 PM. Phone: ${business.phone || 'Available on website'}.`;
  }

  // 6. Overlap match in KB
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

  // 7. Rich Human-like General Response
  return isArabic ?
    `أهلاً وسهلاً بك في ${businessName}! 🌸 أنا ${agentName} ويسعدني تواصلك معنا. تفضل بإعطائي تفاصيل استفسارك أو شحنتك، وسأقوم بمساعدتك وتوجيهك فوراً.` :
    `Welcome to ${businessName}! 🌸 I am ${agentName}. How can I assist you with your inquiry or services today?`;
}

module.exports = { findKbFallback };
