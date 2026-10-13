// Firebase: Google sign-in (Authentication) and saving (Cloud Firestore).
// Settings come from the build's environment variables (VITE_FIREBASE_*), set in Cloudflare Pages.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type Auth, type User } from 'firebase/auth';
import {
  arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, getFirestore, onSnapshot, query, setDoc, updateDoc, where, writeBatch, type Firestore,
} from 'firebase/firestore';
import { COLS, emptyRemote, membersFrom, type Backend, type CloudUser, type Col, type EventMeta, type RemoteEvent } from './types';

export function firebaseConfig() {
  const env = import.meta.env;
  const cfg = {
    apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  };
  return cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId ? (cfg as Required<typeof cfg>) : null;
}

const toUser = (u: User): CloudUser => ({ uid: u.uid, name: u.displayName || u.email?.split('@')[0] || 'You', email: u.email || '', photo: u.photoURL || undefined });

export function createFirebaseBackend(): Backend | null {
  const cfg = firebaseConfig();
  if (!cfg) return null;
  let app: FirebaseApp, auth: Auth, db: Firestore;
  try {
    app = initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch {
    return null;
  }

  const eventRef = (id: string) => doc(db, 'events', id);
  const colRef = (id: string, col: Col) => collection(db, 'events', id, col);

  /** Firestore allows up to 500 writes per batch; stay well under. */
  async function commitInChunks(ops: ((b: ReturnType<typeof writeBatch>) => void)[]) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db);
      ops.slice(i, i + 400).forEach((op) => op(b));
      await b.commit();
    }
  }

  return {
    kind: 'firebase',
    onUser(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null));
    },
    async signIn() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        // Some phones and browsers block pop-ups: fall back to a full-page sign-in
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, provider);
        else throw e;
      }
    },
    async signOut() { await fbSignOut(auth); },
    async idToken() { return auth.currentUser ? auth.currentUser.getIdToken() : null; },
    watchEvents(uid, cb, onError) {
      return onSnapshot(
        query(collection(db, 'events'), where('memberIds', 'array-contains', uid)),
        (snap) => {
          cb(snap.docs.map((d) => {
            const e = d.data();
            return {
              id: d.id, name: e.name ?? 'Event', date: e.date ?? '', ownerId: e.ownerId, role: e.members?.[uid]?.role ?? 'helper',
              updatedAt: e.updatedAt ?? 0, tasksDone: e.tasksDone ?? 0, tasksTotal: e.tasksTotal ?? 0,
              members: membersFrom(e.ownerId, e.members), inviteCode: e.ownerId === uid ? e.inviteCode ?? null : null,
            } satisfies EventMeta;
          }));
        },
        onError,
      );
    },
    watchEvent(eventId, cb, onError) {
      const remote = emptyRemote();
      const seen = { core: false, guests: false, items: false, tasks: false };
      const emit = () => { if (Object.values(seen).every(Boolean)) cb({ core: remote.core, cols: { guests: { ...remote.cols.guests }, items: { ...remote.cols.items }, tasks: { ...remote.cols.tasks } } }); };
      const offs = [
        onSnapshot(eventRef(eventId), (d) => { remote.core = d.exists() ? (d.data().core as string) : null; seen.core = true; emit(); }, onError),
        ...COLS.map((col) =>
          onSnapshot(colRef(eventId, col), (snap) => {
            const next: Record<string, string> = {};
            snap.docs.forEach((d) => { next[d.id] = d.data().v as string; });
            remote.cols[col] = next;
            seen[col] = true;
            emit();
          }, onError),
        ),
      ];
      return () => offs.forEach((off) => off());
    },
    async loadEvent(eventId) {
      const e = await getDoc(eventRef(eventId));
      if (!e.exists()) return null;
      const out: RemoteEvent = emptyRemote();
      out.core = e.data().core as string;
      for (const col of COLS) (await getDocs(colRef(eventId, col))).docs.forEach((d) => { out.cols[col][d.id] = d.data().v as string; });
      return out;
    },
    async createEvent(eventId, user, data, meta) {
      await setDoc(eventRef(eventId), {
        ...meta, core: data.core, ownerId: user.uid, memberIds: [user.uid],
        members: { [user.uid]: { role: 'host', name: user.name, email: user.email } }, updatedAt: Date.now(), updatedBy: user.uid,
      });
      const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
      for (const col of COLS) for (const [id, v] of Object.entries(data.cols[col])) ops.push((b) => b.set(doc(colRef(eventId, col), id), { v, updatedBy: user.uid }));
      await commitInChunks(ops);
    },
    async write(eventId, uid, ops) {
      const list: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
      list.push((b) => b.update(eventRef(eventId), { ...ops.meta, ...(ops.core ? { core: ops.core } : {}), updatedAt: Date.now(), updatedBy: uid }));
      for (const col of COLS) {
        for (const [id, v] of Object.entries(ops.upserts[col] ?? {})) list.push((b) => b.set(doc(colRef(eventId, col), id), { v, updatedBy: uid }));
        for (const id of ops.deletes[col] ?? []) list.push((b) => b.delete(doc(colRef(eventId, col), id)));
      }
      await commitInChunks(list);
    },
    async deleteEvent(eventId) {
      const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
      for (const col of COLS) (await getDocs(colRef(eventId, col))).docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      await commitInChunks(ops);
      await deleteDoc(eventRef(eventId));
    },
    async setInviteCode(eventId, code) {
      await updateDoc(eventRef(eventId), { inviteCode: code });
    },
    async joinEvent(eventId, code, user) {
      // Allowed by the security rules only when the code matches the event's current invite code
      await updateDoc(eventRef(eventId), {
        memberIds: arrayUnion(user.uid),
        [`members.${user.uid}`]: { role: 'cohost', name: user.name, email: user.email },
        joinCode: code,
      });
    },
    async removeMember(eventId, uid) {
      await updateDoc(eventRef(eventId), { memberIds: arrayRemove(uid), [`members.${uid}`]: deleteField() });
    },
    async loadProfile(uid) {
      const d = await getDoc(doc(db, 'users', uid));
      return d.exists() ? (d.data() as { learnings?: string }) : null;
    },
    async saveProfile(uid, data) {
      await setDoc(doc(db, 'users', uid), data, { merge: true });
    },
  };
}
