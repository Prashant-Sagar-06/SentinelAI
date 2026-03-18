function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function normalizeStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).map((s) => s.trim()).slice(0, 20);
}

export function normalizeCopilotPayload(payload) {
  // Accept either a JSON object or a plain string (fallback behavior).
  if (typeof payload === 'string') {
    const parsed = safeJsonParse(payload);
    if (parsed.ok) return normalizeCopilotPayload(parsed.value);
    return { analysis: payload, evidence: [], recommended_actions: [] };
  }

  if (!payload || typeof payload !== 'object') {
    return { analysis: String(payload ?? ''), evidence: [], recommended_actions: [] };
  }

  return {
    analysis: typeof payload.analysis === 'string' ? payload.analysis : JSON.stringify(payload),
    evidence: normalizeStringArray(payload.evidence),
    recommended_actions: normalizeStringArray(payload.recommended_actions),
  };
}

function getEnv(name) {
  return process.env[name];
}

function resolveProvider() {
  const requested = (getEnv('COPILOT_PROVIDER') || '').toLowerCase();
  if (!requested) return 'mock';

  if (requested === 'openai') {
    return getEnv('OPENAI_API_KEY') ? 'openai' : 'mock';
  }

  if (requested === 'groq') {
    return getEnv('GROQ_API_KEY') ? 'groq' : 'mock';
  }

  if (requested === 'mock') return 'mock';

  // Unsupported provider should never break runtime.
  return 'mock';
}

async function callChatCompletions({ baseUrl, apiKey, model, messages }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  const text = await res.text();
  if (!res.ok) {
    const code = res.status;
    const err = new Error(`LLM error ${code}: ${text}`);
    err.status = code;
    throw err;
  }

  const parsed = safeJsonParse(text);
  if (!parsed.ok) throw new Error('LLM response was not valid JSON');

  const content = parsed.value?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('LLM response missing message content');

  return content;
}

function mockResponse(messages) {
  const joined = messages.map((m) => String(m.content || '')).join('\n');
  const lower = joined.toLowerCase();

  let analysis = 'This alert indicates suspicious activity that warrants investigation.';
  if (lower.includes('brute_force')) {
    analysis = 'This alert indicates a possible brute force login attack.';
  } else if (lower.includes('malicious_ip_activity') || lower.includes('malicious ip')) {
    analysis = 'This alert indicates activity originating from a known malicious IP.';
  } else if (lower.includes('exfiltration')) {
    analysis = 'This alert indicates potential data exfiltration.';
  } else if (lower.includes('privilege_escalation')) {
    analysis = 'This alert indicates a possible privilege escalation attempt.';
  }

  const evidence = [];
  if (lower.includes('event_count')) evidence.push('Multiple related events were grouped into this alert');
  if (lower.includes('source_ip') || lower.includes('ip')) evidence.push('Source IP triggered the detection');
  if (lower.includes('actor')) evidence.push('Actor context was present in the alert');
  if (!evidence.length) evidence.push('Evidence is based on alert explanations and metadata');

  const recommended_actions = [
    'Review the alert evidence and related logs',
    'Block or rate-limit the source IP if malicious',
    'Enable MFA on affected accounts where applicable',
    'Reset or rotate credentials for impacted users',
  ];

  return {
    analysis,
    evidence,
    recommended_actions,
  };
}

export function buildSocMessages(safeAlert) {
  const system =
    'You are a cybersecurity SOC analyst. Analyze this alert and explain what it means, evidence supporting it, and recommended mitigation steps.';

  const user = [
    'Return ONLY valid JSON with this exact shape:',
    '{"analysis":"...","evidence":["..."],"recommended_actions":["..."]}',
    '',
    'Use only the provided alert fields. Do not invent facts. Do not include credentials, secrets, or tokens.',
    '',
    'ALERT:',
    JSON.stringify(safeAlert, null, 2),
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export async function generateCopilotResponse(messages) {
  const provider = resolveProvider();

  try {
    if (provider === 'openai') {
      return await callChatCompletions({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: getEnv('OPENAI_API_KEY'),
        model: getEnv('OPENAI_MODEL') || 'gpt-4o-mini',
        messages,
      });
    }

    if (provider === 'groq') {
      return await callChatCompletions({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: getEnv('GROQ_API_KEY'),
        model: getEnv('GROQ_MODEL') || 'llama3-70b-8192',
        messages,
      });
    }

    return JSON.stringify(mockResponse(messages));
  } catch {
    // Any external API error (401/429/network/etc.) should never break the Copilot UI.
    return JSON.stringify(mockResponse(messages));
  }
}
