// Verifies a Firebase sign-in token (an ID token) without any extra libraries, using the browser-standard Web Crypto API.
// Google signs these tokens; its public keys are published at the URL below and change every few hours.

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface Jwk extends JsonWebKey { kid: string }
let cache: { keys: Jwk[]; until: number } | null = null;

async function publicKeys(fetchImpl: typeof fetch): Promise<Jwk[]> {
  if (cache && cache.until > Date.now()) return cache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw new Error(`Could not load Google's public keys (${res.status})`);
  const body = (await res.json()) as { keys: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  cache = { keys: body.keys, until: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 };
  return body.keys;
}

const b64urlToBytes = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

export interface VerifiedUser { uid: string; email?: string; name?: string }

/** Returns the signed-in user, or throws with a short reason. */
export async function verifyIdToken(token: string, projectId: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<VerifiedUser> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [h, p, sig] = parts;
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unexpected token type');
  const t = Math.floor(now / 1000);
  if (payload.aud !== projectId) throw new Error('Token is for a different project');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token has the wrong issuer');
  if (typeof payload.exp !== 'number' || payload.exp <= t) throw new Error('Token expired');
  if (typeof payload.iat !== 'number' || payload.iat > t + 300) throw new Error('Token issued in the future');
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new Error('Token has no user');

  let jwk = (await publicKeys(fetchImpl)).find((k) => k.kid === header.kid);
  if (!jwk) {
    cache = null; // keys may have rotated
    jwk = (await publicKeys(fetchImpl)).find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('Unknown signing key');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('Bad signature');
  return { uid: payload.sub, email: payload.email, name: payload.name };
}

/** For tests only. */
export function _resetKeyCache() { cache = null; }
