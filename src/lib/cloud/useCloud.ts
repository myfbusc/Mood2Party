// Keeps the open event in step with the account: uploads changes, merges changes from other people,
// lists the account's events, and handles signing in and out.
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { AppState } from '../types';
import { getBackend, newInviteCode, type CloudUser, type EventMeta, type JoinError, type RemoteEvent, type RsvpPage, type RsvpReply, type SyncStatus } from './index';
import { diff, join, merge, split, summary } from './sync';

export interface CloudApi {
  available: boolean; // false inside claude.ai or when Firebase isn't set up
  ready: boolean; // sign-in state known
  user: CloudUser | null;
  status: SyncStatus;
  metas: EventMeta[];
  metasLoaded: boolean;
  /** Events that were on this device before signing in and are not in the account yet. */
  deviceOnlyIds: string[];
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  upload: (s: AppState) => Promise<void>;
  load: (id: string, personal: Pick<AppState, 'learnings' | 'onboarding'>) => Promise<AppState | null>;
  remove: (id: string) => Promise<void>;
  dismissDeviceOnly: (ids: string[]) => void;
  idToken: () => Promise<string | null>;
  /** Host: turn the invite link on (with a new code) or off. Returns the new code, or null. */
  setInvite: (eventId: string, on: boolean) => Promise<string | null>;
  /** Join someone's event with an invite code. */
  joinEvent: (eventId: string, code: string) => Promise<'ok' | JoinError>;
  /** Host removes a co-host, or you leave (your own id). */
  removeMember: (eventId: string, uid: string) => Promise<boolean>;
  /** Events you had in your account this visit but no longer have access to (removed, or deleted by the host). */
  lostIds: string[];
  ackLost: (id: string) => void;
  /** RSVP link for the open party: turn on (new code) or off. Returns the code or null. */
  setRsvp: (on: boolean) => Promise<string | null>;
  /** Replies from the RSVP page for the open party, by reply id */
  replies: Record<string, RsvpReply>;
}

/** The party details a guest sees on the RSVP page. */
export function rsvpPageFrom(s: AppState, hostName: string): RsvpPage {
  return {
    eventId: s.eventId ?? '', name: s.event.name, date: s.event.date, startTime: s.event.startTime,
    durationHrs: s.event.durationHrs, venue: s.event.venue, deadline: s.event.rsvpDeadline, hostName,
  };
}

interface Args {
  s: AppState;
  latest: MutableRefObject<AppState>;
  setS: (s: AppState) => void;
  localIds: string[];
}

