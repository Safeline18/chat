# 🤖 AI Agent Platform - Multi-Channel & Multi-Business

منصة ذكاء اصطناعي احترافية لبناء مساعدين افتراضيين كخدمة عملاء رد آلي تعمل على الموقع الإلكتروني، واتساب، تليجرام، تيك توك، فيسبوك ماسنجر، إنستغرام، وتويتر/X، تدعم قواعد معرفة مخصصة وتخزين سحابي على **MongoDB Atlas**.

---

## 🌟 المميزات الرئيسية (Key Features)

- 🌐 **تعدد القنوات (Multi-Channel):**
  - **Chat Widget:** ويدجت محادثة للمواقع بـ Script بسيط.
  - **WhatsApp Business:** ربط مباشر عبر Meta Cloud API.
  - **TikTok Direct Messages:** دعم رسائل تيك توك التلقائية.
  - **Telegram Bot:** ربط مباشر تلقائي بـ Bot Token.
  - **Facebook & Instagram:** Meta Graph API Webhooks.
  - **Twitter / X DMs:** X Account Activity API.
- 🏢 **تعدد الأنشطة التجارية (Multi-Tenant):** إضافة وإدارة أنشطة تجارية غير محدودة بشخصية وقواعد معرفية مخصصة لكل نشاط.
- 🤖 **Gemini AI Engine:** ردود بشرية طبيعية سريعة مع كشف تلقائي للغات وذاكرة محادثة.
- 🍃 **MongoDB Atlas:** قاعدة بيانات سحابية لحفظ كل سجلات المحادثات والأنشطة والرسائل.
- 🖥️ **Admin Dashboard:** لوحة تحكم عصرية لمراقبة المحادثات مباشرة وإدارة الأنشطة والتقارير.

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

- **Backend:** Node.js + Express
- **AI Model:** Google Gemini API (`@google/generative-ai`)
- **Database:** MongoDB Atlas + Mongoose ODM
- **Real-Time:** Socket.io (WebSockets)
- **Frontend:** Responsive Glassmorphism Dashboard (Vanilla HTML/CSS/JS)

---

## 📁 هيكل المشروع (Project Structure)

```
ai-agent-platform/
├── server.js              # Express Server & WebSocket initialization
├── .env.example           # Environment variables template
├── package.json
├── src/
│   ├── database.js        # MongoDB Atlas models (Business, Conversation, Message, Analytics)
│   ├── gemini.js          # Gemini AI Engine & Language Detection
│   ├── routes/
│   │   ├── admin.js       # Admin Dashboard API Endpoints
│   │   └── chat.js        # Chat Widget API Endpoints
│   └── webhooks/
│       ├── whatsapp.js    # WhatsApp Cloud API Webhook
│       ├── facebook.js    # Facebook Messenger & Instagram Webhook
│       ├── tiktok.js      # TikTok DM Webhook
│       ├── telegram.js    # Telegram Bot Webhook
│       └── twitter.js     # Twitter/X DM Webhook
└── public/
    ├── dashboard/         # Single-page Admin Dashboard App
    ├── widget/            # Embeddable Chat Widget JS
    └── widget-demo.html   # Live Chat Widget Demo Page
```

---

## 🚀 التثبيت والتشغيل المحلي (Local Setup)

### 1. الاستنساخ وتثبيت الحزم
```bash
git clone https://github.com/Mohisvst29/chat.git
cd chat
npm install
```

### 2. إعداد المتغيرات البيئية (.env)
قم بإنشاء ملف `.env` بناءً على `.env.example`:
```env
PORT=3000
ADMIN_SECRET=admin123
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.wmnwki3.mongodb.net/ai_agent_platform
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.0-flash
```

### 3. تشغيل السيرفر
```bash
npm start
```

افتح لوحة التحكم في المتصفح: `http://localhost:3000/dashboard`

---

## ☁️ النشر المباشر (Deployment on Railway / Render)

1. ارفع الكود إلى **GitHub**.
2. انتقل إلى [Railway.app](https://railway.app) أو [Render.com](https://render.com).
3. اختر **New Project** → **Deploy from GitHub repo**.
4. أضف الـ **Environment Variables** الموجودة في `.env`.
5. ستحصل على رابط `https` جاهز لاستخدامه في الـ Webhooks لجميع المنصات!

---

## 📜 الترخيص (License)
MIT License - مفتوح المصدر للاستخدام التجاري والشخصي.
