// Optional AI features. Everything works without them: when no AI is available, the buttons stay hidden
// and the built-in rules are used.
//  - Inside claude.ai the page asks Claude directly (the viewer's own Claude account).
//  - On the public site (Cloudflare Pages) it asks Gemini through /api/ai, which holds the API key and
//    only answers people who are signed in with Google.
import { getBackend } from './cloud';

type SampleOpts = Record<string, unknown> & { images?: Blob | Blob[]; signal?: AbortSignal; onText?: (p: { text: string; delta: string }) => void };
type SampleFn = ((input: string, opts?: SampleOpts) => Promise<{ text: string }>) & {
  json: <T>(input: string, opts?: SampleOpts) => Promise<T>;
  limits: () => Promise<{ images?: { maxCount: number; mediaTypes: string[] } }>;
};

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<unknown> };
  }
}

export type AiProvider = 'claude' | 'gemini';
let provider: AiProvider | null = null;
/** What to call the AI in buttons and messages. */
export const aiName = () => (provider === 'claude' ? 'Claude' : 'AI');

let claudePromise: Promise<SampleFn | null> | null = null;
function claudeSample(): Promise<SampleFn | null> {
  if (!claudePromise) {
    claudePromise = (async () => {
      try {
        if (!window.claude?.use) return null;
        return ((await window.claude.use('sample')) as SampleFn | null) ?? null;
      } catch {
        return null;
      }
    })();
  }
  return claudePromise;
}

let healthPromise: Promise<boolean> | null = null;
/** Is the AI set up on this site? (GET /api/ai answers only on Cloudflare Pages with the key in place.) */
export function aiServerReady(): Promise<boolean> {
  if (!healthPromise) {
    healthPromise = fetch('/api/ai', { method: 'GET', headers: { accept: 'application/json' } })
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
      .then((j) => !!j?.ai)
      .catch(() => false);
  }
  return healthPromise;
}

/** True when signing in would turn the AI on (public site, AI set up, nobody signed in). */
export async function aiNeedsSignIn(): Promise<boolean> {
  if (await claudeSample()) return false;
  const backend = getBackend();
  if (!backend || !(await aiServerReady())) return false;
  return !(await backend.idToken());
}

export async function getSample(): Promise<SampleFn | null> {
  const claude = await claudeSample();
  if (claude) {
    provider = 'claude';
    return claude;
  }
  const backend = getBackend();
  if (!backend || !(await aiServerReady()) || !(await backend.idToken())) return null;
  provider = 'gemini';
  return geminiSample();
}

/** Makes photos small enough to send quickly (longest side 1600 px, JPEG). */
async function toImagePart(blob: Blob): Promise<{ mimeType: string; data: string }> {
  let out: Blob = blob;
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (scale < 1 || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      out = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85));
    }
  } catch {
    /* send as is */
  }
  const buf = new Uint8Array(await out.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { mimeType: out.type || 'image/jpeg', data: btoa(bin) };
}

function geminiSample(): SampleFn {
  const call = async (input: string, opts: SampleOpts | undefined, json: boolean) => {
    const token = await getBackend()?.idToken();
    if (!token) throw { code: 'not_signed_in', message: 'Sign in with Google to use AI help.' };
    const blobs = opts?.images ? (Array.isArray(opts.images) ? opts.images : [opts.images]) : [];
    const images = await Promise.all(blobs.slice(0, 1).map(toImagePart));
    let res: Response;
    try {
      res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: input, json, images }),
        signal: opts?.signal,
      });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') throw { code: 'cancelled' };
      throw { code: 'upstream_error', message: 'Could not reach the AI. Check your connection and try again.' };
    }
    const body = (await res.json().catch(() => ({}))) as { text?: string; error?: { code?: string; message?: string } };
    if (!res.ok || typeof body.text !== 'string') throw { code: body.error?.code ?? 'upstream_error', message: body.error?.message };
    return body.text;
  };
  const fn = (async (input: string, opts?: SampleOpts) => {
    const text = await call(input, opts, false);
    opts?.onText?.({ text, delta: text });
    return { text };
  }) as SampleFn;
  fn.json = async <T,>(input: string, opts?: SampleOpts) => {
    const text = await call(input, opts, true);
    try {
      return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
    } catch {
      throw { code: 'invalid_json' };
    }
  };
  fn.limits = async () => ({ images: { maxCount: 1, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] } });
  return fn;
}

export interface AIError {
  code: string;
  message?: string;
}

export function aiErrorCopy(e: unknown): { text: string; hide: boolean } {
  const err = (e ?? {}) as AIError;
  const code = err.code ?? 'upstream_error';
  const name = aiName();
  if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'not_configured'].includes(code))
    return { text: `${name} is not available here, so Mood2Party used its built-in rules instead.`, hide: true };
  if (code === 'not_signed_in') return { text: err.message ?? 'Sign in with Google to use AI help.', hide: false };
  if (code === 'rate_limited') return { text: err.message ?? 'Too many requests right now. Try again in a minute.', hide: false };
  if (code === 'cancelled') return { text: '', hide: false };
  if (code === 'invalid_json') return { text: `${name} replied in an unexpected format. Try again.`, hide: false };
  if (code === 'image_rejected') return { text: err.message ?? 'That image could not be read. Try a JPG or PNG under 20 MB.', hide: false };
  if (code === 'blocked' || code === 'empty' || code === 'too_large') return { text: err.message ?? `${name} could not answer that. Try again.`, hide: false };
  return { text: err.message ?? `Something went wrong reaching ${name}. Try again.`, hide: false };
}
