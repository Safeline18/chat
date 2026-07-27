require('dotenv').config();

async function test() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: GROQ_API_KEY is not defined in your local .env file!');
    console.log('👉 Please add: GROQ_API_KEY=gsk_... to your .env file first.');
    return;
  }
  
  console.log('🧪 Testing Groq API Key:', apiKey.substring(0, 10) + '...');
  
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hi, reply with ONLY the word "Success" if you read this.' }]
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      console.log('✅ Success! Response:', data.choices?.[0]?.message?.content?.trim());
    } else {
      console.error('❌ Failed! Code:', res.status, JSON.stringify(data.error));
    }
  } catch (err) {
    console.error('❌ Fetch Error:', err.message);
  }
}

test();
