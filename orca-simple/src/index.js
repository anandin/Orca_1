/**
 * Orca Simple - Minimal AI Assistant connected to Samskara Brain
 * 
 * Core loop:
 * 1. Receive message
 * 2. Consult brain (BUDDHI)
 * 3. Execute response
 * 4. Report outcome to brain (karma loop)
 */

import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// Configuration
const CONFIG = {
  port: process.env.PORT || 3000,
  brainUrl: process.env.BRAIN_URL || 'https://samskara-mind.replit.app/api/sdk',
  brainApiKey: process.env.BRAIN_API_KEY || 'sk_8eaa778c11e3977593bc51cbabf9298723c71c7e0d53a023',
  agentId: process.env.AGENT_ID || 'orca-simple',
};

// ─── Brain Client ────────────────────────────────────────────────────────

/**
 * Call the Samskara brain - consult() function
 */
async function consultBrain(message, context = {}) {
  // REST API call
  const response = await fetch(`${CONFIG.brainUrl}/consult`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CONFIG.brainApiKey,
      'X-Agent-Id': CONFIG.agentId,
    },
    body: JSON.stringify({
      query: message,
      context: JSON.stringify(context),
      indriyaId: 'sparsha',
      indriyaType: 'jnanendriya',
    }),
  });

  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error.message || JSON.stringify(result.error));
  }

  return result;
}

/**
 * Report outcome to brain for karma learning
 */
async function reportOutcome(consultId, outcome) {
  // REST API call
  const response = await fetch(`${CONFIG.brainUrl}/outcome`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CONFIG.brainApiKey,
      'X-Agent-Id': CONFIG.agentId,
    },
    body: JSON.stringify({
      consultId,
      outcome, // 'positive', 'negative', 'neutral'
    }),
  });

  return response.json();
}

// ─── Agent Loop ───────────────────────────────────────────────────────────

/**
 * Process a message through the full Orca loop
 */
async function processMessage(message, sessionId = 'default') {
  console.log(`[Orca] Processing: ${message.substring(0, 50)}...`);

  // Step 1: Consult brain
  const brainResponse = await consultBrain(message, { sessionId });
  
  const { consultId, answer, confidence } = brainResponse;
  
  console.log(`[Orca] Brain response (confidence: ${confidence})`);
  console.log(`[Orca] Answer: ${answer.substring(0, 200)}...`);

  // Step 2: Execute (for now, just return the brain's answer)
  // In full version, parse action intents and execute tools
  const result = {
    answer,
    consultId,
    confidence,
  };

  // Step 3: Report outcome (default positive for now)
  // In full version, ask user for feedback
  try {
    await reportOutcome(consultId, 'positive');
    console.log(`[Orca] Outcome reported to brain`);
  } catch (err) {
    console.error(`[Orca] Failed to report outcome:`, err.message);
  }

  return result;
}

// ─── HTTP API ───────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'orca-simple', brain: CONFIG.brainUrl });
});

// Web UI - Chat interface
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🐋 Orca - AI Companion</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
      color: #fff; min-height: 100vh; display: flex; flex-direction: column;
    }
    header { 
      padding: 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    h1 { font-size: 1.5em; background: linear-gradient(135deg, #a855f7, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .status { font-size: 0.8em; color: #22c55e; margin-top: 5px; }
    #chat { flex: 1; overflow-y: auto; padding: 20px; max-width: 800px; margin: 0 auto; width: 100%; }
    .message { margin-bottom: 15px; padding: 15px; border-radius: 12px; max-width: 85%; }
    .user { background: rgba(168,85,247,0.2); margin-left: auto; border: 1px solid #a855f7; }
    .orca { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
    .orca strong { color: #a855f7; }
    .typing { color: #888; font-style: italic; }
    #input-area { 
      padding: 20px; border-top: 1px solid rgba(255,255,255,0.1);
      max-width: 800px; margin: 0 auto; width: 100%; display: flex; gap: 10px;
    }
    input { 
      flex: 1; padding: 15px; border-radius: 25px; border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.05); color: #fff; font-size: 1em; outline: none;
    }
    input:focus { border-color: #a855f7; }
    button { 
      padding: 15px 30px; border-radius: 25px; border: none; background: linear-gradient(135deg, #a855f7, #ec4899);
      color: #fff; font-weight: bold; cursor: pointer; font-size: 1em;
    }
    button:hover { opacity: 0.9; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <header>
    <h1>🐋 Orca - AI Companion</h1>
    <div class="status">● Connected to BUDDHI brain</div>
  </header>
  <div id="chat"></div>
  <div id="input-area">
    <input type="text" id="message" placeholder="Ask anything..." autocomplete="off">
    <button id="send">Send</button>
  </div>
  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('message');
    const sendBtn = document.getElementById('send');
    
    function addMessage(text, isUser) {
      const div = document.createElement('div');
      div.className = 'message ' + (isUser ? 'user' : 'orca');
      div.innerHTML = isUser ? text : text.replace(/\\n/g, '<br>').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }
    
    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      addMessage(text, true);
      sendBtn.disabled = true;
      
      const typing = document.createElement('div');
      typing.className = 'message orca typing';
      typing.textContent = '...';
      chat.appendChild(typing);
      chat.scrollTop = chat.scrollHeight;
      
      try {
        const res = await fetch('/api/message', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({message: text})
        });
        const data = await res.json();
        typing.remove();
        if (data.answer) addMessage(data.answer, false);
        else addMessage('Error: ' + JSON.stringify(data), false);
      } catch (e) {
        typing.remove();
        addMessage('Error: ' + e.message, false);
      }
      sendBtn.disabled = false;
      input.focus();
    }
    
    sendBtn.onclick = send;
    input.onkeypress = e => { if (e.key === 'Enter') send(); };
    input.focus();
  </script>
</body>
</html>`);
});

// Process message
app.post('/api/message', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const result = await processMessage(message, sessionId);
    res.json(result);
  } catch (error) {
    console.error('[Orca] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Telegram webhook (placeholder)
app.post('/webhook/telegram', async (req, res) => {
  try {
    const { message } = req.body;
    const text = message?.text;
    
    if (!text) {
      return res.json({ ok: true });
    }

    const result = await processMessage(text, `telegram:${message.chat?.id}`);
    
    // Reply to telegram (would need bot token)
    // For now just acknowledge
    res.json({ ok: true });
  } catch (error) {
    console.error('[Orca] Telegram webhook error:', error.message);
    res.json({ ok: false, error: error.message });
  }
});

// Start server
app.listen(CONFIG.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  🐋 Orca Simple                           ║
║         Minimal AI Assistant + Samskara Brain             ║
╠═══════════════════════════════════════════════════════════╣
║  Brain:     ${CONFIG.brainUrl.substring(0, 40)}...║
║  Agent ID:  ${CONFIG.agentId}                                    ║
║  Port:      ${CONFIG.port}                                          ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export { app, processMessage, consultBrain, reportOutcome };
