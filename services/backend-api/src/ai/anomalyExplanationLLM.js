import { z } from 'zod';

import { generateCopilotResponse } from '../lib/llm.js';

const LlmExplanationSchema = z
  .object({
    summary: z.string().min(1),
    root_cause: z.string().min(1),
    impact: z.string().min(1),
    recommendation: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict();

function buildAnomalyMessages(metrics, anomaly) {
  const system =
    'You are a senior SOC analyst. Explain the anomaly in concise, factual, human-readable language. Use only the provided data; do not invent IPs, users, services, or incidents.';

  const user = [
    'Return ONLY valid JSON with this exact shape:',
    '{"summary":"","root_cause":"","impact":"","recommendation":"","confidence":0.0}',
    '',
    'Guidelines:',
    '- Write like a SOC analyst explaining what happened and why.',
    '- Tie reasoning to the metrics and anomaly fields provided.',
    '- If multiple hypotheses exist, pick the most likely and note uncertainty in confidence.',
    '- Keep confidence between 0 and 1.',
    '',
    'ANOMALY:',
    JSON.stringify(
      {
        id: String(anomaly?._id ?? ''),
        type: anomaly?.type ?? null,
        severity: anomaly?.severity ?? null,
        score: typeof anomaly?.score === 'number' ? anomaly.score : null,
        createdAt: anomaly?.createdAt ?? null,
        reason: anomaly?.reason ?? null,
        metadata: anomaly?.metadata ?? {},
      },
      null,
      2
    ),
    '',
    'METRICS (same minute):',
    JSON.stringify(
      {
        timestamp_minute: metrics?.timestamp_minute ?? null,
        requests: metrics?.requests ?? null,
        error_rate: metrics?.error_rate ?? null,
        avg_latency: metrics?.avg_latency ?? null,
        unique_ips: metrics?.unique_ips ?? null,
      },
      null,
      2
    ),
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export async function generateLLMExplanation(metrics, anomaly) {
  const messages = buildAnomalyMessages(metrics, anomaly);
  const raw = await generateCopilotResponse(messages);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('llm_invalid_json');
  }

  const validated = LlmExplanationSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error('llm_invalid_shape');
  }

  return validated.data;
}
