import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { blankState, demoState } from './demo';
import { addHelper, applyRsvpReply, templateFrom, withBaseline } from './actions';
import { stateAttendance, stateHeadcount, type Attendance } from './attendance';
import { computePlan, sameHeadcount, type PlanTotals } from './plan';
import type { AppState, Category, Headcount, OnboardingAction } from './types';
import { useCloud, type CloudApi } from './cloud/useCloud';
import { isBlocked, isOverdue, todayISO } from './tasks';
import type { Role } from './cloud/types';

export type Theme = 'default' | 'midnight';
const THEME_KEY = 'mood2party:theme';

export type Page = 'welcome' | 'setup' | 'overview' | 'guests' | 'plan' | 'budget' | 'tasks' | 'wrapup';

export type Drawer =
  | { type: 'item'; id: string }
  | { type: 'add-item'; category?: Category; name?: string; unit?: string }
  | { type: 'vendor'; category?: Category }
  | { type: 'assign'; person: string }
  | { type: 'send'; person: string }
  | { type: 'optimize' }
  | { type: 'impact' }
  | { type: 'event' }
  | { type: 'guest'; id?: string }
  | { type: 'task'; id?: string }
  | { type: 'inspire' }
  | { type: 'cohosts' }
  | { type: 'rsvp' }
  | { type: 'reset' }
  | { type: 'events' }
  | { type: 'stores' };

/** One row in "Your Events": from this browser, from the account, or both. */
export interface EventSummary {
  id: string;
  name: string;
  date: string;
  updatedAt: number;
  tasksDone: number;
  tasksTotal: number;
  where: 'device' | 'cloud';
  role?: Role;
  isOwner: boolean;
  /** Fuller numbers, when the plan itself is in this browser */
  detail?: EventDetail;
}

export interface EventDetail {
  startTime: string;
  guests: number;
  itemsReady: number;
  itemsTotal: number;
  leftToSpend: number;
  overdue: number;
  blocked: number;
}

/** The numbers shown for a saved party on the homepage. */
export function eventDetail(st: AppState): EventDetail {
  const head = stateHeadcount(st);
  const plan = computePlan(st, head);
  const today = todayISO();
  return {
    startTime: st.event.startTime,
    guests: head.total,
    itemsReady: plan.counts.purchased + plan.counts.owned,
    itemsTotal: plan.counts.active,
    leftToSpend: plan.leftToSpend,
    overdue: st.tasks.filter((t) => isOverdue(t, today)).length,
    blocked: st.tasks.filter((t) => isBlocked(t)).length,
  };
}

/** One saved event in "Your Events" (kept in this browser). */
export interface SavedEvent {
  id: string;
  name: string;
  date: string;
  updatedAt: number;
  s: AppState;
}

export interface Toast {
  id: number;
  title: string;
  detail?: string;
  tone?: 'success' | 'info' | 'warn';
  /** Optional button on the message, such as Undo */
  action?: { label: string; run: () => void };
}

interface Ctx {
  s: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  replace: (s: AppState) => void;
  page: Page;
  go: (p: Page) => void;
  drawer: Drawer | null;
  open: (d: Drawer) => void;
  close: () => void;
  tour: number | null;
  startTour: () => void;
  setTour: (n: number | null) => void;
  markDid: (a: OnboardingAction) => void;
  theme: Theme;
  toggleTheme: () => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
  // derived, always from the same state
  att: Attendance;
  head: Headcount;
  plan: PlanTotals;
  changePending: boolean;
  // Your events: plans in this browser and, when signed in, in the account (not the sample party)
  events: EventSummary[];
  switchEvent: (id: string) => Promise<boolean>;
  duplicateEvent: (id: string) => Promise<void>;
  deleteEvent: (id: string) => Promise<boolean>;
  snapshotEvents: (ids: string[]) => Promise<AppState[]>;
  restoreEvents: (states: AppState[]) => Promise<void>;
  clearAllEvents: () => void;
  // Account (Google sign-in) and saving
  cloud: CloudApi;
  signOut: () => Promise<void>;
  saveDeviceEventsToAccount: () => Promise<number>;
  deviceBannerHidden: boolean;
  hideDeviceBanner: () => void;
  /** An invite link this visit was opened with, waiting to be accepted */
  invite: Invite | null;
  acceptInvite: () => Promise<void>;
  dismissInvite: () => void;
}

