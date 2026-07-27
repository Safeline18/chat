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
    primary_color: '#6C63FF',
    secondary_color: '#4ECDC4',
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

  // =================== STYLES ===================
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');

    #aip-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', 'Inter', sans-serif; }

    #aip-widget {
      position: fixed;
      ${WIDGET_POSITION.includes('right') ? 'right: 24px;' : 'left: 24px;'}
      bottom: 24px;
      z-index: 2147483647;
      direction: ${isRTL() ? 'rtl' : 'ltr'};
    }

    /* TOGGLE BUTTON */
    #aip-toggle {
      width: 60px; height: 60px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 0 rgba(108,99,255,0.4);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      animation: aip-pulse 3s infinite;
      outline: none;
    }

    #aip-toggle:hover { transform: scale(1.1); box-shadow: 0 12px 40px rgba(0,0,0,0.35); }
    #aip-toggle:active { transform: scale(0.95); }

    @keyframes aip-pulse {
      0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 0 rgba(108,99,255,0.4); }
      50% { box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 10px rgba(108,99,255,0); }
    }

    .aip-toggle-icon { font-size: 26px; transition: all 0.3s ease; }
    .aip-toggle-icon.hidden { display: none; }

    /* UNREAD BADGE */
    #aip-badge {
      position: absolute;
      top: -4px; right: -4px;
      background: #FF4444;
      color: white;
      font-size: 11px;
      font-weight: 700;
      width: 20px; height: 20px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid white;
      display: none;
      animation: aip-badge-in 0.3s ease;
    }

    @keyframes aip-badge-in { from { transform: scale(0); } to { transform: scale(1); } }

    /* CHAT WINDOW (DEFAULT LIGHT MODE) */
    #aip-window {
      position: absolute;
      ${WIDGET_POSITION.includes('right') ? 'right: 0;' : 'left: 0;'}
      bottom: 76px;
      width: 380px;
      height: 580px;
      background: #ffffff;
      color: #1e1e2d;
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06);
      transform: scale(0.9) translateY(20px);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform-origin: bottom right;
    }

    #aip-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* MESSAGES (LIGHT DEFAULT) */
    #aip-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8f9fc;
    }

    .aip-bubble-bot {
      background: #ffffff;
      color: #2b2b36;
      border: 1px solid #e2e4ed;
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
      border-bottom-left-radius: 4px;
    }

    #aip-input-area {
      padding: 12px 14px;
      background: #ffffff;
      border-top: 1px solid #eef0f6;
      display: flex;
      align-items: flex-end;
      gap: 10px;
      flex-shrink: 0;
    }

    #aip-input {
      flex: 1;
      background: #f4f5f9;
      border: 1px solid #dce0ed;
      border-radius: 14px;
      color: #1e1e2d;
      padding: 10px 14px;
      font-size: 13.5px;
      font-family: 'Cairo', 'Inter', sans-serif;
      resize: none;
      min-height: 42px;
      max-height: 100px;
      outline: none;
      transition: border-color 0.2s;
      direction: ${isRTL() ? 'rtl' : 'ltr'};
      line-height: 1.5;
    }

    #aip-input::placeholder { color: #8c93a6; }

    #aip-welcome {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      background: #ffffff;
      text-align: center;
      z-index: 10;
    }

    .aip-welcome-name { font-size: 20px; font-weight: 800; color: #1e1e2d; margin-bottom: 10px; }
    .aip-welcome-msg { font-size: 14px; color: #555566; line-height: 1.6; margin-bottom: 24px; }

    #aip-footer {
      padding: 10px;
      text-align: center;
      font-size: 11px;
      color: #777788;
      background: #ffffff;
      border-top: 1px solid #eef0f6;
      flex-shrink: 0;
    }

    /* DARK MODE STYLES (.aip-dark) */
    #aip-window.aip-dark {
      background: #0f0f17;
      color: #f0f0f8;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08);
    }
    #aip-window.aip-dark #aip-messages { background: #0f0f17; }
    #aip-window.aip-dark #aip-welcome { background: #0f0f17; }
    #aip-window.aip-dark .aip-welcome-name { color: #ffffff !important; }
    #aip-window.aip-dark .aip-welcome-msg { color: rgba(255,255,255,0.6) !important; }
    #aip-window.aip-dark .aip-bubble-bot {
      background: rgba(255,255,255,0.07);
      color: #e8e8f0;
      border: 1px solid rgba(255,255,255,0.08);
    }
    #aip-window.aip-dark #aip-input-area { background: #13131c; border-top: 1px solid rgba(255,255,255,0.06); }
    #aip-window.aip-dark #aip-input { background: rgba(255,255,255,0.06); color: #e8e8f0; border: 1px solid rgba(255,255,255,0.1); }
    #aip-window.aip-dark #aip-footer { background: #13131c; color: rgba(255,255,255,0.4); border-top: 1px solid rgba(255,255,255,0.04); }

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

    .aip-bubble {
      max-width: 100%;
      padding: 12px 16px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.65;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    .aip-wa-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #25D366, #128C7E);
      color: white !important;
      padding: 10px 18px;
      border-radius: 25px;
      text-decoration: none !important;
      font-weight: 700;
      font-size: 13.5px;
      margin: 8px 0 4px 0;
      box-shadow: 0 4px 15px rgba(37,211,102,0.4);
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .aip-wa-btn:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(37,211,102,0.6); }

    .aip-link {
      color: #64B5F6 !important;
      text-decoration: underline;
      font-weight: 600;
    }

    .aip-bubble-user {
      color: white;
      border-bottom-right-radius: 4px;
    }

    .aip-bubble-bot {
      background: rgba(255,255,255,0.07);
      color: #e8e8f0;
      border: 1px solid rgba(255,255,255,0.08);
      border-bottom-left-radius: 4px;
    }

    .aip-bubble-rtl { border-bottom-right-radius: 18px !important; border-bottom-left-radius: 4px !important; }
    .aip-bubble-user-rtl { border-bottom-left-radius: 4px !important; border-bottom-right-radius: 18px !important; }

    .aip-msg-time {
      font-size: 10px;
      color: rgba(255,255,255,0.3);
      margin-top: 4px;
      padding: 0 2px;
      text-align: center;
    }

    /* TYPING INDICATOR */
    #aip-typing {
      display: none;
      align-items: flex-end;
      gap: 8px;
    }

    #aip-typing.show { display: flex; }

    .aip-typing-bubble {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px;
      border-bottom-left-radius: 4px;
      padding: 12px 16px;
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .aip-typing-dot {
      width: 7px; height: 7px;
      background: rgba(255,255,255,0.4);
      border-radius: 50%;
      animation: aip-typing 1.2s infinite;
    }

    .aip-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .aip-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes aip-typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-6px); opacity: 1; }
    }

    /* INPUT AREA */
    #aip-input-area {
      padding: 12px 14px;
      background: #13131c;
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: flex-end;
      gap: 10px;
      flex-shrink: 0;
    }

    #aip-input {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      color: #e8e8f0;
      padding: 10px 14px;
      font-size: 13.5px;
      font-family: 'Cairo', 'Inter', sans-serif;
      resize: none;
      min-height: 42px;
      max-height: 100px;
      outline: none;
      transition: border-color 0.2s;
      direction: ${isRTL() ? 'rtl' : 'ltr'};
      line-height: 1.5;
    }

    #aip-input:focus { border-color: var(--aip-color, #6C63FF); }
    #aip-input::placeholder { color: rgba(255,255,255,0.25); }

    #aip-send {
      width: 42px; height: 42px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      color: white;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      flex-shrink: 0;
    }

    #aip-send:hover { transform: scale(1.1); }
    #aip-send:active { transform: scale(0.95); }
    #aip-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    /* WELCOME SCREEN */
    #aip-welcome {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
      background: #0f0f17;
      text-align: center;
      z-index: 10;
    }

    .aip-welcome-avatar {
      width: 72px; height: 72px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
      margin-bottom: 18px;
      position: relative;
    }

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

    .aip-welcome-name { font-size: 20px; font-weight: 800; color: white; margin-bottom: 10px; }
    .aip-welcome-msg { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 24px; }

    .aip-start-btn {
      padding: 12px 28px;
      border-radius: 50px;
      border: none;
      color: white;
      font-size: 14px;
      font-weight: 700;
      font-family: 'Cairo', 'Inter', sans-serif;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 20px rgba(108,99,255,0.4);
    }

    .aip-start-btn:hover { transform: scale(1.05); }

    /* FOOTER */
    #aip-footer {
      padding: 8px;
      text-align: center;
      font-size: 10px;
      color: rgba(255,255,255,0.2);
      background: #13131c;
      border-top: 1px solid rgba(255,255,255,0.04);
      flex-shrink: 0;
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
      <style>:root { --aip-color: ${config.primary_color}; }</style>

      <!-- TOGGLE BUTTON -->
      <button id="aip-toggle" style="background: linear-gradient(135deg, ${config.primary_color}, ${config.secondary_color || '#4ECDC4'});" aria-label="Open chat">
        <span class="aip-toggle-icon" id="aip-icon-open">💬</span>
        <span class="aip-toggle-icon hidden" id="aip-icon-close">✕</span>
        <div id="aip-badge"></div>
      </button>

      <!-- CHAT WINDOW -->
      <div id="aip-window" role="dialog" aria-label="Chat window">
        
        <!-- HEADER -->
        <div id="aip-header" style="background: linear-gradient(135deg, ${config.primary_color}, ${config.secondary_color || '#4ECDC4'});">
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
            <div class="aip-welcome-avatar" style="background: linear-gradient(135deg, ${config.primary_color}33, ${config.secondary_color || '#4ECDC4'}33); border-color: ${config.primary_color}44;">
              ${config.avatar_url ? `<img src="${config.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : '🤖'}
            </div>
            <div class="aip-welcome-name">${agentName}</div>
            <div class="aip-welcome-msg">${welcomeMsg}</div>
            <button class="aip-start-btn" style="background: linear-gradient(135deg, ${config.primary_color}, ${config.secondary_color || '#4ECDC4'});" onclick="window._aipWidget.startChat()">
              ${isRTL() ? '🚀 ابدأ المحادثة' : '🚀 Start Chat'}
            </button>
          </div>

          <!-- TYPING INDICATOR -->
          <div id="aip-typing">
            <div class="aip-msg-avatar-sm" style="background:${config.primary_color}33;color:${config.primary_color};">🤖</div>
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
          <button id="aip-send" style="background: linear-gradient(135deg, ${config.primary_color}, ${config.secondary_color || '#4ECDC4'});" aria-label="Send">
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
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold text: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ffffff;font-weight:700;">$1</strong>');

    // Clickable Links: [Title](URL)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, (match, title, url) => {
      if (url.includes('wa.me') || url.includes('whatsapp.com')) {
        return `<br><a href="${url}" target="_blank" class="aip-wa-btn">💬 ${title}</a><br>`;
      }
      return `<a href="${url}" target="_blank" class="aip-link">${title}</a>`;
    });

    // Standalone WhatsApp links
    html = html.replace(/(https?:\/\/(?:wa\.me|api\.whatsapp\.com)[^\s<]+)/g, (url) => {
      return `<br><a href="${url}" target="_blank" class="aip-wa-btn">💬 تواصل مباشر عبر الواتساب</a><br>`;
    });

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