export function useCloud({ s, latest, setS, localIds }: Args): CloudApi {
  const backend = useMemo(getBackend, []);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [ready, setReady] = useState(!backend);
  const [metas, setMetas] = useState<EventMeta[]>([]);
  const [metasLoaded, setMetasLoaded] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(backend ? 'signed-out' : 'off');
  const [deviceOnlyIds, setDeviceOnlyIds] = useState<string[]>([]);
  const base = useRef<RemoteEvent | null>(null);
  const creating = useRef(new Set<string>());
  const askedFor = useRef<string | null>(null); // user id the "events only on this device" list was made for
  const seenInCloud = useRef(new Set<string>()); // events this account had during this visit
  const [lostIds, setLostIds] = useState<string[]>([]);

  // Sign-in state
  useEffect(() => {
    if (!backend) return;
    return backend.onUser((u) => {
      setUser(u);
      setReady(true);
      setStatus(u ? 'saved' : 'signed-out');
      if (!u) { setMetas([]); setMetasLoaded(false); setDeviceOnlyIds([]); askedFor.current = null; seenInCloud.current = new Set(); }
    });
  }, [backend]);

  // The account's events
  useEffect(() => {
    if (!backend || !user) return;
    return backend.watchEvents(
      user.uid,
      (list) => {
        const now = new Set(list.map((m) => m.id));
        const gone = [...seenInCloud.current].filter((id) => !now.has(id));
        if (gone.length) setLostIds((cur) => [...new Set([...cur, ...gone])]);
        seenInCloud.current = now;
        setMetas(list);
        setMetasLoaded(true);
      },
      () => setStatus('error'),
    );
  }, [backend, user]);

  // Right after signing in: which events on this device are not in the account?
  useEffect(() => {
    if (!user || !metasLoaded || askedFor.current === user.uid) return;
    askedFor.current = user.uid;
    const cloud = new Set(metas.map((m) => m.id));
    setDeviceOnlyIds(localIds.filter((id) => !cloud.has(id)));
  }, [user, metasLoaded, metas, localIds]);

  // Personal learnings follow the person, stored with their account
  useEffect(() => {
    if (!backend || !user) return;
    let live = true;
    backend.loadProfile(user.uid).then((p) => {
      if (!live || !p?.learnings) return;
      try {
        const remote = JSON.parse(p.learnings) as AppState['learnings'];
        const cur = latest.current;
        if ((remote.history?.length ?? 0) > (cur.learnings.history?.length ?? 0)) setS({ ...cur, learnings: remote });
      } catch { /* ignore a damaged profile */ }
    }).catch(() => {});
    return () => { live = false; };
  }, [backend, user, latest, setS]);
  const learningsJson = JSON.stringify(s.learnings);
  useEffect(() => {
    if (!backend || !user || !s.learnings.history.length) return;
    const t = setTimeout(() => { backend.saveProfile(user.uid, { learnings: learningsJson }).catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [backend, user, learningsJson, s.learnings.history.length]);

  const evId = s.started && !s.isDemo ? s.eventId : undefined;
  const inCloud = !!evId && metas.some((m) => m.id === evId);

  // Follow the open event: merge what others change
  useEffect(() => {
    base.current = null;
    if (!backend || !user || !evId || !inCloud) return;
    return backend.watchEvent(
      evId,
      (remote) => {
        const cur = latest.current;
        if (cur.eventId !== evId) return;
        if (!remote.core) return; // deleted elsewhere
        if (!base.current) {
          // First copy from the account: it is the latest, so it replaces this device's copy if they differ.
          base.current = remote;
          if (diff(split(cur), remote)) {
            const next = join(remote, evId, cur);
            if (next) setS(next);
          }
          return;
        }
        const { merged, changed } = merge(base.current, split(cur), remote);
        base.current = remote;
        if (changed) {
          const next = join(merged, evId, cur);
          if (next) setS(next);
        }
      },
      () => setStatus('error'),
    );
  }, [backend, user, evId, inCloud, latest, setS]);

  // Save changes (shortly after they stop)
  useEffect(() => {
    if (!backend || !user || !evId || !inCloud) return;
    const t = setTimeout(async () => {
      const cur = latest.current;
      if (!base.current || cur.eventId !== evId) return;
      const ops = diff(base.current, split(cur));
      if (!ops) return;
      setStatus('saving');
      try {
        await backend.write(evId, user.uid, { ...ops, meta: summary(cur) });
        setStatus('saved');
      } catch {
        setStatus(navigator.onLine ? 'error' : 'offline');
      }
    }, 600);
    return () => clearTimeout(t);
  }, [backend, user, evId, inCloud, s, latest]);

  // Retry after coming back online
  useEffect(() => {
    const on = () => setStatus((st) => (st === 'offline' || st === 'error' ? 'saving' : st));
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, []);

  const upload = useCallback(async (state: AppState) => {
    if (!backend || !user || !state.eventId || state.isDemo || !state.started) return;
    if (creating.current.has(state.eventId)) return;
    creating.current.add(state.eventId);
    setStatus('saving');
    try {
      await backend.createEvent(state.eventId, user, split(state), summary(state));
      setStatus('saved');
    } catch {
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      creating.current.delete(state.eventId);
    }
  }, [backend, user]);

  // New events made while signed in go straight to the account
  useEffect(() => {
    if (!user || !metasLoaded || !evId || inCloud || askedFor.current !== user.uid) return;
    if (deviceOnlyIds.includes(evId)) return; // was here before signing in: the person decides
    if (lostIds.includes(evId)) return; // removed from it: never re-create someone else's event
    upload(latest.current);
  }, [user, metasLoaded, evId, inCloud, deviceOnlyIds, lostIds, upload, latest]);

  const signIn = useCallback(async () => {
    if (!backend) return false;
    try {
      await backend.signIn();
      return true;
    } catch {
      return false;
    }
  }, [backend]);
  const signOut = useCallback(async () => { if (backend) await backend.signOut(); }, [backend]);
  const load = useCallback(async (id: string, personal: Pick<AppState, 'learnings' | 'onboarding'>) => {
    if (!backend) return null;
    const remote = await backend.loadEvent(id);
    return remote ? join(remote, id, personal) : null;
  }, [backend]);
  const remove = useCallback(async (id: string) => {
    if (!backend || !user) return;
    const m = metas.find((x) => x.id === id);
    if (m && m.ownerId === user.uid) await backend.deleteEvent(id);
  }, [backend, user, metas]);
  const dismissDeviceOnly = useCallback((ids: string[]) => setDeviceOnlyIds((cur) => cur.filter((x) => !ids.includes(x))), []);
  const idToken = useCallback(async () => (backend ? backend.idToken() : null), [backend]);

  const setInvite = useCallback(async (eventId: string, on: boolean) => {
    if (!backend || !user) return null;
    const code = on ? newInviteCode() : null;
    await backend.setInviteCode(eventId, code);
    return code;
  }, [backend, user]);
  const joinEvent = useCallback(async (eventId: string, code: string): Promise<'ok' | JoinError> => {
    if (!backend || !user) return 'signed-out';
    if (metas.some((m) => m.id === eventId)) return 'ok'; // already in it
    try {
      await backend.joinEvent(eventId, code, user);
      setLostIds((cur) => cur.filter((x) => x !== eventId));
      return 'ok';
    } catch (e) {
      const c = String((e as { code?: string }).code ?? (e as Error).message ?? '');
      return /permission|not-found|denied/i.test(c) ? 'invalid' : 'network';
    }
  }, [backend, user, metas]);
  const removeMember = useCallback(async (eventId: string, uid: string) => {
    if (!backend || !user) return false;
    try {
      await backend.removeMember(eventId, uid);
      return true;
    } catch {
      return false;
    }
  }, [backend, user]);
  const ackLost = useCallback((id: string) => setLostIds((cur) => cur.filter((x) => x !== id)), []);

  // RSVP link: the code lives on the event, the guest page in its own public record
  const meta = evId ? metas.find((m) => m.id === evId) : undefined;
  const rsvpCode = meta?.rsvpCode ?? null;
  const hostName = meta?.members.find((m) => m.uid === meta.ownerId)?.name.split(/\s+/)[0] ?? user?.name.split(/\s+/)[0] ?? '';
  const setRsvp = useCallback(async (on: boolean) => {
    if (!backend || !user || !evId || !inCloud) return null;
    const code = on ? newInviteCode() : null;
    await backend.setRsvp(evId, code, code ? rsvpPageFrom(latest.current, hostName) : null, rsvpCode);
    return code;
  }, [backend, user, evId, inCloud, latest, hostName, rsvpCode]);
  // Keep the guest page's details (name, date, place, reply-by) in step with the plan
  const pageKey = JSON.stringify(rsvpPageFrom(s, hostName));
  useEffect(() => {
    if (!backend || !user || !rsvpCode || !evId) return;
    const t = setTimeout(() => { backend.updateRsvpPage(rsvpCode, JSON.parse(pageKey)).catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [backend, user, rsvpCode, evId, pageKey]);
  // Replies for the open party
  const [replies, setReplies] = useState<Record<string, RsvpReply>>({});
  useEffect(() => {
    setReplies({});
    if (!backend || !user || !evId || !inCloud) return;
    return backend.watchReplies(evId, setReplies, () => {});
  }, [backend, user, evId, inCloud]);

  return { available: !!backend, ready, user, status, metas, metasLoaded, deviceOnlyIds, signIn, signOut, upload, load, remove, dismissDeviceOnly, idToken, setInvite, joinEvent, removeMember, lostIds, ackLost, setRsvp, replies };
}
