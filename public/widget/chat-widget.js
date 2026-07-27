/**
 * AI Agent Platform - Professional Chat Widget
 * Usage: <script src="/widget.js" data-business-id="YOUR_ID"></script>
 * Version: 1.0.0
 */
(function () {
  'use strict';

  // =================== CONFIG ===================
  const script = document.currentScript || document.querySelector('script[data-business-id]');
  const BUSINESS_ID = script?.getAttribute('data-business-id');
  const SERVER_URL = script?.getAttribute('data-server') || (script?.src ? new URL(script.src).origin : window.location.origin);
  const WIDGET_POSITION = script?.getAttribute('data-position') || 'bottom-right';

  if (!BUSINESS_ID) { console.error('[AI Agent Widget] Missing data-business-id'); return; }

  let config = {
    name: 'ZATCA Assistant',
    name_ar: 'هيئة الزكاة والضريبة والجمارك',
    agent_name: 'Hala',
    agent_name_ar: 'هالة',
    welcome_message: 'Hello! This is Hala from ZATCA. How can I help you today?',
    welcome_message_ar: 'أهلاً بك! معك هالة من هيئة الزكاة والضريبة والجمارك (ZATCA).',
    primary_color: '#7C3AED',
    secondary_color: '#06B6D4',
    avatar_url: null,
  };

  let state = {
    isOpen: false,
    conversationId: null,
    messages: [],
    isTyping: false,
    language: 'auto',
    unreadCount: 1,
  };

  // Detect user language
  function getUserLang() {
    const lang = navigator.language || 'en';
    return lang.startsWith('ar') ? 'ar' : 'en';
  }

  function isRTL() { return getUserLang() === 'ar'; }

  function getText(en, ar) {
    return getUserLang() === 'ar' ? (ar || en) : en;
  }

  function hexToRgb(hex) {
    if (!hex) return '124, 58, 237';
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '124, 58, 237';
  }

  // =================== STYLES ===================
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

    #aip-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', 'IBM Plex Sans', sans-serif; }

    #aip-widget {
      position: fixed;
      ${WIDGET_POSITION.includes('right') ? 'right: 24px;' : 'left: 24px;'}
      bottom: 24px;
      z-index: 2147483647;
      direction: ${isRTL() ? 'rtl' : 'ltr'};
    }

    /* TOGGLE BUTTON (Squircle Gradient) */
    #aip-toggle {
      width: 64px; height: 64px;
      border-radius: 20px;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%) !important;
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.4);
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      outline: none;
    }

    #aip-toggle:hover { transform: scale(1.08) translateY(-2px); box-shadow: 0 14px 38px rgba(124, 58, 237, 0.5); }
    #aip-toggle:active { transform: scale(0.94); }

    .aip-toggle-icon { font-size: 26px; color: white; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
    .aip-toggle-icon.hidden { display: none; }

    /* UNREAD BADGE */
    #aip-badge {
      position: absolute;
      top: -4px; right: -4px;
      background: linear-gradient(135deg, #EF4444, #DC2626);
      color: white;
      font-size: 11px;
      font-weight: 800;
      width: 22px; height: 22px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #FFFFFF;
      box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
    }

    /* CHAT WINDOW */
    #aip-window {
      position: absolute;
      ${WIDGET_POSITION.includes('right') ? 'right: 0;' : 'left: 0;'}
      bottom: 78px;
      width: 380px;
      height: 610px;
      background: #FFFFFF;
      color: #1E293B;
      border-radius: 28px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04);
      transform: scale(0.92) translateY(24px);
      opacity: 0;
      pointer-events: none;
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform-origin: bottom right;
    }

    #aip-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* HEADER */
    #aip-header {
      padding: 16px 20px;
      height: 90px;
      display: flex;
      align-items: center;
      gap: 14px;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      background: linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%) !important;
      box-shadow: 0 4px 20px rgba(124, 58, 237, 0.2);
    }

    .aip-avatar {
      width: 54px; height: 54px;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 26px;
      background: #FFFFFF;
      border: none;
      flex-shrink: 0;
      overflow: hidden;
      padding: 4px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
    }

    .aip-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }

    .aip-header-info { flex: 1; min-width: 0; text-align: right; }
    .aip-header-name { font-size: 19px; font-weight: 800; color: #FFFFFF; margin-bottom: 2px; letter-spacing: -0.2px; }
    .aip-header-status {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.92);
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .aip-status-dot {
      width: 9px; height: 9px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
    }

    .aip-close-btn {
      width: 40px; height: 40px;
      background: rgba(255, 255, 255, 0.22);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 14px;
      color: white;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      transition: all 0.2s ease;
      flex-shrink: 0;
      backdrop-filter: blur(8px);
    }

    .aip-close-btn:hover { background: rgba(255, 255, 255, 0.35); transform: scale(1.05); }

    /* MESSAGES AREA */
    #aip-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #F8FAFC;
    }

    .aip-msg-group {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .aip-msg-group-user {
      align-items: flex-end;
    }

    .aip-msg-group-bot {
      align-items: flex-start;
    }

    .aip-msg-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 12px;
    }

    .aip-msg-meta-user {
      flex-direction: row-reverse;
    }

    .aip-msg-meta-bot {
      flex-direction: row;
    }

    .aip-msg-avatar-icon {
      width: 24px; height: 24px;
      border-radius: 50%;
      background: #0F172A;
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .aip-msg-avatar-icon img { width: 100%; height: 100%; object-fit: cover; }

    .aip-msg-name-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 10px;
      border-radius: 12px;
      background: #EEF2FF;
      color: #4F46E5;
      border: 1px solid #C7D2FE;
    }

    .aip-msg-name-text {
      font-size: 12px;
      font-weight: 700;
      color: #1E293B;
    }

    .aip-msg-time-text {
      font-size: 11px;
      color: #94A3B8;
      font-weight: 500;
    }

    .aip-msg {
      display: flex;
      width: 100%;
      animation: aip-msg-in 0.3s ease;
    }

    @keyframes aip-msg-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .aip-msg-user { justify-content: flex-end; }
    .aip-msg-bot { justify-content: flex-start; }

    .aip-bubble {
      max-width: 88%;
      padding: 14px 18px;
      font-size: 14.5px;
      line-height: 1.65;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    .aip-bubble-bot {
      background: #0F172A !important;
      color: #FFFFFF !important;
      border-radius: 20px 20px 20px 4px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
    }

    .aip-bubble-user {
      background: linear-gradient(135deg, #4F46E5, #3B82F6) !important;
      color: #FFFFFF !important;
      border-radius: 20px 20px 4px 20px;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.25);
    }

    /* ACTION BUTTONS IN CHAT */
    .aip-btn-container {
      margin: 10px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .aip-wa-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      color: white !important;
      padding: 12px 20px;
      border-radius: 30px;
      text-decoration: none !important;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 6px 20px rgba(37, 211, 102, 0.35);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      width: 100%;
      text-align: center;
    }
    .aip-wa-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 25px rgba(37, 211, 102, 0.45); }

    .aip-form-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #3B82F6, #1D4ED8);
      color: white !important;
      padding: 12px 20px;
      border-radius: 30px;
      text-decoration: none !important;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      width: 100%;
      text-align: center;
    }
    .aip-form-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 25px rgba(59, 130, 246, 0.45); }

    .aip-quote-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #D97706, #B45309);
      color: white !important;
      padding: 12px 20px;
      border-radius: 30px;
      text-decoration: none !important;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 6px 20px rgba(217, 119, 6, 0.35);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      width: 100%;
      text-align: center;
    }
    .aip-quote-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 25px rgba(217, 119, 6, 0.45); }

    .aip-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #7C3AED, #06B6D4);
      color: white !important;
      padding: 12px 20px;
      border-radius: 30px;
      text-decoration: none !important;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 6px 20px rgba(124, 58, 237, 0.3);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      width: 100%;
      text-align: center;
    }
    .aip-action-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 25px rgba(124, 58, 237, 0.4); }

    #aip-input-container {
      background: #FFFFFF;
      border-top: 1px solid #E2E8F0;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      padding-top: 4px;
      padding-bottom: 8px;
    }

    #aip-input-area {
      background: #F1F5F9;
      border-radius: 22px;
      margin: 10px 16px 4px 16px;
      padding: 6px 8px 6px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid #CBD5E1;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    #aip-input-area:focus-within {
      border-color: #3B82F6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    #aip-input {
      flex: 1;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: #1E293B;
      padding: 8px 4px;
      font-size: 14px;
      font-weight: 500;
      font-family: 'Cairo', 'IBM Plex Sans', sans-serif;
      resize: none;
      min-height: 36px;
      max-height: 100px;
      outline: none;
      direction: ${isRTL() ? 'rtl' : 'ltr'};
      line-height: 1.5;
    }

    #aip-input::placeholder { color: #64748B; font-weight: 500; }

    #aip-emoji-btn {
      font-size: 20px;
      cursor: pointer;
      opacity: 0.8;
      transition: transform 0.2s, opacity 0.2s;
      user-select: none;
    }
    #aip-emoji-btn:hover { opacity: 1; transform: scale(1.1); }

    #aip-send {
      width: 44px; height: 44px;
      border-radius: 16px;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: white;
      background: linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%);
      box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      flex-shrink: 0;
      outline: none;
    }

    #aip-send:hover { transform: scale(1.06); box-shadow: 0 6px 18px rgba(6, 182, 212, 0.5); }
    #aip-send:active { transform: scale(0.94); }
    #aip-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    #aip-footer {
      padding: 6px 0 6px 0;
      text-align: center;
      font-size: 11px;
      color: #94A3B8;
      font-weight: 600;
      font-family: 'Cairo', 'IBM Plex Sans', sans-serif;
    }

    /* TYPING INDICATOR */
    #aip-typing {
      display: none;
      align-items: flex-start;
      gap: 8px;
      margin-top: 4px;
    }

    #aip-typing.show { display: flex; }

    .aip-typing-bubble {
      background: #0F172A;
      border-radius: 18px;
      border-bottom-left-radius: 4px;
      padding: 12px 18px;
      display: flex;
      gap: 5px;
      align-items: center;
    }

    .aip-typing-dot {
      width: 7px; height: 7px;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 50%;
      animation: aip-typing 1.2s infinite;
    }

    .aip-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .aip-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes aip-typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-6px); opacity: 1; }
    }

    /* MOBILE */
    @media (max-width: 480px) {
      #aip-window {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        width: 100%;
        height: 85vh;
        border-radius: 24px 24px 0 0;
        transform-origin: bottom center;
      }
    }
  `;

  // =================== HTML ===================
  function buildHTML() {
    const agentName = getText(config.agent_name, config.agent_name_ar);
    const inputPlaceholder = isRTL() ? 'اكتب رسالتك...' : 'Type a message...';

    return `
      <style>${styles}</style>
      <style>
        :root { 
          --aip-color: ${config.primary_color}; 
          --aip-color-rgb: ${hexToRgb(config.primary_color)};
          --aip-secondary: ${config.secondary_color || '#06B6D4'}; 
          --aip-secondary-rgb: ${hexToRgb(config.secondary_color || '#06B6D4')};
        }
      </style>

      <!-- TOGGLE BUTTON -->
      <button id="aip-toggle" aria-label="Open chat">
        <span class="aip-toggle-icon" id="aip-icon-open">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </span>
        <span class="aip-toggle-icon hidden" id="aip-icon-close">✕</span>
        <div id="aip-badge">1</div>
      </button>

      <!-- CHAT WINDOW -->
      <div id="aip-window" role="dialog" aria-label="Chat window">
        
        <!-- HEADER -->
        <div id="aip-header">
          <div class="aip-avatar">
            ${config.avatar_url ? `<img src="${config.avatar_url}" alt="${agentName}">` : '🤖'}
          </div>
          <div class="aip-header-info">
            <div class="aip-header-name">${agentName}</div>
            <div class="aip-header-status">
              <div class="aip-status-dot"></div>
              <span>${isRTL() ? 'متاح الآن' : 'Online now'}</span>
            </div>
          </div>
          <button class="aip-close-btn" onclick="window._aipWidget.toggle()" aria-label="Close">✕</button>
        </div>

        <!-- MESSAGES -->
        <div id="aip-messages">
          <!-- TYPING INDICATOR -->
          <div id="aip-typing">
            <div class="aip-msg-avatar-icon">🤖</div>
            <div class="aip-typing-bubble">
              <div class="aip-typing-dot"></div>
              <div class="aip-typing-dot"></div>
              <div class="aip-typing-dot"></div>
            </div>
          </div>
        </div>

        <!-- INPUT CONTAINER (ALWAYS VISIBLE) -->
        <div id="aip-input-container">
          <div id="aip-input-area">
            <span id="aip-emoji-btn">😊</span>
            <textarea id="aip-input" placeholder="${inputPlaceholder}" rows="1" maxlength="2000"></textarea>
            <button id="aip-send" aria-label="Send">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: scaleX(-1) rotate(-45deg);">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <div id="aip-footer">Powered by Raqminha AIAgent</div>
        </div>
      </div>
    `;
  }

  // =================== RICH MARKDOWN & WHATSAPP FORMATTER ===================
  function formatMessageHtml(text) {
    if (!text) return '';
    
    // Detect language of the message to set button text language
    const isArabicMsg = /[\u0600-\u06FF]/.test(text);

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold text: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:inherit;font-weight:700;">$1</strong>');

    // Placeholders for links to prevent double parsing
    const placeholders = [];
    
    // 1. First, parse Markdown Links: [Title](URL)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, (match, title, url) => {
      const cleanTitle = title.replace(/^[💬📋📄🔗🚀]\s*/, '');
      const lowerUrl = url.toLowerCase();
      let btnHtml = '';
      if (lowerUrl.includes('wa.me') || lowerUrl.includes('whatsapp.com')) {
        btnHtml = `<div class="aip-btn-container"><a href="${url}" target="_blank" rel="noopener" class="aip-wa-btn">💬 ${cleanTitle}</a></div>`;
      } else if (lowerUrl.includes('form') || lowerUrl.includes('booking') || lowerUrl.includes('book') || lowerUrl.includes('appoint') || lowerUrl.includes('survey') || lowerUrl.includes('docs.google.com/forms')) {
        btnHtml = `<div class="aip-btn-container"><a href="${url}" target="_blank" rel="noopener" class="aip-form-btn">📋 ${cleanTitle}</a></div>`;
      } else if (lowerUrl.includes('quote') || lowerUrl.includes('pricing') || lowerUrl.includes('price') || lowerUrl.includes('offer') || lowerUrl.includes('quotation')) {
        btnHtml = `<div class="aip-btn-container"><a href="${url}" target="_blank" rel="noopener" class="aip-quote-btn">📄 ${cleanTitle}</a></div>`;
      } else {
        btnHtml = `<div class="aip-btn-container"><a href="${url}" target="_blank" rel="noopener" class="aip-action-btn">🔗 ${cleanTitle}</a></div>`;
      }
      const ph = `___LINK_PH_${placeholders.length}___`;
      placeholders.push({ placeholder: ph, content: btnHtml });
      return ph;
    });

    // 2. Next, parse raw URLs (not inside placeholders or markdown)
    // Regex matching http/https URLs
    html = html.replace(/(https?:\/\/[^\s<"'\)]+)/g, (url) => {
      const cleanUrl = url.replace(/[\.,\?!]+$/, '');
      const lowerUrl = cleanUrl.toLowerCase();
      let btnHtml = '';
      if (lowerUrl.includes('wa.me') || lowerUrl.includes('whatsapp.com')) {
        const title = isArabicMsg ? 'تواصل عبر الواتساب' : 'Chat on Whatsapp';
        btnHtml = `<div class="aip-btn-container"><a href="${cleanUrl}" target="_blank" rel="noopener" class="aip-wa-btn">💬 ${title}</a></div>`;
      } else if (lowerUrl.includes('form') || lowerUrl.includes('booking') || lowerUrl.includes('book') || lowerUrl.includes('appoint') || lowerUrl.includes('survey') || lowerUrl.includes('docs.google.com/forms')) {
        const title = isArabicMsg ? 'تعبئة النموذج / الاستمارة' : 'Fill out the Form';
        btnHtml = `<div class="aip-btn-container"><a href="${cleanUrl}" target="_blank" rel="noopener" class="aip-form-btn">📋 ${title}</a></div>`;
      } else if (lowerUrl.includes('quote') || lowerUrl.includes('pricing') || lowerUrl.includes('price') || lowerUrl.includes('offer') || lowerUrl.includes('quotation')) {
        const title = isArabicMsg ? 'طلب عرض سعر' : 'Get a Quote';
        btnHtml = `<div class="aip-btn-container"><a href="${cleanUrl}" target="_blank" rel="noopener" class="aip-quote-btn">📄 ${title}</a></div>`;
      } else {
        const title = isArabicMsg ? 'انتقال إلى الرابط' : 'Visit Link';
        btnHtml = `<div class="aip-btn-container"><a href="${cleanUrl}" target="_blank" rel="noopener" class="aip-action-btn">🔗 ${title}</a></div>`;
      }
      const ph = `___LINK_PH_${placeholders.length}___`;
      placeholders.push({ placeholder: ph, content: btnHtml });
      return ph;
    });

    // 3. Restore all placeholders
    for (const ph of placeholders) {
      html = html.replace(ph.placeholder, ph.content);
    }

    // Bullet points
    html = html.replace(/^\s*[\-\*•]\s+(.*)$/gm, '• $1');

    // Line breaks
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // =================== CORE FUNCTIONS ===================
  function addMessage(content, role = 'user') {
    const messagesEl = document.getElementById('aip-messages');
    const typing = document.getElementById('aip-typing');
    const welcome = document.getElementById('aip-welcome');

    const msgGroup = document.createElement('div');
    msgGroup.className = 'aip-msg-group';

    const time = new Date().toLocaleTimeString(isRTL() ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' });
    const agentName = getText(config.agent_name, config.agent_name_ar);

    let metaHtml = '';
    if (role === 'user') {
      metaHtml = `
        <div class="aip-msg-meta aip-msg-meta-user">
          <div class="aip-msg-avatar-icon" style="background:#4F46E5;color:#FFFFFF;">👤</div>
          <span class="aip-msg-name-badge">${isRTL() ? 'أنت' : 'You'}</span>
          <span class="aip-msg-time-text">${time} ${isRTL() ? 'من' : 'from'}</span>
        </div>
      `;
    } else {
      const avatarContent = config.avatar_url 
        ? `<img src="${config.avatar_url}" alt="${agentName}">` 
        : `🤖`;
      metaHtml = `
        <div class="aip-msg-meta aip-msg-meta-bot">
          <div class="aip-msg-avatar-icon">${avatarContent}</div>
          <span class="aip-msg-time-text">${time} ${isRTL() ? 'من' : 'from'}</span>
          <span class="aip-msg-name-text">${agentName}</span>
        </div>
      `;
    }

    msgGroup.innerHTML = `
      ${metaHtml}
      <div class="aip-msg ${role === 'user' ? 'aip-msg-user' : 'aip-msg-bot'}">
        <div class="aip-bubble ${role === 'user' ? 'aip-bubble-user' : 'aip-bubble-bot'}">
          ${role === 'user' ? escHtml(content) : formatMessageHtml(content)}
        </div>
      </div>
    `;

    messagesEl.insertBefore(msgGroup, typing);
    scrollToBottom();

    state.messages.push({ role, content, time });
  }

  function showTyping(show) {
    state.isTyping = show;
    const el = document.getElementById('aip-typing');
    el.classList.toggle('show', show);
    if (show) scrollToBottom();
  }

  function scrollToBottom() {
    const el = document.getElementById('aip-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  async function sendMessage(text) {
    if (!text.trim() || state.isTyping) return;

    const input = document.getElementById('aip-input');
    const sendBtn = document.getElementById('aip-send');

    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    addMessage(text, 'user');
    showTyping(true);

    try {
      const res = await fetch(`${SERVER_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: BUSINESS_ID,
          conversationId: state.conversationId,
          message: text
        })
      });

      if (!res.ok) throw new Error('Network error');

      const data = await res.json();
      state.conversationId = data.conversationId;
      if (data.conversationId) {
        try { localStorage.setItem(`aip_conv_${BUSINESS_ID}`, data.conversationId); } catch(e) {}
      }

      // Simulate natural typing delay
      const delay = Math.min(data.typing_delay || 800, 2000);
      await new Promise(r => setTimeout(r, delay));

      showTyping(false);
      addMessage(data.message, 'assistant');

    } catch (err) {
      showTyping(false);
      addMessage(
        isRTL() ? 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.' : 'Sorry, something went wrong. Please try again.',
        'assistant'
      );
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function startChat() {
    const welcome = document.getElementById('aip-welcome');
    const inputArea = document.getElementById('aip-input-area');
    if (welcome) welcome.style.display = 'none';
    if (inputArea) inputArea.style.display = 'flex';

    // Add welcome message
    setTimeout(() => {
      showTyping(true);
      setTimeout(() => {
        showTyping(false);
        addMessage(getText(config.welcome_message, config.welcome_message_ar), 'assistant');
      }, 1200);
    }, 400);
  }

  function toggle() {
    state.isOpen = !state.isOpen;
    const window_ = document.getElementById('aip-window');
    const iconOpen = document.getElementById('aip-icon-open');
    const iconClose = document.getElementById('aip-icon-close');

    window_?.classList.toggle('open', state.isOpen);
    if (iconOpen) iconOpen.classList.toggle('hidden', state.isOpen);
    if (iconClose) iconClose.classList.toggle('hidden', !state.isOpen);

    if (state.isOpen) {
      state.unreadCount = 0;
      const badge = document.getElementById('aip-badge');
      if (badge) badge.style.display = 'none';
      setTimeout(() => document.getElementById('aip-input')?.focus(), 300);
    }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function toggleTheme() {
    const win = document.getElementById('aip-window');
    const toggleBtn = document.getElementById('aip-theme-toggle');
    if (!win) return;
    const isDark = win.classList.toggle('aip-dark');
    if (toggleBtn) toggleBtn.innerHTML = isDark ? '🌙' : '☀️';
    localStorage.setItem('aip_theme', isDark ? 'dark' : 'light');
  }

  // =================== INIT ===================
  async function init() {
    // Fetch business config
    try {
      const res = await fetch(`${SERVER_URL}/api/chat/config/${BUSINESS_ID}`);
      if (res.ok) {
        const data = await res.json();
        Object.assign(config, data);
      }
    } catch (e) { console.warn('[AI Agent Widget] Could not load config, using defaults'); }

    // Create widget container
    const container = document.createElement('div');
    container.id = 'aip-widget';
    container.innerHTML = buildHTML();
    document.body.appendChild(container);

    // Load saved theme
    const savedTheme = localStorage.getItem('aip_theme');
    if (savedTheme === 'dark') {
      document.getElementById('aip-window')?.classList.add('aip-dark');
      const toggleBtn = document.getElementById('aip-theme-toggle');
      if (toggleBtn) toggleBtn.innerHTML = '🌙';
    }

    // Auto-restore saved conversation session & history
    try {
      const savedConvId = localStorage.getItem(`aip_conv_${BUSINESS_ID}`);
      if (savedConvId) {
        state.conversationId = savedConvId;
        fetch(`${SERVER_URL}/api/chat/history/${savedConvId}`)
          .then(r => r.json())
          .then(d => {
            if (d && d.messages && d.messages.length > 0) {
              const welcome = document.getElementById('aip-welcome');
              const inputArea = document.getElementById('aip-input-area');
              if (welcome) welcome.style.display = 'none';
              if (inputArea) inputArea.style.display = 'flex';
              d.messages.forEach(m => {
                addMessage(m.content, m.role === 'assistant' ? 'assistant' : 'user');
              });
            }
          })
          .catch(() => {});
      }
    } catch (e) {}

    // Event: Toggle
    document.getElementById('aip-toggle')?.addEventListener('click', toggle);

    // Event: Send on button click
    document.getElementById('aip-send')?.addEventListener('click', () => {
      const input = document.getElementById('aip-input');
      sendMessage(input?.value || '');
    });

    // Event: Send on Enter (Shift+Enter for newline)
    document.getElementById('aip-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const input = document.getElementById('aip-input');
        sendMessage(input?.value || '');
      }
    });

    // Auto-resize textarea
    document.getElementById('aip-input')?.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // Expose API
    window._aipWidget = { toggle, toggleTheme, startChat, sendMessage };
  }

  // Load when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