/** From a link like ?join=<eventId>.<code>&n=<party name> */
export interface Invite { eventId: string; code: string; name: string; busy?: boolean; error?: string }
const INVITE_KEY = 'm2p:invite';
function readInvite(): Invite | null {
  try {
    const p = new URLSearchParams(location.search);
    const raw = p.get('join');
    if (raw && /^[\w-]+\.[a-z0-9]{6,40}$/i.test(raw)) {
      const [eventId, code] = raw.split('.');
      const inv = { eventId, code, name: (p.get('n') ?? '').slice(0, 80) };
      sessionStorage.setItem(INVITE_KEY, JSON.stringify(inv));
      // Keep the address clean (and the code out of the history) once it's been read
      p.delete('join');
      p.delete('n');
      history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}${location.hash}`);
      return inv;
    }
    const kept = sessionStorage.getItem(INVITE_KEY); // survives a full-page Google sign-in
    return kept ? (JSON.parse(kept) as Invite) : null;
  } catch {
    return null;
  }
}

const StoreCtx = createContext<Ctx | null>(null);
// In test mode (?testcloud=1) each tab keeps its own copy, so two tabs can act as two devices.
const tabSuffix = (() => {
  try {
    if (new URLSearchParams(location.search).get('testcloud') === '1' || sessionStorage.getItem('m2p:testcloud-on') === '1') {
      let id = sessionStorage.getItem('m2p:tab');
      if (!id) { id = Math.random().toString(36).slice(2, 8); sessionStorage.setItem('m2p:tab', id); }
      return `:test-${id}`;
    }
  } catch {
    /* storage blocked */
  }
  return '';
})();
const KEY = `mood2party:v1${tabSuffix}`;
const LIB_KEY = `mood2party:events${tabSuffix}`;

function loadLibrary(): Record<string, SavedEvent> {
  try {
    const raw = localStorage.getItem(LIB_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Learnings and onboarding belong to the person, not to one event, so they follow you when you switch. */
function carryOver(target: AppState, from: AppState): AppState {
  const learnings = (from.learnings?.history?.length ?? 0) >= (target.learnings?.history?.length ?? 0) ? from.learnings : target.learnings;
  return {
    ...target,
    learnings,
    onboarding: { ...target.onboarding, introSeen: from.onboarding.introSeen || target.onboarding.introSeen, tourDone: from.onboarding.tourDone || target.onboarding.tourDone },
  };
}

/** "Maybe" and "No reply" became one "Not sure yet" status with a single turnout share. */
function mergeNotSure<T extends Pick<AppState, 'guests' | 'weights'>>(s: T): T {
  const guests = Array.isArray(s.guests) ? s.guests.map((g) => (g.status === 'unresponsive' ? { ...g, status: 'maybe' as const } : g)) : s.guests;
  let weights = s.weights;
  if (weights && weights.unresponsive !== weights.maybe) {
    const old = weights.maybe === 0.6 && weights.unresponsive === 0.3;
    const w = old ? 0.45 : Math.round(((weights.maybe + weights.unresponsive) / 2) * 100) / 100;
    weights = { maybe: w, unresponsive: w };
  }
  return { ...s, guests, weights };
}

function load(): { s: AppState; page: Page } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.s?.version === 1 && Array.isArray(parsed.s.items)) {
      const s = { appliedFactors: {}, onboarding: { introSeen: false, tourDone: false, checklistHidden: false, did: {} }, ...parsed.s };
      const o = s.onboarding;
      // Earlier versions hid the checklist outright; if it was not finished, show it minimized instead.
      if (o.checklistHidden && !s.learnings?.history?.length && Object.values(o.did ?? {}).filter(Boolean).length < 5)
        s.onboarding = { ...o, checklistHidden: false, checklistCollapsed: true };
      // Earlier versions had a third "recommended" level; it now counts as essential.
      s.items = s.items.map((it: { priority: string }) => (it.priority === 'optional' ? it : { ...it, priority: 'essential' }));
      // "Maybe" and "No reply" were merged into one "Not sure yet" status.
      Object.assign(s, mergeNotSure(s));
      // Plans saved before "Your Events" existed get an id so they can be listed and switched to.
      if (s.started && !s.isDemo && !s.eventId) s.eventId = `event-${Date.now().toString(36)}`;
      return { ...parsed, s };
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const saved = useMemo(load, []);
  const [s, setS] = useState<AppState>(() => saved?.s ?? blankState());
  // Every visit (new tab, refresh) opens on the homepage; a saved plan is offered there via "Continue Planning".
  const [page, setPage] = useState<Page>('welcome');
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tour, setTour] = useState<number | null>(null);
  const [library, setLibrary] = useState<Record<string, SavedEvent>>(loadLibrary);
  const libRef = useRef(library);
  libRef.current = library;
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'midnight' ? 'midnight' : 'default';
    } catch {
      return 'default';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'midnight') root.dataset.theme = 'midnight';
    else delete root.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* the theme still applies for this visit */
    }
  }, [theme]);
  const tid = useRef(1);

  const latest = useRef(s);
  latest.current = s;
  // Keep the current plan's copy in "Your Events" up to date
  useEffect(() => {
    if (!s.started || s.isDemo || !s.eventId) return;
    const id = s.eventId;
    setLibrary((l) => ({ ...l, [id]: { id, name: s.event.name, date: s.event.date, updatedAt: Date.now(), s } }));
  }, [s]);

  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ s: latest.current, page: 'welcome' }));
        localStorage.setItem(LIB_KEY, JSON.stringify(libRef.current));
      } catch {
        /* storage unavailable: the app still works for this session */
      }
    };
    const t = setTimeout(save, 250);
    // Save right away if the page is closed or hidden before the short delay ends
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', save);
    };
  }, [s, library]);

  // A started plan always has a baseline to compare changes against.
  useEffect(() => {
    if (s.started && !s.baseline) setS((p) => withBaseline(p));
  }, [s.started, s.baseline]);

  const update = useCallback((fn: (s: AppState) => AppState) => setS((p) => fn(p)), []);
  const replace = useCallback((n: AppState) => setS(n), []);
  const go = useCallback((p: Page) => {
    setDrawer(null);
    setPage(p);
    if (p === 'guests' || p === 'plan') {
      const key = p === 'guests' ? 'guests' : 'shopping';
      setS((x) => (x.onboarding?.did[key] ? x : { ...x, onboarding: { ...x.onboarding, did: { ...x.onboarding.did, [key]: true } } }));
    }
    window.scrollTo({ top: 0 });
  }, []);
  const markDid = useCallback((a: OnboardingAction) => {
    setS((x) => (x.onboarding.did[a] ? x : { ...x, onboarding: { ...x.onboarding, did: { ...x.onboarding.did, [a]: true } } }));
  }, []);
  const startTour = useCallback(() => {
    setDrawer(null);
    setS((x) => {
      // New visitors tour the sample party; people with their own plan tour their plan.
      const base = !x.started ? withBaseline(demoState(x.learnings)) : x;
      return { ...base, onboarding: { ...base.onboarding, introSeen: true, tourDone: false, tourCompleted: false } };
    });
    setTour(0);
  }, []);
  // Browsers often resume a page instead of reloading it (reopened tab, back button,
  // switching apps on a phone). Treat those like a fresh visit: back to the homepage.
  useEffect(() => {
    const AWAY_MS = 15 * 60 * 1000;
    let hiddenAt = 0;
    const home = () => {
      setTour(null);
      setDrawer(null);
      setPage('welcome');
      window.scrollTo({ top: 0 });
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) home();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) home();
    };
    window.addEventListener('pageshow', onShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const open = useCallback((d: Drawer) => setDrawer(d), []);
  const close = useCallback(() => setDrawer(null), []);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'midnight' ? 'default' : 'midnight')), []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = tid.current++;
    setToasts((all) => [...all.slice(-1), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.action ? 5000 : 4500);
  }, []);

  const cloud = useCloud({ s, latest, setS, localIds: useMemo(() => Object.keys(library), [library]) });
  const cloudRef = useRef(cloud);
  cloudRef.current = cloud;
  const [deviceBannerHidden, setDeviceBannerHidden] = useState(false);

  const events = useMemo(() => {
    const done = (st: AppState) => st.tasks.filter((t) => t.status === 'done').length;
    const out = new Map<string, EventSummary>();
    for (const e of Object.values(library)) {
      out.set(e.id, { id: e.id, name: e.name, date: e.date, updatedAt: e.updatedAt, tasksDone: done(e.s), tasksTotal: e.s.tasks.length, where: 'device', isOwner: true, detail: eventDetail(e.s) });
    }
    if (cloud.user) {
      for (const m of cloud.metas) {
        const local = library[m.id];
        out.set(m.id, {
          id: m.id, name: local?.name ?? m.name, date: local?.date ?? m.date, updatedAt: Math.max(m.updatedAt, local?.updatedAt ?? 0),
          tasksDone: local ? done(local.s) : m.tasksDone, tasksTotal: local ? local.s.tasks.length : m.tasksTotal,
          where: 'cloud', role: m.role, isOwner: m.ownerId === cloud.user.uid, detail: local ? eventDetail(local.s) : undefined,
        });
      }
    }
    return [...out.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [library, cloud.metas, cloud.user]);

  const loadState = useCallback(async (id: string): Promise<AppState | null> => {
    const local = libRef.current[id];
    if (local) return local.s;
    const cur = latest.current;
    return cloudRef.current.load(id, { learnings: cur.learnings, onboarding: cur.onboarding });
  }, []);

  const switchEvent = useCallback(async (id: string) => {
    const target = await loadState(id);
    if (!target) return false;
    setS((cur) => carryOver(mergeNotSure(target), cur));
    setDrawer(null);
    setTour(null);
    setPage('overview');
    window.scrollTo({ top: 0 });
    return true;
  }, [loadState]);
  const duplicateEvent = useCallback(async (id: string) => {
    const c = cloudRef.current;
    if (c.available && !c.user) {
      setToasts((all) => [...all.slice(-1), { id: tid.current++, title: 'Sign in to make a copy', detail: 'New parties are saved to your Google account.', tone: 'info' as const }]);
      return;
    }
    const src = await loadState(id);
    if (!src) return;
    setS((cur) => carryOver(templateFrom(src), cur));
    setTour(null);
    setPage('overview');
    setDrawer({ type: 'event' }); // straight to name and date for the copy
    window.scrollTo({ top: 0 });
  }, [loadState]);
  const leftOnPurpose = useRef(new Set<string>()); // deleted or left here, so no "removed" message
  // Deletes still being sent to the account: leaving the page now would cut them off, so the browser asks first
  const sending = useRef(0);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (sending.current > 0) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  /** Removes a party right away: deleted for the host, left for a co-host. Done once this resolves. */
  const deleteEvent = useCallback(async (id: string) => {
    const c = cloudRef.current;
    leftOnPurpose.current.add(id);
    const m = c.metas.find((x) => x.id === id);
    setLibrary((l) => {
      const next = { ...l };
      delete next[id];
      try {
        localStorage.setItem(LIB_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
    setS((cur) => (cur.eventId === id ? { ...blankState(cur.learnings), onboarding: { ...cur.onboarding, tourCompleted: false } } : cur));
    if (!m || !c.user) return true; // only in this browser: already gone
    sending.current++;
    try {
      if (m.ownerId !== c.user.uid) return await c.removeMember(id, c.user.uid); // a co-host leaves
      await c.remove(id);
      return true;
    } catch {
      return false;
    } finally {
      sending.current--;
    }
  }, []);
  /** Copies of parties taken just before deleting, so Undo can put them back. */
  const snapshotEvents = useCallback(async (ids: string[]) => (await Promise.all(ids.map((id) => loadState(id)))).filter((x): x is AppState => !!x), [loadState]);
  /** Undo: puts deleted parties back in this browser and, when signed in, in the account. */
  const restoring = useRef(new Set<string>()); // put back by Undo: not "lost" if the account catches up late
  const restoreEvents = useCallback(async (states: AppState[]) => {
    const ids = states.map((st) => st.eventId).filter((x): x is string => !!x);
    ids.forEach((id) => restoring.current.add(id));
    setTimeout(() => ids.forEach((id) => restoring.current.delete(id)), 15000);
    setLibrary((l) => {
      const next = { ...l };
      for (const st of states) if (st.eventId) next[st.eventId] = { id: st.eventId, name: st.event.name, date: st.event.date, updatedAt: Date.now(), s: st };
      try { localStorage.setItem(LIB_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
    const c = cloudRef.current;
    if (!c.user) return;
    sending.current++;
    try {
      for (const st of states) await c.upload(st);
    } finally {
      sending.current--;
    }
  }, []);
  const clearAllEvents = useCallback(() => {
    setLibrary({});
    try {
      localStorage.removeItem(LIB_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  /** Signing out removes this account's events from this browser (they stay in the account). */
  const signOut = useCallback(async () => {
    const ids = new Set(cloudRef.current.metas.map((m) => m.id));
    setLibrary((l) => {
      const next = Object.fromEntries(Object.entries(l).filter(([id]) => !ids.has(id)));
      try {
        localStorage.setItem(LIB_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
    setS((cur) => (cur.eventId && ids.has(cur.eventId) ? { ...blankState(cur.learnings), onboarding: { ...cur.onboarding, tourCompleted: false } } : cur));
    setDrawer(null);
    setPage('welcome');
    await cloudRef.current.signOut();
  }, []);
  const saveDeviceEventsToAccount = useCallback(async () => {
    const c = cloudRef.current;
    const ids = [...c.deviceOnlyIds];
    for (const id of ids) {
      const st = latest.current.eventId === id ? latest.current : libRef.current[id]?.s;
      if (st) await c.upload(st);
    }
    c.dismissDeviceOnly(ids);
    return ids.length;
  }, []);
  const hideDeviceBanner = useCallback(() => setDeviceBannerHidden(true), []);

  // Joining someone's party from an invite link
  const [invite, setInvite] = useState<Invite | null>(readInvite);
  const dismissInvite = useCallback(() => {
    try { sessionStorage.removeItem(INVITE_KEY); } catch { /* fine */ }
    setInvite(null);
  }, []);
  const acceptInvite = useCallback(async () => {
    const inv = invite;
    if (!inv) return;
    const c = cloudRef.current;
    setInvite({ ...inv, busy: true, error: undefined });
    if (!c.user && !(await c.signIn())) { setInvite({ ...inv, busy: false }); return; }
  }, [invite]);
  // Once signed in, join and open the party
  const joiningRef = useRef(false);
  useEffect(() => {
    const c = cloud;
    if (!invite?.busy || !c.user || !c.metasLoaded || joiningRef.current) return;
    joiningRef.current = true;
    (async () => {
      const r = await c.joinEvent(invite.eventId, invite.code);
      if (r !== 'ok') {
        setInvite({ ...invite, busy: false, error: r === 'invalid' ? 'This invite link no longer works. Ask the host to send you a new one.' : "Couldn't join right now. Check your connection and try again." });
        joiningRef.current = false;
        return;
      }
      try { sessionStorage.removeItem(INVITE_KEY); } catch { /* fine */ }
      setInvite(null);
      const ok = await switchEvent(invite.eventId);
      joiningRef.current = false;
      if (!ok) return;
      // Co-hosts can be given tasks and purchases right away. Wait for the account's copy to arrive first,
      // or it would replace this change before it is saved.
      const first = c.user!.name.split(/\s+/)[0];
      const addSelf = () => setS((cur) => (cur.eventId === invite.eventId && first && !cur.event.helpers.some((h) => h.toLowerCase() === first.toLowerCase()) ? addHelper(cur, first) : cur));
      setTimeout(addSelf, 2500);
      toast({ title: `You're a co-host of ${invite.name || 'this party'}`, detail: 'You can edit everything. Changes show up for the host right away.', tone: 'success' });
    })();
  }, [invite, cloud, switchEvent, toast]);

  // Replies from the RSVP link go straight into the guest list (on whichever host or co-host device is open).
  // Re-run when the guest list changes too, so a reply is never lost to a copy arriving from the account.
  const toasted = useRef(new Set<string>());
  const guestsKey = s.guests.map((g) => `${g.id}:${g.rsvpAt ?? ''}`).join('|');
  useEffect(() => {
    const reps = cloud.replies;
    const ids = Object.keys(reps).sort((a, b) => reps[a].at - reps[b].at);
    if (!ids.length) return;
    let cur = latest.current;
    const changed: { name: string; status: string; people: number; key: string }[] = [];
    for (const id of ids) {
      const r = applyRsvpReply(cur, id, reps[id]);
      if (!r.change) continue;
      cur = r.state;
      changed.push({ name: r.name, status: reps[id].status, people: reps[id].adults + reps[id].kids, key: `${id}@${reps[id].at}` });
    }
    if (!changed.length) return;
    setS(cur);
    const fresh = changed.filter((c) => !toasted.current.has(c.key));
    fresh.forEach((c) => toasted.current.add(c.key));
    if (fresh.length === 1) {
      const c = fresh[0];
      toast({ title: `${c.name} replied`, detail: c.status === 'yes' ? `Coming (${c.people}). Your guest list is updated.` : c.status === 'maybe' ? 'Not sure yet. Your guest list is updated.' : "Can't come. Your guest list is updated.", tone: 'info' });
    } else if (fresh.length > 1) {
      toast({ title: `${fresh.length} new RSVP replies`, detail: 'Your guest list is updated.', tone: 'info' });
    }
  }, [cloud.replies, guestsKey, toast]);

  // Lost access (the host removed you, or deleted the party): drop this device's copy
  useEffect(() => {
    if (!cloud.lostIds.length) return;
    for (const id of cloud.lostIds) {
      if (restoring.current.has(id)) { cloud.ackLost(id); continue; }
      const name = libRef.current[id]?.name ?? (latest.current.eventId === id ? latest.current.event.name : 'A party');
      setLibrary((l) => {
        if (!l[id]) return l;
        const next = { ...l };
        delete next[id];
        try { localStorage.setItem(LIB_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
        return next;
      });
      if (latest.current.eventId === id) {
        setS((cur) => ({ ...blankState(cur.learnings), onboarding: { ...cur.onboarding, tourCompleted: false } }));
        setDrawer(null);
        setPage('welcome');
      }
      if (!leftOnPurpose.current.has(id)) toast({ title: `${name} is no longer in your account`, detail: 'The host removed you or deleted it.', tone: 'info' });
      cloud.ackLost(id);
    }
  }, [cloud, toast]);

  const att = useMemo(() => stateAttendance(s), [s]);
  const head = useMemo(() => stateHeadcount(s), [s]);
  const plan = useMemo(() => computePlan(s, head), [s, head]);
  const changePending = !!(s.started && s.baseline && !sameHeadcount(s.baseline.headcount, head));

  const value: Ctx = {
    s, update, replace, page, go, drawer, open, close, tour, startTour, setTour, markDid, theme, toggleTheme, toasts, toast, dismiss, att, head, plan, changePending,
    events, switchEvent, duplicateEvent, deleteEvent, snapshotEvents, restoreEvents, clearAllEvents,
    cloud, signOut, saveDeviceEventsToAccount, deviceBannerHidden, hideDeviceBanner,
    invite, acceptInvite, dismissInvite,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
}

export { demoState, blankState };
