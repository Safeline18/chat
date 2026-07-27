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
    name: 'AI Assistant',
    name_ar: 'المساعد الذكي',
    agent_name: 'Aria',
    agent_name_ar: 'آريا',
    welcome_message: 'Hello! How can I help you today? 😊',
    welcome_message_ar: 'أهلاً! كيف يمكنني مساعدتك اليوم؟ 😊',
    primary_color: '#1A1F36',
    secondary_color: '#C5A059',
    avatar_url: null,
  };

  let state = {
    isOpen: false,
    conversationId: null,
    messages: [],
    isTyping: false,
    language: 'auto',
    unreadCount: 0,
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
    if (!hex) return '26, 31, 54';
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '26, 31, 54';
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

    /* TOGGLE BUTTON */
    #aip-toggle {
      width: 62px; height: 62px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 12px 36px rgba(var(--aip-color-rgb, 26, 31, 54), 0.35), 0 0 0 0 rgba(var(--aip-secondary-rgb, 197, 160, 89), 0.4);
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      animation: aip-pulse 3s infinite;
      outline: none;
    }

    #aip-toggle:hover { transform: scale(1.08) rotate(4deg); box-shadow: 0 16px 45px rgba(var(--aip-color-rgb, 26, 31, 54), 0.45); }
    #aip-toggle:active { transform: scale(0.94); }

    @keyframes aip-pulse {
      0%, 100% { box-shadow: 0 12px 36px rgba(var(--aip-color-rgb, 26, 31, 54), 0.35), 0 0 0 0 rgba(var(--aip-secondary-rgb, 197, 160, 89), 0.4); }
      50% { box-shadow: 0 12px 36px rgba(var(--aip-color-rgb, 26, 31, 54), 0.35), 0 0 0 12px rgba(var(--aip-secondary-rgb, 197, 160, 89), 0); }
    }

    .aip-toggle-icon { font-size: 28px; transition: all 0.3s ease; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15)); }
    .aip-toggle-icon.hidden { display: none; }

    /* UNREAD BADGE */
    #aip-badge {
      position: absolute;
      top: -2px; right: -2px;
      background: linear-gradient(135deg, #EF4444, #DC2626);
      color: white;
      font-size: 11px;
      font-weight: 800;
      width: 22px; height: 22px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid white;
      display: none;
      box-shadow: 0 4px 10px rgba(239, 68, 68, 0.4);
    }

    /* CHAT WINDOW (DEFAULT LIGHT LUXURY MODE) */
    #aip-window {
      position: absolute;
      ${WIDGET_POSITION.includes('right') ? 'right: 0;' : 'left: 0;'}
      bottom: 78px;
      width: 390px;
      height: 600px;
      background: #FFFFFF;
      color: #1A1F36;
      border-radius: 24px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 60px -12px rgba(26, 31, 54, 0.15), 0 0 0 1px rgba(26, 31, 54, 0.04);
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
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
      background: linear-gradient(135deg, var(--aip-color, #1A1F36) 0%, var(--aip-secondary, #C5A059) 100%);
      box-shadow: 0 4px 20px rgba(var(--aip-color-rgb, 26, 31, 54), 0.2);
    }

    .aip-header-glow {
      position: absolute;
      inset: 0;
      opacity: 0.15;
      background: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.4), transparent);
    }

    .aip-avatar {
      width: 46px; height: 46px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      background: rgba(255,255,255,0.15);
      border: 2px solid rgba(255,255,255,0.25);
      flex-shrink: 0;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .aip-avatar img { width: 100%; height: 100%; object-fit: cover; }

    .aip-header-info { flex: 1; min-width: 0; }
    .aip-header-name { font-size: 16px; font-weight: 800; color: white; margin-bottom: 2px; letter-spacing: -0.2px; }
    .aip-header-status {
      font-size: 12px;
      color: rgba(255,255,255,0.85);
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }

    .aip-status-dot {
      width: 8px; height: 8px;
      background: #10B981;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.3);
      animation: aip-pulse-green 2s infinite;
    }

    @keyframes aip-pulse-green {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.9); }
    }

    .aip-close-btn {
      width: 34px; height: 34px;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      color: white;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px;
      transition: all 0.2s;
      flex-shrink: 0;
      backdrop-filter: blur(4px);
    }

    .aip-close-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.08); }

    /* MESSAGES (LIGHT DEFAULT) */
    #aip-messages {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #F0F4FA;
    }

    .aip-msg-avatar-sm {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: rgba(var(--aip-color-rgb, 26, 31, 54), 0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid rgba(var(--aip-color-rgb, 26, 31, 54), 0.15);
    }

    .aip-bubble {
      max-width: 100%;
      padding: 13px 17px;
      border-radius: 18px;
      font-size: 14.5px;
      line-height: 1.65;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    .aip-bubble-bot {
      background: #FFFFFF;
      color: #1A1F36;
      border: 1px solid #E2E8F0;
      box-shadow: 0 4px 14px rgba(0,0,0,0.02);
      border-bottom-left-radius: 4px;
    }

    .aip-bubble-user {
      background: var(--aip-color, #1A1F36);
      color: white;
      box-shadow: 0 4px 15px rgba(var(--aip-color-rgb, 26, 31, 54), 0.25);
      border-bottom-right-radius: 4px;
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
      background: linear-gradient(135deg, #C5A059, #A9843F);
      color: white !important;
      padding: 12px 20px;
      border-radius: 30px;
      text-decoration: none !important;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 6px 20px rgba(197, 160, 89, 0.35);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      width: 100%;
      text-align: center;
    }
    .aip-quote-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 25px rgba(197, 160, 89, 0.45); }

    .aip-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, var(--aip-color, #1A1F36), #2D3556);
      color: white !important;
      padding: 12px 20px;
      border-radius: 30px;
      text-decoration: none !important;
      font-weight: 700;
      font-size: 14px;
      box-shadow: 0 6px 20px rgba(26, 31, 54, 0.3);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      width: 100%;
      text-align: center;
    }
    .aip-action-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 25px rgba(26, 31, 54, 0.4); }

    .aip-link {
      color: var(--aip-secondary, #C5A059) !important;
      text-decoration: underline;
      font-weight: 600;
    }

    #aip-input-area {
      padding: 14px 16px;
      background: #FFFFFF;
      border-top: 1px solid #F1F5F9;
      display: flex;
      align-items: flex-end;
      gap: 10px;
      flex-shrink: 0;
    }

    #aip-input {
      flex: 1;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      color: #1A1F36;
      padding: 12px 16px;
      font-size: 14px;
      font-family: 'Cairo', 'IBM Plex Sans', sans-serif;
      resize: none;
      min-height: 44px;
      max-height: 110px;
      outline: none;
      transition: all 0.2s ease;
      direction: ${isRTL() ? 'rtl' : 'ltr'};
      line-height: 1.5;
    }

    #aip-input:focus { border-color: var(--aip-color, #1A1F36); box-shadow: 0 0 0 3px rgba(var(--aip-color-rgb, 26, 31, 54), 0.12); background: #FFFFFF; }
    #aip-input::placeholder { color: #94A3B8; }

    #aip-send {
      width: 44px; height: 44px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      color: white;
      background: linear-gradient(135deg, var(--aip-color, #1A1F36), var(--aip-secondary, #C5A059));
      box-shadow: 0 4px 14px rgba(var(--aip-color-rgb, 26, 31, 54), 0.35);
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      flex-shrink: 0;
    }

    #aip-send:hover { transform: scale(1.1) rotate(-5deg); box-shadow: 0 6px 18px rgba(var(--aip-color-rgb, 26, 31, 54), 0.5); }
    #aip-send:active { transform: scale(0.95); }
    #aip-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    #aip-welcome {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      background: #FFFFFF;
      text-align: center;
      z-index: 10;
    }

    .aip-welcome-avatar {
      width: 80px; height: 80px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 36px;
      margin-bottom: 20px;
      position: relative;
      box-shadow: 0 10px 25px rgba(var(--aip-color-rgb, 26, 31, 54), 0.2);
    }

    .aip-welcome-name { font-size: 22px; font-weight: 800; color: #1A1F36; margin-bottom: 10px; letter-spacing: -0.3px; }
    .aip-welcome-msg { font-size: 14.5px; color: #64748B; line-height: 1.65; margin-bottom: 26px; }

    .aip-start-btn {
      padding: 13px 32px;
      border-radius: 50px;
      border: none;
      color: white;
      font-size: 14.5px;
      font-weight: 700;
      font-family: 'Cairo', 'IBM Plex Sans', sans-serif;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 6px 22px rgba(var(--aip-color-rgb, 26, 31, 54), 0.4);
      background: linear-gradient(135deg, var(--aip-color, #1A1F36), var(--aip-secondary, #C5A059));
    }

    .aip-start-btn:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 10px 28px rgba(var(--aip-color-rgb, 26, 31, 54), 0.55); }

    #aip-footer {
      padding: 11px;
      text-align: center;
      font-size: 11.5px;
      color: #64748B;
      background: #FFFFFF;
      border-top: 1px solid #F1F5F9;
      flex-shrink: 0;
      font-weight: 600;
    }

    /* DARK MODE STYLES (.aip-dark) */
    #aip-window.aip-dark {
      background: #111321;
      color: #F8FAFC;
      box-shadow: 0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08);
    }
    #aip-window.aip-dark #aip-messages { background: #111321; }
    #aip-window.aip-dark #aip-welcome { background: #111321; }
    #aip-window.aip-dark .aip-welcome-name { color: #FFFFFF !important; }
    #aip-window.aip-dark .aip-welcome-msg { color: #94A3B8 !important; }
    #aip-window.aip-dark .aip-bubble-bot {
      background: #1A1F36;
      color: #F1F5F9;
      border: 1px solid rgba(197, 160, 89, 0.3);
    }
    #aip-window.aip-dark .aip-bubble-user {
      background: var(--aip-secondary, #C5A059);
      color: #1A1F36;
    }
    #aip-window.aip-dark #aip-input-area { background: #1A1F36; border-top: 1px solid rgba(255,255,255,0.06); }
    #aip-window.aip-dark #aip-input { background: rgba(255,255,255,0.06); color: #F8FAFC; border: 1px solid rgba(255,255,255,0.1); }
    #aip-window.aip-dark #aip-footer { background: #1A1F36; color: #94A3B8; border-top: 1px solid rgba(255,255,255,0.06); }

    #aip-messages::-webkit-scrollbar { width: 4px; }
    #aip-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

    /* DATE DIVIDER */
    .aip-date-divider {
      text-align: center;
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin: 8px 0;
      position: relative;
    }

    .aip-date-divider::before, .aip-date-divider::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 30%;
      height: 1px;
      background: rgba(255,255,255,0.1);
    }

    .aip-date-divider::before { right: 0; }
    .aip-date-divider::after { left: 0; }

    /* MESSAGE BUBBLE */
    .aip-msg {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      animation: aip-msg-in 0.3s ease;
    }

    @keyframes aip-msg-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .aip-msg-user { flex-direction: row-reverse; }

    .aip-msg-avatar-sm {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .aip-bubble-rtl { border-bottom-right-radius: 18px !important; border-bottom-left-radius: 4px !important; }
    .aip-bubble-user-rtl { border-bottom-left-radius: 4px !important; border-bottom-right-radius: 18px !important; }

    .aip-msg-time {
      font-size: 10px;
      color: rgba(0, 0, 0, 0.3);
      margin-top: 4px;
      padding: 0 2px;
      text-align: center;
    }
    #aip-window.aip-dark .aip-msg-time {
      color: rgba(255,255,255,0.3);
    }

    /* TYPING INDICATOR */
    #aip-typing {
      display: none;
      align-items: flex-end;
      gap: 8px;
    }

    #aip-typing.show { display: flex; }

    .aip-typing-bubble {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 18px;
      border-bottom-left-radius: 4px;
      padding: 12px 16px;
      display: flex;
      gap: 4px;
      align-items: center;
    }
    #aip-window.aip-dark .aip-typing-bubble {
      background: #1A1F36;
      border: 1px solid rgba(197, 160, 89, 0.3);
    }

    .aip-typing-dot {
      width: 7px; height: 7px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 50%;
      animation: aip-typing 1.2s infinite;
    }
    #aip-window.aip-dark .aip-typing-dot {
      background: rgba(255,255,255,0.4);
    }

    .aip-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .aip-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes aip-typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-6px); opacity: 1; }
    }

    /* WELCOME SCREEN */
    .aip-welcome-avatar::after {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      border: 2px solid;
      opacity: 0.3;
      animation: aip-ring 2s infinite;
    }

    @keyframes aip-ring {
      0% { transform: scale(1); opacity: 0.3; }
      50% { transform: scale(1.08); opacity: 0.1; }
      100% { transform: scale(1); opacity: 0.3; }
    }

    #aip-footer a { color: rgba(255,255,255,0.3); text-decoration: none; }

    /* MOBILE */
    @media (max-width: 480px) {
      #aip-window {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        width: 100%;
        height: 85vh;
        border-radius: 20px 20px 0 0;
        transform-origin: bottom center;
      }
    }
  `;

  // =================== HTML ===================
  function buildHTML() {
    const agentName = getText(config.agent_name, config.agent_name_ar);
    const welcomeMsg = getText(config.welcome_message, config.welcome_message_ar);
    const inputPlaceholder = isRTL() ? 'اكتب رسالتك...' : 'Type a message...';

    return `
      <style>${styles}</style>
      <style>
        :root { 
          --aip-color: ${config.primary_color}; 
          --aip-color-rgb: ${hexToRgb(config.primary_color)};
          --aip-secondary: ${config.secondary_color || '#C5A059'}; 
          --aip-secondary-rgb: ${hexToRgb(config.secondary_color || '#C5A059')};
        }
      </style>

      <!-- TOGGLE BUTTON -->
      <button id="aip-toggle" style="background: linear-gradient(135deg, var(--aip-color), var(--aip-secondary));" aria-label="Open chat">
        <span class="aip-toggle-icon" id="aip-icon-open">💬</span>
        <span class="aip-toggle-icon hidden" id="aip-icon-close">✕</span>
        <div id="aip-badge"></div>
      </button>

      <!-- CHAT WINDOW -->
      <div id="aip-window" role="dialog" aria-label="Chat window">
        
        <!-- HEADER -->
        <div id="aip-header">
          <div class="aip-header-glow"></div>
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
          <button id="aip-theme-toggle" class="aip-close-btn" style="margin-left: 4px; font-size: 15px;" onclick="window._aipWidget.toggleTheme()" title="تغيير الثيم (فاتح / داكن)">☀️</button>
          <button class="aip-close-btn" onclick="window._aipWidget.toggle()" aria-label="Close">✕</button>
        </div>

        <!-- MESSAGES -->
        <div id="aip-messages">
          <!-- WELCOME SCREEN -->
          <div id="aip-welcome">
            <div class="aip-welcome-avatar" style="background: rgba(var(--aip-color-rgb), 0.1); border: 2px solid rgba(var(--aip-color-rgb), 0.15);">
              ${config.avatar_url ? `<img src="${config.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '🤖'}
            </div>
            <div class="aip-welcome-name">${agentName}</div>
            <div class="aip-welcome-msg">${welcomeMsg}</div>
            <button class="aip-start-btn" onclick="window._aipWidget.startChat()">
              ${isRTL() ? '🚀 ابدأ المحادثة' : '🚀 Start Chat'}
            </button>
          </div>

          <!-- TYPING INDICATOR -->
          <div id="aip-typing">
            <div class="aip-msg-avatar-sm">🤖</div>
            <div class="aip-typing-bubble">
              <div class="aip-typing-dot"></div>
              <div class="aip-typing-dot"></div>
              <div class="aip-typing-dot"></div>
            </div>
          </div>
        </div>

        <!-- INPUT AREA -->
        <div id="aip-input-area" style="display:none;">
          <textarea id="aip-input" placeholder="${inputPlaceholder}" rows="1" maxlength="2000"></textarea>
          <button id="aip-send" aria-label="Send">
            ${isRTL() ? '←' : '→'}
          </button>
        </div>

        <!-- FOOTER -->
        <div id="aip-footer">Powered by <strong>رقمنها Raqminha AI Agent</strong></div>
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

    const msg = document.createElement('div');
    msg.className = `aip-msg ${role === 'user' ? 'aip-msg-user' : ''}`;

    const time = new Date().toLocaleTimeString(isRTL() ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' });

    const avatarHtml = config.avatar_url ? `<img src="${config.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '🤖';

    msg.innerHTML = `
      ${role !== 'user' ? `<div class="aip-msg-avatar-sm" style="background:${config.primary_color}33;color:${config.primary_color};">${avatarHtml}</div>` : ''}
      <div style="display:flex;flex-direction:column;align-items:${role === 'user' ? 'flex-end' : 'flex-start'};max-width:85%;">
        <div class="aip-bubble ${role === 'user' ? 'aip-bubble-user' : 'aip-bubble-bot'}" ${role === 'user' ? `style="background:linear-gradient(135deg, ${config.primary_color}, ${config.secondary_color || '#4ECDC4'});"` : ''}>
          ${role === 'user' ? escHtml(content) : formatMessageHtml(content)}
        </div>
        <div class="aip-msg-time">${time}</div>
      </div>
      ${role === 'user' ? `<div class="aip-msg-avatar-sm" style="background:rgba(255,255,255,0.08);">👤</div>` : ''}
    `;

    messagesEl.insertBefore(msg, typing);
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
