// The app's AI requests go through here so the Gemini API key never reaches the browser.
// Only people signed in to Mood2Party (Firebase Google sign-in) can use it, with a daily limit per person.
import { verifyIdToken } from './firebaseToken';

export interface Env {
  GEMINI_API_KEY?: string; // secret: Cloudflare Pages > Settings > Variables and secrets
  FIREBASE_PROJECT_ID?: string; // e.g. mood2party-1234
  GEMINI_MODEL?: string; // optional override; default below
  AI_DAILY_LIMIT?: string; // optional, requests per person per day (default 60)
  AI_USAGE?: KvLike; // optional KV namespace binding for the daily limit
}
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const MAX_PROMPT = 20_000; // characters
const MAX_IMAGE_B64 = 8_000_000; // about 6 MB of image data
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

interface AiRequest {
  prompt?: unknown;
  json?: unknown;
  images?: unknown;
}

export async function handleHealth(env: Env): Promise<Response> {
  return json({ ok: true, ai: !!env.GEMINI_API_KEY && !!env.FIREBASE_PROJECT_ID, provider: 'gemini', model: env.GEMINI_MODEL || DEFAULT_MODEL });
}

export async function handleAi(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!env.GEMINI_API_KEY || !env.FIREBASE_PROJECT_ID) return fail(503, 'not_configured', 'The AI is not set up on this site yet.');

  // Same-site requests only
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return fail(403, 'forbidden', 'Requests must come from this site.');

  // Signed-in users only
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'not_signed_in', 'Sign in to use the AI.');
  let uid: string;
  try {
    uid = (await verifyIdToken(token, env.FIREBASE_PROJECT_ID, fetchImpl)).uid;
  } catch {
    return fail(401, 'not_signed_in', 'Your sign-in has expired. Sign in again to use the AI.');
  }

  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return fail(400, 'bad_request', 'The request could not be read.');
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) return fail(400, 'bad_request', 'Nothing to ask.');
  if (prompt.length > MAX_PROMPT) return fail(413, 'too_large', 'That request is too long.');
  const images = Array.isArray(body.images) ? body.images.slice(0, 1) : [];
  for (const im of images as { mimeType?: unknown; data?: unknown }[]) {
    if (typeof im?.data !== 'string' || typeof im.mimeType !== 'string' || !IMAGE_TYPES.includes(im.mimeType)) return fail(400, 'image_rejected', 'Use a JPG, PNG or WebP image.');
    if (im.data.length > MAX_IMAGE_B64) return fail(413, 'image_rejected', 'That image is too large.');
  }

  // Daily limit per person (only when a KV namespace is connected)
  const limit = Math.max(1, Number(env.AI_DAILY_LIMIT) || 60);
  const dayKey = `${uid}:${new Date().toISOString().slice(0, 10)}`;
  let used = 0;
  if (env.AI_USAGE) {
    used = Number(await env.AI_USAGE.get(dayKey)) || 0;
    if (used >= limit) return fail(429, 'rate_limited', `You have used the AI ${limit} times today. It resets tomorrow.`);
  }

  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const parts: unknown[] = [{ text: prompt }];
  for (const im of images as { mimeType: string; data: string }[]) parts.push({ inline_data: { mime_type: im.mimeType, data: im.data } });
  const geminiBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048, ...(body.json === true ? { responseMimeType: 'application/json' } : {}) },
  };

  let res: Response;
  try {
    res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
  } catch {
    return fail(502, 'upstream_error', 'Could not reach the AI service.');
  }
  if (res.status === 429) return fail(429, 'rate_limited', 'The AI is busy right now (free daily limit reached). Try again later.');
  if (!res.ok) return fail(502, 'upstream_error', `The AI service returned an error (${res.status}).`);

  const out = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } };
  const cand = out.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) {
    const blocked = out.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY';
    return fail(422, blocked ? 'blocked' : 'empty', blocked ? 'The AI declined this request.' : 'The AI gave an empty answer. Try again.');
  }

  if (env.AI_USAGE) await env.AI_USAGE.put(dayKey, String(used + 1), { expirationTtl: 2 * 24 * 3600 });
  return json({ text, truncated: cand?.finishReason === 'MAX_TOKENS' });
}
