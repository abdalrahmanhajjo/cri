/**
 * AI routes — Trip planning via Groq (same as VisitTripoliApp) or optional n8n webhook.
 * POST /api/ai/complete — body: { prompt } or { system, user, temperature?, maxTokens? }
 *
 * Production hardening: set AI_REQUIRE_AUTH=1 to require a valid JWT for /complete.
 * /test is off in production unless AI_TEST_ENDPOINT=1 (avoids unauthenticated LLM probes).
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Read at request time so a restart picks up .env without relying on require order. */
function groqApiKey() {
  return (process.env.GROQ_API_KEY || '').trim();
}
function n8nWebhookUrl() {
  return (process.env.N8N_WEBHOOK_URL || '').trim();
}
function groqModels() {
  const rawPriority = (process.env.GROQ_MODEL_PRIORITY || '').trim();
  const fromPriority = rawPriority
    ? rawPriority.split(',').map((x) => x.trim()).filter(Boolean)
    : [];
  const explicit = (process.env.GROQ_MODEL || '').trim();
  const defaults = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  return [...new Set([...fromPriority, explicit, ...defaults].filter(Boolean))];
}

function useGroqDirect() {
  return groqApiKey().length > 0;
}

function useN8n() {
  return n8nWebhookUrl().length > 0;
}

function isConfigured() {
  return useGroqDirect() || useN8n();
}

async function callGroqOnce(messages, temperature = 0.5, maxTokens = 2048, model) {
  const safeTemperature = Math.max(0, Math.min(1, Number(temperature) || 0.5));
  const safeMaxTokens = Math.max(128, Math.min(4096, Number(maxTokens) || 2048));
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: safeTemperature,
      max_tokens: safeMaxTokens,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const bodyText = await res.text();
  let json = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = json?.error?.message || json?.message || bodyText || res.statusText;
    const e = new Error(err);
    e.status = res.status;
    e.isRateLimit = res.status === 429 || (typeof err === 'string' && /rate limit/i.test(err));
    e.isRetryable = res.status === 408 || res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504;
    e.isModelIssue =
      res.status === 400 &&
      typeof err === 'string' &&
      /(model|decommissioned|not found|unsupported|does not exist)/i.test(err);
    e.model = model;
    throw e;
  }
  const text = json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text ?? '';
  return { text: String(text).trim(), raw: json, model };
}

const MAX_GROQ_RETRIES = 3;
const MAX_RATE_LIMIT_WAIT_MS = 20000;

async function callGroq(messages, temperature = 0.5, maxTokens = 2048) {
  const models = groqModels();
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt <= MAX_GROQ_RETRIES; attempt += 1) {
      try {
        return await callGroqOnce(messages, temperature, maxTokens, model);
      } catch (err) {
        lastErr = err;
        if (err.isRateLimit && attempt < MAX_GROQ_RETRIES) {
          const msg = String(err.message || '');
          const match = msg.match(/try again in ([\d.]+)\s*s/i);
          const sec = match ? Math.min(parseFloat(match[1]) || 5, MAX_RATE_LIMIT_WAIT_MS / 1000) : 5;
          const ms = Math.min(Math.ceil(sec * 1000), MAX_RATE_LIMIT_WAIT_MS);
          console.log(`[AI] Groq rate limited on ${model}, waiting ${(ms / 1000).toFixed(1)}s then retry (${attempt + 1}/${MAX_GROQ_RETRIES})`);
          await new Promise((r) => setTimeout(r, ms));
          continue;
        }
        if ((err.isModelIssue || (err.isRetryable && attempt === MAX_GROQ_RETRIES)) && model !== models[models.length - 1]) {
          console.warn(`[AI] Groq model ${model} failed, trying fallback model. Reason: ${err.message}`);
          break;
        }
        if (err.isRetryable && attempt < MAX_GROQ_RETRIES) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
  }
  throw lastErr;
}

