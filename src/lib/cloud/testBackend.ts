// A stand-in for Firebase used only for testing (turn on with ?testcloud=1).
// Data lives in this browser's localStorage and is shared between tabs, so two tabs can act as two people.
import { emptyRemote, membersFrom, type RsvpPage, type RsvpReply, type Backend, type CloudUser, type Col, type EventMeta, type RemoteEvent, type Role, type WriteOps } from './types';

const KEY = 'm2p:testcloud';
const USER_KEY = 'm2p:testcloud-user';

type Meta = WriteOps['meta'];
interface StoredEvent extends Meta {
  ownerId: string;
  memberIds: string[];
  members: Record<string, { role: Role; name: string; email: string }>;
  updatedAt: number;
  inviteCode?: string | null;
  rsvpCode?: string | null;
  replies?: Record<string, RsvpReply>;
  core: string;
  cols: Record<Col, Record<string, string>>;
}
interface Db { events: Record<string, StoredEvent>; users: Record<string, { learnings?: string }>; rsvpPages?: Record<string, RsvpPage> }

const read = (): Db => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '') as Db;
  } catch {
    return { events: {}, users: {} };
  }
};
const listeners = new Set<() => void>();
const write = (db: Db) => {
  localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((l) => l());
};
window.addEventListener('storage', (e) => { if (e.key === KEY) listeners.forEach((l) => l()); });
const later = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 40));

export function createTestBackend(): Backend {
  const userListeners = new Set<(u: CloudUser | null) => void>();
  const current = (): CloudUser | null => {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  };
  const setUser = (u: CloudUser | null) => {
    if (u) sessionStorage.setItem(USER_KEY, JSON.stringify(u));
    else sessionStorage.removeItem(USER_KEY);
    userListeners.forEach((l) => l(u));
  };
  const watch = (fn: () => void) => {
    listeners.add(fn);
    setTimeout(fn, 0);
    return () => { listeners.delete(fn); };
  };
  return {
    kind: 'test',
    onUser(cb) {
      userListeners.add(cb);
      setTimeout(() => cb(current()), 0);
      return () => { userListeners.delete(cb); };
    },
    async signIn() {
      const name = window.prompt('Test sign-in (stands in for Google). Your name:', 'Alex Rivera');
      if (!name) throw Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' });
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest';
      setUser({ uid: `test-${slug}`, name, email: `${slug}@example.com` });
    },
    async signOut() { setUser(null); },
    async idToken() { const u = current(); return u ? `test-token-${u.uid}` : null; },
    watchEvents(uid, cb) {
      return watch(() => {
        const db = read();
        const list: EventMeta[] = Object.entries(db.events)
          .filter(([, e]) => e.memberIds.includes(uid))
          .map(([id, e]) => ({ id, name: e.name, date: e.date, ownerId: e.ownerId, role: e.members[uid]?.role ?? 'helper', updatedAt: e.updatedAt, tasksDone: e.tasksDone, tasksTotal: e.tasksTotal, members: membersFrom(e.ownerId, e.members), inviteCode: e.ownerId === uid ? e.inviteCode ?? null : null, rsvpCode: e.rsvpCode ?? null }));
        cb(list);
      });
    },
    watchEvent(eventId, cb) {
      let last = '';
      return watch(() => {
        const e = read().events[eventId];
        const remote: RemoteEvent = e ? { core: e.core, cols: e.cols } : emptyRemote();
        const key = JSON.stringify(remote);
        if (key !== last) { last = key; cb(remote); }
      });
    },
    async loadEvent(eventId) {
      const e = read().events[eventId];
      return later(e ? { core: e.core, cols: e.cols } : null);
    },
    async createEvent(eventId, user, data, meta) {
      await later(null);
      const db = read();
      db.events[eventId] = { ...meta, ownerId: user.uid, memberIds: [user.uid], members: { [user.uid]: { role: 'host', name: user.name, email: user.email } }, updatedAt: Date.now(), core: data.core ?? '{}', cols: data.cols };
      write(db);
    },
    async write(eventId, uid, ops) {
      if (localStorage.getItem('m2p:testcloud-offline') === '1') throw new Error('offline');
      const db = read();
      const e = db.events[eventId];
      if (!e || !e.memberIds.includes(uid)) throw new Error('permission-denied');
      if (ops.core) e.core = ops.core;
      for (const [col, recs] of Object.entries(ops.upserts) as [Col, Record<string, string>][]) Object.assign(e.cols[col], recs);
      for (const [col, ids] of Object.entries(ops.deletes) as [Col, string[]][]) ids.forEach((id) => delete e.cols[col][id]);
      Object.assign(e, ops.meta, { updatedAt: Date.now() });
      write(db);
    },
    async deleteEvent(eventId) {
      const db = read();
      delete db.events[eventId];
      write(db);
    },
    async setInviteCode(eventId, code) {
      await later(null);
      const db = read();
      const e = db.events[eventId];
      const u = current();
      if (!e || !u || e.ownerId !== u.uid) throw new Error('permission-denied');
      e.inviteCode = code;
      write(db);
    },
    async joinEvent(eventId, code, user) {
      await later(null);
      const db = read();
      const e = db.events[eventId];
      // Same check as the Firestore rules: the code must match the current invite code
      if (!e || !e.inviteCode || e.inviteCode !== code) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
      if (!e.memberIds.includes(user.uid)) e.memberIds.push(user.uid);
      e.members[user.uid] = e.members[user.uid] ?? { role: 'cohost', name: user.name, email: user.email };
      write(db);
    },
    async removeMember(eventId, uid) {
      await later(null);
      const db = read();
      const e = db.events[eventId];
      const u = current();
      if (!e || !u || (u.uid !== e.ownerId && u.uid !== uid) || uid === e.ownerId) throw new Error('permission-denied');
      e.memberIds = e.memberIds.filter((x) => x !== uid);
      delete e.members[uid];
      write(db);
    },
    async setRsvp(eventId, code, page, oldCode) {
      await later(null);
      const db = read();
      const e = db.events[eventId];
      const u = current();
      if (!e || !u || !e.memberIds.includes(u.uid)) throw new Error('permission-denied');
      db.rsvpPages = db.rsvpPages ?? {};
      if (code && page) db.rsvpPages[code] = page;
      if (oldCode && oldCode !== code) delete db.rsvpPages[oldCode];
      e.rsvpCode = code;
      write(db);
    },
    async updateRsvpPage(code, page) {
      const db = read();
      db.rsvpPages = { ...(db.rsvpPages ?? {}), [code]: page };
      write(db);
    },
    async loadRsvpPage(code) { return later(read().rsvpPages?.[code] ?? null); },
    async submitRsvp(eventId, code, replyId, reply) {
      await later(null);
      const db = read();
      const e = db.events[eventId];
      // Same check as the Firestore rules
      if (!e || !e.rsvpCode || e.rsvpCode !== code) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
      e.replies = { ...(e.replies ?? {}), [replyId]: reply };
      write(db);
    },
    watchReplies(eventId, cb) {
      let last = '';
      return watch(() => {
        const r = read().events[eventId]?.replies ?? {};
        const key = JSON.stringify(r);
        if (key !== last) { last = key; cb(r); }
      });
    },
    async loadProfile(uid) { return later(read().users[uid] ?? null); },
    async saveProfile(uid, data) {
      const db = read();
      db.users[uid] = { ...db.users[uid], ...data };
      write(db);
    },
  };
}
