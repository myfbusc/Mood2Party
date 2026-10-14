// Cloud saving: shared types. One event is stored as a main document ("core" settings and summary)
// plus one small document per guest group, item and task, so two people can edit different things at once.

export interface CloudUser { uid: string; name: string; email: string; photo?: string }

export type Role = 'host' | 'cohost' | 'helper';
export type Col = 'guests' | 'items' | 'tasks';
export const COLS: Col[] = ['guests', 'items', 'tasks'];

/** Someone with access to an event through their account: the host or a co-host. */
export interface Member { uid: string; name: string; email: string; role: Role }

/** What "Your events" needs without downloading a whole event. */
export interface EventMeta {
  id: string;
  name: string;
  date: string;
  ownerId: string;
  role: Role;
  updatedAt: number;
  tasksDone: number;
  tasksTotal: number;
  /** Everyone with access, host first */
  members: Member[];
  /** The current invite code, if the host has an invite link turned on (hosts only see it) */
  inviteCode: string | null;
  /** The current RSVP link code, if one is turned on */
  rsvpCode: string | null;
}

/** What a guest sees on the RSVP page (public: anyone with the link can read it). */
export interface RsvpPage {
  eventId: string;
  name: string;
  date: string;
  startTime: string;
  durationHrs: number;
  venue: string;
  deadline: string;
  hostName: string;
}

/** One guest group's reply from the RSVP page. */
export interface RsvpReply {
  name: string;
  status: 'yes' | 'maybe' | 'no';
  adults: number;
  kids: number;
  dietary: string;
  allergies: string;
  note: string;
  at: number;
}

/** Why joining with an invite link failed */
export type JoinError = 'invalid' | 'signed-out' | 'network';

/** Everything stored for one event, as JSON strings (records keyed by id). */
export interface RemoteEvent {
  core: string | null;
  cols: Record<Col, Record<string, string>>;
}

export interface WriteOps {
  core?: string;
  upserts: Partial<Record<Col, Record<string, string>>>;
  deletes: Partial<Record<Col, string[]>>;
  meta: { name: string; date: string; tasksDone: number; tasksTotal: number };
}

export type SyncStatus = 'off' | 'signed-out' | 'saving' | 'saved' | 'offline' | 'error';

/** The online service behind sign-in and saving. Firebase in production; a local stand-in for tests. */
export interface Backend {
  kind: 'firebase' | 'test';
  onUser(cb: (u: CloudUser | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  idToken(): Promise<string | null>;
  watchEvents(uid: string, cb: (list: EventMeta[]) => void, onError?: (e: unknown) => void): () => void;
  watchEvent(eventId: string, cb: (remote: RemoteEvent) => void, onError?: (e: unknown) => void): () => void;
  loadEvent(eventId: string): Promise<RemoteEvent | null>;
  createEvent(eventId: string, user: CloudUser, data: RemoteEvent, meta: WriteOps['meta']): Promise<void>;
  write(eventId: string, uid: string, ops: WriteOps): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  /** Host only: turn the invite link on with a fresh code (old links stop working), or off with null. */
  setInviteCode(eventId: string, code: string | null): Promise<void>;
  /** Join an event as a co-host with the code from an invite link. */
  joinEvent(eventId: string, code: string, user: CloudUser): Promise<void>;
  /** Host removes a co-host, or a co-host removes themselves (leaves). */
  removeMember(eventId: string, uid: string): Promise<void>;
  /** Turn the RSVP link on with a code and its public page, or off (null). */
  setRsvp(eventId: string, code: string | null, page: RsvpPage | null, oldCode: string | null): Promise<void>;
  /** Keep the public page's party details up to date. */
  updateRsvpPage(code: string, page: RsvpPage): Promise<void>;
  /** For guests (no sign-in needed) */
  loadRsvpPage(code: string): Promise<RsvpPage | null>;
  submitRsvp(eventId: string, code: string, replyId: string, reply: RsvpReply): Promise<void>;
  /** For the host and co-hosts */
  watchReplies(eventId: string, cb: (replies: Record<string, RsvpReply>) => void, onError?: (e: unknown) => void): () => void;
  loadProfile(uid: string): Promise<{ learnings?: string } | null>;
  saveProfile(uid: string, data: { learnings: string }): Promise<void>;
}

/** A random invite code that is hard to guess. */
export function newInviteCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

/** Members from the stored map, host first */
export function membersFrom(ownerId: string, map: Record<string, { role?: Role; name?: string; email?: string }> | undefined): Member[] {
  return Object.entries(map ?? {})
    .map(([uid, m]) => ({ uid, name: m.name || 'Someone', email: m.email || '', role: (uid === ownerId ? 'host' : m.role ?? 'cohost') as Role }))
    .sort((a, b) => (a.uid === ownerId ? -1 : b.uid === ownerId ? 1 : a.name.localeCompare(b.name)));
}

export const emptyRemote = (): RemoteEvent => ({ core: null, cols: { guests: {}, items: {}, tasks: {} } });