function aiAuthIfRequired(req, res, next) {
  const requireAuth =
    process.env.AI_REQUIRE_AUTH === '1' || process.env.AI_REQUIRE_AUTH === 'true';
  if (isProd && requireAuth) return authMiddleware(req, res, next);
  next();
}

router.post('/complete', aiAuthIfRequired, async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      error: 'AI not configured',
      detail:
        'Set GROQ_API_KEY in server .env (free at https://console.groq.com), or N8N_WEBHOOK_URL for n8n.',
    });
  }

  const { prompt, system, user, temperature = 0.5, maxTokens = 2048 } = req.body || {};
  const hasSystemUser = typeof system === 'string' && typeof user === 'string';
  const hasPrompt = typeof prompt === 'string' && prompt.length > 0;

  if (!hasSystemUser && !hasPrompt) {
    return res.status(400).json({ error: 'Missing prompt or (system + user)' });
  }
  if (hasSystemUser && (system.length > 100000 || user.length > 50000)) {
    return res.status(400).json({ error: 'Prompt too long' });
  }
  if (hasPrompt && prompt.length > 100000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  if (useGroqDirect()) {
    const messages = hasSystemUser
      ? [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ]
      : [{ role: 'user', content: prompt }];
    console.log('[AI] POST /complete (Groq direct)', hasSystemUser ? 'system+user' : 'prompt');
    try {
      const { text, model } = await callGroq(messages, temperature, maxTokens);
      if (!text) console.warn('[AI] Groq returned empty text');
      else console.log('[AI] Groq 200 OK, model:', model, 'response length:', text.length);
      return res.json({ text: text || '', model: model || null });
    } catch (err) {
      console.error('[AI] Groq error:', err.message);
      const isAuth = err.message && /api.key|401|403|invalid|unauthorized/i.test(err.message);
      return res.status(isAuth ? 401 : 503).json({
        error: isAuth ? 'Invalid API Key' : 'The planner is currently busy or overloaded. Please try again shortly, or manually edit your trip.',
      });
    }
  }

  const payload = hasSystemUser
    ? { system, user, temperature, maxTokens }
    : { prompt, temperature, maxTokens, ...req.body };
  console.log('[AI] POST /complete (n8n)', hasSystemUser ? 'system+user' : 'prompt');

  try {
    const n8nResponse = await fetch(n8nWebhookUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    const contentType = n8nResponse.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const bodyText = await n8nResponse.text();
    let json = null;
    if (isJson && bodyText) {
      try {
        json = JSON.parse(bodyText);
      } catch {
        json = null;
      }
    }

    if (!n8nResponse.ok) {
      const errMsg = json?.error || json?.message || json?.hint || bodyText || `n8n returned ${n8nResponse.status}`;
      const msgStr = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
      console.error('[AI] n8n failed:', n8nResponse.status, msgStr);
      let userError = 'n8n request failed';
      if (n8nResponse.status === 404) {
        if (/GET request|not registered for GET/i.test(msgStr)) {
          userError = 'The webhook only accepts POST. Use the app to send messages.';
        } else {
          userError = 'Webhook not registered. Turn n8n workflow Active, or set GROQ_API_KEY.';
        }
      } else if (n8nResponse.status >= 500 && errMsg) {
        userError = `n8n error: ${String(errMsg).slice(0, 200)}`;
      } else if (errMsg && errMsg.length < 150) {
        userError = errMsg;
      }
      return res.status(n8nResponse.status).json({ error: userError, detail: msgStr });
    }

    let text = (json?.text ?? json?.data ?? (typeof json === 'string' ? json : null)) ?? '';
    if (!text && json?.choices?.[0]?.message?.content != null) {
      text = String(json.choices[0].message.content);
    }
    if (!text && json?.choices?.[0]?.text != null) {
      text = String(json.choices[0].text);
    }
    const trimmed = String(text).trim();
    const errorDetail =
      !trimmed && json?.error?.message ? String(json.error.message).slice(0, 200) : undefined;
    if (!trimmed) console.warn('[AI] n8n 200 but empty text. keys:', json ? Object.keys(json) : []);
    else console.log('[AI] n8n 200 OK, length:', trimmed.length);
    return res.json({ text: trimmed || '', ...(errorDetail && { errorDetail }) });
  } catch (err) {
    console.error('[AI] /complete (n8n) error:', err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out', detail: 'Try again.' });
    }
    const msg = String(err.message || '');
    const isNetwork = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i.test(msg);
    return res.status(isNetwork ? 503 : 500).json({
      error: 'The smart planner is a bit busy right now. We are working on reconnecting to our AI paths.',
    });
  }
});

