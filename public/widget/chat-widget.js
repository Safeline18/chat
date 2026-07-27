/**
 * AI Agent Platform - WhatsApp-Style Chat Widget with Interactive Emoji Picker
 * Usage: <script src="/widget.js" data-business-id="YOUR_ID"></script>
 * Version: 2.2.0
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
    agent_name: 'Assistant',
    agent_name_ar: 'المساعد',
    welcome_message: 'Hello! How can I help you today? 😊',
    welcome_message_ar: 'أهلاً بك! كيف يمكنني مساعدتك اليوم؟ 😊',
    primary_color: '#008069',
    secondary_color: '#25D366',
    avatar_url: null,
  };

  let state = {
    isOpen: false,
    conversationId: null,
    messages: [],
    isTyping: false,
    unreadCount: 0,
  };

  const EMOJI_LIST = [
    '😊', '😂', '😍', '🥰', '👍', '🙏', '❤️', '🔥',
    '✨', '🎉', '👏', '😁', '😎', '🥳', '🤔', '😅',
    '🙌', '💯', '👋', '🌹', '🤝', '⭐', '💡', '✅',
    '👌', '💬', '📞', '📍', '🌸', '💐', '🤍', '💪',
    '🤩', '😜', '😇', '😴', '🙈', '🎯', '🚀', '🎁'
  ];

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
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap');

    #aip-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

    #aip-widget {
      position: fixed;
      ${WIDGET_POSITION.includes('right') ? 'right: 20px;' : 'left: 20px;'}
      bottom: 20px;
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
      background: linear-gradient(135deg, #25D366 0%, #128C7E 100%) !important;
      box-shadow: 0 8px 24px rgba(37, 211, 102, 0.4);
      transition: all 0.25s ease;
      position: relative;
      outline: none;
    }

    #aip-toggle:hover { transform: scale(1.06); box-shadow: 0 10px 28px rgba(37, 211, 102, 0.5); }
    #aip-toggle:active { transform: scale(0.95); }

    .aip-toggle-icon { font-size: 26px; color: white; display: flex; align-items: center; justify-content: center; transition: all 0.25s ease; }
    .aip-toggle-icon.hidden { display: none; }

    /* UNREAD BADGE */
    #aip-badge {
      position: absolute;
      top: -2px; right: -2px;
      background: #EF4444;
      color: white;
      font-size: 11px;
      font-weight: 700;
      width: 20px; height: 20px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
      display: none;
    }

    /* CHAT WINDOW */
    #aip-window {
      position: absolute;
      ${WIDGET_POSITION.includes('right') ? 'right: 0;' : 'left: 0;'}
      bottom: 74px;
      width: 370px;
      height: 580px;
      background: #EFEAE2;
      color: #111B21;
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.05);
      transform: scale(0.95) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: bottom right;
    }

    #aip-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* WHATSAPP HEADER */
    #aip-header {
      padding: 14px 16px;
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      flex-shrink: 0;
      background: #008069 !important;
      color: #FFFFFF;
    }

    .aip-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .aip-avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      background: #FFFFFF;
      flex-shrink: 0;
      overflow: hidden;
      padding: 2px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }

    .aip-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

    .aip-header-info { text-align: right; }
    .aip-header-name { font-size: 16px; font-weight: 700; color: #FFFFFF; margin-bottom: 1px; }
    .aip-header-status {
      font-size: 11.5px;
      color: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }

    .aip-status-dot {
      width: 8px; height: 8px;
      background: #25D366;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.2);
    }

    .aip-close-btn {
      width: 34px; height: 34px;
      background: rgba(255, 255, 255, 0.15);
      border: none;
      border-radius: 50%;
      color: white;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .aip-close-btn:hover { background: rgba(255, 255, 255, 0.28); }

    /* MESSAGES CONTAINER */
    #aip-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background-color: #EFEAE2;
      background-image: radial-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 0);
      background-size: 16px 16px;
    }

    .aip-msg-row {
      display: flex;
      width: 100%;
    }

    .aip-msg-user-row {
      justify-content: flex-end;
    }

    .aip-msg-bot-row {
      justify-content: flex-start;
    }

    /* WHATSAPP BUBBLES */
    .aip-msg-bubble {
      max-width: 82%;
      padding: 9px 12px 7px 12px;
      font-size: 14px;
      line-height: 1.55;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
      position: relative;
      box-shadow: 0 1px 1px rgba(11, 20, 26, 0.12);
    }

    /* BOT BUBBLE */
    .aip-bubble-bot {
      background: #FFFFFF !important;
      color: #111B21 !important;
      border-radius: 12px 12px 12px 2px;
    }

    /* USER BUBBLE */
    .aip-bubble-user {
      background: #D9FDD3 !important;
      color: #111B21 !important;
      border-radius: 12px 12px 2px 12px;
    }

    .aip-bubble-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 3px;
      margin-top: 3px;
      font-size: 10px;
      color: #667781;
      float: left;
      margin-right: -4px;
    }

    .aip-bubble-footer-user {
      color: #53B788;
    }

    /* BUTTON ACTIONS */
    .aip-btn-container {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .aip-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #008069;
      color: white !important;
      padding: 8px 14px;
      border-radius: 18px;
      text-decoration: none !important;
      font-weight: 600;
      font-size: 13px;
      transition: background 0.2s;
      width: 100%;
      text-align: center;
      box-shadow: 0 2px 5px rgba(0, 128, 105, 0.2);
    }
    .aip-action-btn:hover { background: #006653; }

    /* INPUT CONTAINER */
    #aip-input-container {
      background: #F0F2F5;
      border-top: 1px solid #E9EDEF;
      padding: 10px 12px 6px 12px;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: relative;
    }

    #aip-input-area {
      background: #FFFFFF;
      border-radius: 22px;
      padding: 4px 6px 4px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #E9EDEF;
      transition: border-color 0.2s;
    }

    #aip-input-area:focus-within {
      border-color: #008069;
    }

    #aip-input {
      flex: 1;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: #111B21;
      padding: 6px 4px;
      font-size: 13.5px;
      font-weight: 500;
      font-family: 'Cairo', sans-serif;
      resize: none;
      min-height: 36px;
      max-height: 90px;
      outline: none;
      direction: ${isRTL() ? 'rtl' : 'ltr'};
      line-height: 1.5;
    }

    #aip-input::placeholder { color: #8696A0; }

    #aip-emoji-btn {
      font-size: 20px;
      cursor: pointer;
      opacity: 0.75;
      transition: transform 0.15s, opacity 0.15s;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #aip-emoji-btn:hover { opacity: 1; transform: scale(1.15); }

    /* EMOJI PICKER POPUP */
    #aip-emoji-picker {
      position: absolute;
      bottom: 68px;
      ${isRTL() ? 'right: 14px;' : 'left: 14px;'}
      width: 270px;
      max-height: 200px;
      background: #FFFFFF;
      border: 1px solid #E9EDEF;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
      padding: 10px;
      display: none;
      grid-template-columns: repeat(8, 1fr);
      gap: 6px;
      z-index: 100;
      overflow-y: auto;
      animation: aip-picker-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes aip-picker-in {
      from { opacity: 0; transform: translateY(8px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    #aip-emoji-picker.show {
      display: grid;
    }

    .aip-emoji-item {
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 8px;
      transition: background 0.15s, transform 0.15s;
      user-select: none;
    }

    .aip-emoji-item:hover {
      background: #F0F2F5;
      transform: scale(1.25);
    }

    #aip-send {
      width: 36px; height: 36px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: white;
      background: #00A884;
      transition: all 0.2s ease;
      flex-shrink: 0;
      outline: none;
      box-shadow: 0 2px 6px rgba(0, 168, 132, 0.3);
    }

    #aip-send:hover { background: #008069; transform: scale(1.05); }
    #aip-send:active { transform: scale(0.95); }
    #aip-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    #aip-footer {
      padding-top: 4px;
      text-align: center;
      font-size: 10px;
      color: #8696A0;
      font-weight: 500;
    }

    /* TYPING INDICATOR */
    #aip-typing {
      display: none;
      align-items: flex-start;
      margin-top: 2px;
    }

    #aip-typing.show { display: flex; }

    .aip-typing-bubble {
      background: #FFFFFF;
      border-radius: 12px 12px 12px 2px;
      padding: 10px 14px;
      display: flex;
      gap: 4px;
      align-items: center;
      box-shadow: 0 1px 1px rgba(11, 20, 26, 0.12);
    }

    .aip-typing-dot {
      width: 6px; height: 6px;
      background: #8696A0;
      border-radius: 50%;
      animation: aip-typing 1.2s infinite;
    }

    .aip-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .aip-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes aip-typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* MOBILE RESPONSIVE */
    @media (max-width: 480px) {
      #aip-window {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        width: 100%;
        height: 85vh;
        border-radius: 20px 20px 0 0;
      }
    }
  `;

  // =================== HTML BUILDER ===================
  function buildHTML() {
    const agentName = getText(config.agent_name, config.agent_name_ar);
    const inputPlaceholder = isRTL() ? 'اكتب رسالتك...' : 'Type a message...';

    return `
      <style>${styles}</style>

      <!-- TOGGLE BUTTON -->
      <button id="aip-toggle" aria-label="Open chat">
        <span class="aip-toggle-icon" id="aip-icon-open">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </span>
        <span class="aip-toggle-icon hidden" id="aip-icon-close">✕</span>
        <div id="aip-badge"></div>
      </button>

      <!-- CHAT WINDOW -->
      <div id="aip-window" role="dialog" aria-label="Chat window">
        
        <!-- HEADER -->
        <div id="aip-header">
          <div class="aip-header-right">
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
          </div>
          <button class="aip-close-btn" onclick="window._aipWidget.toggle()" aria-label="Close">✕</button>
        </div>

        <!-- MESSAGES STREAM -->
        <div id="aip-messages">
          <!-- TYPING INDICATOR -->
          <div id="aip-typing">
            <div class="aip-typing-bubble">
              <div class="aip-typing-dot"></div>
              <div class="aip-typing-dot"></div>
              <div class="aip-typing-dot"></div>
            </div>
          </div>
        </div>

        <!-- INPUT AREA -->
        <div id="aip-input-container">
          <!-- EMOJI PICKER POPUP -->
          <div id="aip-emoji-picker"></div>

          <div id="aip-input-area">
            <span id="aip-emoji-btn" title="اختر إيموجي">😊</span>
            <textarea id="aip-input" placeholder="${inputPlaceholder}" rows="1" maxlength="2000"></textarea>
            <button id="aip-send" aria-label="Send">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: scaleX(-1) rotate(-45deg);">
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

  // =================== MARKDOWN FORMATTER ===================
  function formatMessageHtml(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Parse Markdown Links
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, (match, title, url) => {
      return `<div class="aip-btn-container"><a href="${url}" target="_blank" rel="noopener" class="aip-action-btn">🔗 ${title}</a></div>`;
    });

    // Parse raw links
    html = html.replace(/(https?:\/\/[^\s<"'\)]+)/g, (url) => {
      if (html.includes(`href="${url}"`)) return url;
      return `<div class="aip-btn-container"><a href="${url}" target="_blank" rel="noopener" class="aip-action-btn">🔗 ${url}</a></div>`;
    });

    html = html.replace(/^\s*[\-\*•]\s+(.*)$/gm, '• $1');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // =================== CORE FUNCTIONS ===================
  function addMessage(content, role = 'user') {
    const messagesEl = document.getElementById('aip-messages');
    const typing = document.getElementById('aip-typing');

    const row = document.createElement('div');
    row.className = `aip-msg-row ${role === 'user' ? 'aip-msg-user-row' : 'aip-msg-bot-row'}`;

    const time = new Date().toLocaleTimeString(isRTL() ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' });

    const ticksHtml = role === 'user' ? `<span class="aip-bubble-footer-user">✓✓</span>` : '';

    row.innerHTML = `
      <div class="aip-msg-bubble ${role === 'user' ? 'aip-bubble-user' : 'aip-bubble-bot'}">
        ${role === 'user' ? escHtml(content) : formatMessageHtml(content)}
        <div class="aip-bubble-footer">
          <span>${time}</span>
          ${ticksHtml}
        </div>
      </div>
    `;

    messagesEl.insertBefore(row, typing);
    scrollToBottom();

    state.messages.push({ role, content, time });
  }

  function showTyping(show) {
    state.isTyping = show;
    const el = document.getElementById('aip-typing');
    if (el) el.classList.toggle('show', show);
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

    // Hide emoji picker if open
    document.getElementById('aip-emoji-picker')?.classList.remove('show');

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

      const delay = Math.min(data.typing_delay || 600, 1500);
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
      setTimeout(() => document.getElementById('aip-input')?.focus(), 250);
    } else {
      document.getElementById('aip-emoji-picker')?.classList.remove('show');
    }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function insertEmoji(emoji) {
    const input = document.getElementById('aip-input');
    if (!input) return;
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    const val = input.value;
    input.value = val.substring(0, start) + emoji + val.substring(end);
    input.focus();
    input.setSelectionRange(start + emoji.length, start + emoji.length);
    
    // Auto-resize
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 90) + 'px';
  }

  // =================== INIT ===================
  async function init() {
    try {
      const res = await fetch(`${SERVER_URL}/api/chat/config/${BUSINESS_ID}`);
      if (res.ok) {
        const data = await res.json();
        Object.assign(config, data);
      }
    } catch (e) { console.warn('[AI Agent Widget] Using default configuration'); }

    const container = document.createElement('div');
    container.id = 'aip-widget';
    container.innerHTML = buildHTML();
    document.body.appendChild(container);

    // Build Emoji Picker
    const emojiPickerEl = document.getElementById('aip-emoji-picker');
    if (emojiPickerEl) {
      EMOJI_LIST.forEach(emoji => {
        const item = document.createElement('span');
        item.className = 'aip-emoji-item';
        item.innerText = emoji;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          insertEmoji(emoji);
        });
        emojiPickerEl.appendChild(item);
      });
    }

    // Toggle Emoji Picker
    const emojiBtn = document.getElementById('aip-emoji-btn');
    emojiBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPickerEl?.classList.toggle('show');
    });

    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
      if (emojiPickerEl && !emojiPickerEl.contains(e.target) && e.target !== emojiBtn) {
        emojiPickerEl.classList.remove('show');
      }
    });

    // Auto-restore history or add welcome message
    try {
      const savedConvId = localStorage.getItem(`aip_conv_${BUSINESS_ID}`);
      if (savedConvId) {
        state.conversationId = savedConvId;
        const res = await fetch(`${SERVER_URL}/api/chat/history/${savedConvId}`);
        if (res.ok) {
          const d = await res.json();
          if (d && d.messages && d.messages.length > 0) {
            d.messages.forEach(m => {
              addMessage(m.content, m.role === 'assistant' ? 'assistant' : 'user');
            });
          } else {
            addMessage(getText(config.welcome_message, config.welcome_message_ar), 'assistant');
          }
        } else {
          addMessage(getText(config.welcome_message, config.welcome_message_ar), 'assistant');
        }
      } else {
        addMessage(getText(config.welcome_message, config.welcome_message_ar), 'assistant');
      }
    } catch (e) {
      addMessage(getText(config.welcome_message, config.welcome_message_ar), 'assistant');
    }

    // Events
    document.getElementById('aip-toggle')?.addEventListener('click', toggle);

    document.getElementById('aip-send')?.addEventListener('click', () => {
      const input = document.getElementById('aip-input');
      sendMessage(input?.value || '');
    });

    document.getElementById('aip-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const input = document.getElementById('aip-input');
        sendMessage(input?.value || '');
      }
    });

    document.getElementById('aip-input')?.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 90) + 'px';
    });

    window._aipWidget = { toggle, sendMessage };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
