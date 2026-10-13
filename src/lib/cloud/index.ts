// Picks the online service: the test stand-in (?testcloud=1), Firebase when configured, or none.
// Inside claude.ai the page can't use Google sign-in, so cloud features stay off there.
import { createFirebaseBackend } from './firebaseBackend';
import { createTestBackend } from './testBackend';
import type { Backend } from './types';

let chosen: Backend | null | undefined;

export function getBackend(): Backend | null {
  if (chosen !== undefined) return chosen;
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('testcloud') === '1') sessionStorage.setItem('m2p:testcloud-on', '1');
    if (params.get('testcloud') === '0') sessionStorage.removeItem('m2p:testcloud-on');
    if (sessionStorage.getItem('m2p:testcloud-on') === '1') return (chosen = createTestBackend());
  } catch {
    /* storage blocked */
  }
  if (typeof window !== 'undefined' && window.claude) return (chosen = null);
  return (chosen = createFirebaseBackend());
}

export * from './types';