router.post('/rerank-places', aiAuthIfRequired, async (req, res) => {
  if (!useGroqDirect()) {
    return res.status(503).json({ error: 'Reranking requires active Groq API Key' });
  }

  const { intent, candidates } = req.body;
  if (!intent || !candidates || !candidates.length) {
    return res.status(400).json({ error: 'Missing intent or candidates' });
  }

  const prompt = `You are an AI planner. Rerank these places based on this user intent: "${intent}".
Return a JSON array of objects with exactly 'id', 'aiRelevance' (0-10) and 'reason' fields.
Candidates:\n${candidates.map(c => `- ${c.id}: ${c.name}`).join('\n')}`;

  try {
    const { text } = await callGroq([{ role: 'user', content: prompt }], 0.2, 2048);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Failed to parse array');
    const scoredIds = JSON.parse(match[0]);
    res.json({ ranked: scoredIds });
  } catch (err) {
    console.error('[AI] Rerank error', err.message);
    res.status(500).json({ error: 'Reranking failed' });
  }
});

router.get('/status', (req, res) => {
  res.json({
    available: isConfigured(),
    provider: useGroqDirect() ? 'groq' : useN8n() ? 'n8n' : 'none',
    groq: useGroqDirect() ? 'configured' : 'not set',
    n8n: useN8n() ? 'configured' : 'not set',
  });
});

router.get('/test', async (req, res) => {
  if (isProd && process.env.AI_TEST_ENDPOINT !== '1' && process.env.AI_TEST_ENDPOINT !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (!isConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'AI not configured',
      hint: 'Add GROQ_API_KEY to server/.env (free at console.groq.com) or N8N_WEBHOOK_URL.',
    });
  }
  if (useGroqDirect()) {
    try {
      const { text } = await callGroq([{ role: 'user', content: 'Reply with exactly: OK' }], 0, 20);
      const ok = text && text.length > 0;
      console.log('[AI] /test Groq ok:', ok);
      return res.json({ ok, provider: 'groq', text: text ? text.slice(0, 200) : null });
    } catch (err) {
      console.error('[AI] /test Groq error:', err.message);
      return res.status(500).json({
        ok: false,
        provider: 'groq',
        error: err.message,
        hint: 'Check GROQ_API_KEY in .env. Get a free key at console.groq.com',
      });
    }
  }
  try {
    const testResponse = await fetch(n8nWebhookUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Reply with exactly: OK', temperature: 0, maxTokens: 20 }),
      signal: AbortSignal.timeout(15000),
    });
    const bodyText = await testResponse.text();
    let json = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      json = null;
    }
    const text =
      json?.text ??
      (json?.choices?.[0]?.message?.content != null ? String(json.choices[0].message.content) : '');
    const ok = testResponse.ok && text && text.trim().length > 0;
    return res.json({
      ok,
      provider: 'n8n',
      n8nStatus: testResponse.status,
      text: text ? text.trim().slice(0, 200) : null,
      error: !testResponse.ok ? json?.message || json?.error || bodyText?.slice(0, 300) : undefined,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      provider: 'n8n',
      error: err.message,
      hint: 'Backend cannot reach n8n. Or set GROQ_API_KEY.',
    });
  }
});

module.exports = router;
