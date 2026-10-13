// Turning the app's single plan object into stored records and back, and merging changes from other people.
import type { AppState } from '../types';
import { COLS, emptyRemote, type Col, type RemoteEvent, type WriteOps } from './types';

/** Settings shared by everyone on the event (not the per-person parts like onboarding and learnings). */
type Core = Omit<AppState, 'guests' | 'items' | 'tasks' | 'learnings' | 'onboarding' | 'eventId'>;

/** Records keep their list position so the order on screen survives the round trip. */
interface Wrapped<T> { o: number; d: T }

export function split(s: AppState): RemoteEvent {
  const { guests, items, tasks, learnings: _l, onboarding: _o, eventId: _e, ...core } = s;
  void _l; void _o; void _e;
  const out = emptyRemote();
  out.core = JSON.stringify(core satisfies Core);
  const put = (col: Col, list: { id: string }[]) => list.forEach((r, i) => { out.cols[col][r.id] = JSON.stringify({ o: i, d: r } satisfies Wrapped<unknown>); });
  put('guests', guests);
  put('items', items);
  put('tasks', tasks);
  return out;
}

const unwrapList = <T>(rec: Record<string, string>): T[] =>
  Object.values(rec)
    .map((v) => { try { return JSON.parse(v) as Wrapped<T>; } catch { return null; } })
    .filter((x): x is Wrapped<T> => !!x && typeof x === 'object' && 'd' in x)
    .sort((a, b) => a.o - b.o)
    .map((x) => x.d);

/** Builds a plan from stored records, keeping this person's own learnings and onboarding. */
export function join(remote: RemoteEvent, eventId: string, personal: Pick<AppState, 'learnings' | 'onboarding'>): AppState | null {
  if (!remote.core) return null;
  let core: Core;
  try { core = JSON.parse(remote.core); } catch { return null; }
  return {
    ...core,
    eventId,
    isDemo: false,
    started: true,
    guests: unwrapList(remote.cols.guests),
    items: unwrapList(remote.cols.items),
    tasks: unwrapList(remote.cols.tasks),
    learnings: personal.learnings,
    onboarding: personal.onboarding,
  } as AppState;
}

export function summary(s: AppState): WriteOps['meta'] {
  return { name: s.event.name, date: s.event.date, tasksDone: s.tasks.filter((t) => t.status === 'done').length, tasksTotal: s.tasks.length };
}

/** What changed locally since the last version both sides agree on. */
export function diff(base: RemoteEvent, next: RemoteEvent): Omit<WriteOps, 'meta'> | null {
  const ops: Omit<WriteOps, 'meta'> = { upserts: {}, deletes: {} };
  let any = false;
  if (next.core !== base.core && next.core) { ops.core = next.core; any = true; }
  for (const col of COLS) {
    for (const [id, v] of Object.entries(next.cols[col])) {
      if (base.cols[col][id] !== v) { (ops.upserts[col] ??= {})[id] = v; any = true; }
    }
    for (const id of Object.keys(base.cols[col])) {
      if (!(id in next.cols[col])) { (ops.deletes[col] ??= []).push(id); any = true; }
    }
  }
  return any ? ops : null;
}

/**
 * Merges what arrived from the server into what is on screen.
 * A record someone else changed is taken from the server, unless it was also changed here and not yet saved
 * (then this version wins and is saved next). Returns the merged records and the new agreed version.
 */
export function merge(base: RemoteEvent, local: RemoteEvent, remote: RemoteEvent): { merged: RemoteEvent; changed: boolean } {
  const merged = emptyRemote();
  let changed = false;
  // core
  if (remote.core !== base.core && local.core === base.core) { merged.core = remote.core; changed = changed || remote.core !== local.core; }
  else merged.core = local.core;
  for (const col of COLS) {
    const ids = new Set([...Object.keys(base.cols[col]), ...Object.keys(local.cols[col]), ...Object.keys(remote.cols[col])]);
    for (const id of ids) {
      const b = base.cols[col][id], l = local.cols[col][id], r = remote.cols[col][id];
      const localEdited = l !== b;
      const remoteEdited = r !== b;
      const pick = remoteEdited && !localEdited ? r : l;
      if (pick !== undefined) merged.cols[col][id] = pick;
      if (pick !== l) changed = true;
    }
  }
  return { merged, changed };
}
