import { syncCustomMenu, withParsedMenu } from './menuText';
import { buildItems, juiceTemplate, outdoorTemplates, syncMenuItems, templateToItem } from './catalog';
import { emptyWrapUp, freshOnboarding } from './demo';
import { stateAttendance, stateHeadcount } from './attendance';
import { computeImpact, computeLine, computePlan, computeStrategies, round2, type PlanTotals } from './plan';
import { addDays, applyEventChange, generateTasks, uid } from './tasks';
import type { Draft } from './parse';
import type { AppState, EventInfo, GuestGroup, Headcount, Learnings, Outcome, PlanItem, RetailerId } from './types';

export function planFromDraft(prev: AppState, d: Draft): AppState {
  const event: EventInfo = {
    name: d.name || d.type,
    type: d.type,
    date: d.date,
    startTime: d.startTime,
    durationHrs: d.durationHrs,
    venue: d.venue,
    setting: d.setting,
    venueCapacity: d.venueCapacity,
    foodFormat: d.foodFormat,
    dietary: d.dietary,
    theme: d.theme,
    budget: d.budget,
    helpers: d.helpers.map((h) => h.trim()).filter(Boolean),
    rsvpDeadline: addDays(d.date, -14),
    extraFood: (d.extraFood ?? []).filter((f) => f !== d.foodFormat),
    alcohol: d.alcohol ?? 'none',
    softDrinks: d.softDrinks ?? ['soda', 'water'],
    preferences: (d.preferences ?? '').trim(),
    foodText: (d.foodText ?? '').trim(),
    drinksText: (d.drinksText ?? '').trim(),
  };
  const ev = withParsedMenu(event);
  const kids = Math.max(0, Math.min(d.guestExpected, Math.round(d.children ?? (d.guestExpected * d.childPct) / 100)));
  const estimate = { min: d.guestMin, expected: d.guestExpected, max: d.guestMax, childPct: d.guestExpected ? Math.round((kids / d.guestExpected) * 100) : 0, children: kids };
  const next: AppState = {
    ...prev,
    version: 1,
    eventId: uid('event'),
    started: true,
    isDemo: false,
    event: ev,
    guests: [],
    estimate,
    weights: weightsFromLearnings(prev.learnings),
    appliedFactors: { ...prev.learnings.itemFactors },
    basis: 'expected',
    customCount: d.guestExpected,
    items: buildItems(ev, kids > 0),
    tasks: generateTasks(ev),
    expenses: [],
    wrapUp: emptyWrapUp(),
    onboarding: prev.learnings.history.length
      ? { ...freshOnboarding(), introSeen: true, tourDone: true, checklistHidden: true }
      : {
          ...freshOnboarding(),
          introSeen: !!prev.onboarding?.introSeen || !!prev.onboarding?.tourDone,
          tourDone: !!prev.onboarding?.tourDone,
          checklistHidden: !!prev.onboarding?.checklistHidden,
          checklistCollapsed: !!prev.onboarding?.checklistCollapsed,
        },
    baseline: null,
  };
  const menu = syncCustomMenu(next, ev);
  return withBaseline({ ...next, items: menu.items, tasks: menu.tasks });
}

/** A fresh copy of an event to reuse as a template: same items, tasks, helpers and guest list, with nothing bought, done or answered yet. */
export function templateFrom(src: AppState): AppState {
  return withBaseline({
    ...src,
    eventId: uid('event'),
    started: true,
    isDemo: false,
    event: { ...src.event, name: `${src.event.name} (copy)` },
    guests: src.guests.map((g) => (g.status === 'declined' ? g : { ...g, status: 'maybe' as const })),
    items: src.items.map((it) => ({ ...it, purchasedPkgs: 0 })),
    tasks: src.tasks.map((t) => ({ ...t, status: 'todo' as const, blocker: null, affectedBy: null })),
    expenses: src.expenses.map((e) => ({ ...e, paid: false })),
    wrapUp: emptyWrapUp(),
    baseline: null,
  });
}

export function withBaseline(s: AppState): AppState {
  return { ...s, baseline: { headcount: stateHeadcount(s), basis: s.basis, reviewedAt: Date.now() } };
}

export function patchItem(s: AppState, id: string, patch: Partial<PlanItem>): AppState {
  return { ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) };
}

/** Save a user-edited quantity. `null` returns the item to the system recommendation. */
export function setItemQuantity(s: AppState, id: string, qty: number | null): AppState {
  const h = stateHeadcount(s);
  const it = s.items.find((x) => x.id === id);
  if (!it) return s;
  const rec = computeLine({ ...it, qtyOverride: null }, h, s.event, s.appliedFactors).rec;
  if (qty === null || qty === rec) return patchItem(s, id, { qtyOverride: null, overrideAtRec: null });
  return patchItem(s, id, { qtyOverride: Math.max(0, Math.round(qty)), overrideAtRec: rec });
}

export function markPurchased(s: AppState, id: string, purchased: boolean): AppState {
  const h = stateHeadcount(s);
  const it = s.items.find((x) => x.id === id);
  if (!it) return s;
  const line = computeLine(it, h, s.event, s.appliedFactors);
  return patchItem(s, id, purchased ? { purchasedPkgs: Math.max(line.pkgs, it.purchasedPkgs, 1) } : { purchasedPkgs: 0, paidAmount: undefined });
}

export function applyAssignment(s: AppState, assignment: Record<string, RetailerId>): AppState {
  return { ...s, items: s.items.map((it) => (assignment[it.id] ? { ...it, retailer: assignment[it.id] } : it)) };
}

export interface EventSaveResult {
  state: AppState;
  changed: string[];
  flagged: number;
  shiftedDays: number;
  itemNotes: string[];
}

/** Save event details: flag affected tasks, shift due dates with the date, and add or set aside setting-specific items. */
export function saveEventDetails(s: AppState, nextRaw: EventInfo): EventSaveResult {
  const menuTextChanged = (s.event.foodText ?? null) !== (nextRaw.foodText ?? null) || (s.event.drinksText ?? null) !== (nextRaw.drinksText ?? null);
  const next = menuTextChanged ? withParsedMenu(nextRaw) : nextRaw;
  const { tasks: changedTasks, changed, flagged, shiftedDays } = applyEventChange(s.event, next, s.tasks);
  let tasks = changedTasks;
  let items = s.items;
  const itemNotes: string[] = [];
  if (s.event.setting !== next.setting) {
    if (next.setting === 'outdoors') {
      for (const t of outdoorTemplates(next)) {
        const existing = items.find((x) => x.id === t.id);
        if (existing) items = items.map((x) => (x.id === t.id ? { ...x, removed: false } : x));
        else items = [...items, templateToItem(t)];
        itemNotes.push(`Added ${t.name.toLowerCase()} for the outdoor setting`);
      }
    } else {
      items = items.map((x) => {
        if (x.tag === 'outdoor' && !x.removed) {
          itemNotes.push(`Set aside ${x.name.toLowerCase()} (indoors); restore it from Removed items if you still need it`);
          return { ...x, removed: true };
        }
        return x;
      });
    }
  }
  if (s.event.foodFormat !== next.foodFormat) {
    const fresh = buildItems(next, false).find((x) => x.id === 'mains');
    const hadSides = items.some((x) => x.id === 'sides');
    items = items.map((x) => (x.id === 'mains' && fresh ? { ...fresh, buyer: x.buyer } : x));
    if (fresh) itemNotes.push(`Main food changed to ${fresh.name.toLowerCase()}`);
    if (next.foodFormat === 'appetizers' && hadSides) {
      items = items.map((x) => (x.id === 'sides' ? { ...x, removed: true } : x));
      itemNotes.push('Side dishes set aside, because appetizers replace the meal');
    }
  }
  const menuChanged = JSON.stringify([s.event.extraFood ?? [], s.event.alcohol ?? 'none', s.event.softDrinks ?? ['soda', 'water'], s.event.foodFormat])
    !== JSON.stringify([next.extraFood ?? [], next.alcohol ?? 'none', next.softDrinks ?? ['soda', 'water'], next.foodFormat]);
  if (menuChanged) {
    const r = syncMenuItems(items, next);
    items = r.items;
    itemNotes.push(...r.notes);
  }
  if (s.event.theme !== next.theme) {
    items = items.map((x) => (x.id === 'balloons' ? { ...x, name: `Balloon garland kit (${next.theme || 'party'})` } : x));
  }
  if (menuTextChanged) {
    const r = syncCustomMenu({ items, tasks, event: next }, next);
    items = r.items;
    tasks = r.tasks;
    itemNotes.push(...r.notes);
  }
  const state = { ...s, event: next, items, tasks };
  return { state, changed, flagged, shiftedDays, itemNotes };
}

export function ensureKidsItems(s: AppState): AppState {
  const att = stateAttendance(s);
  if (att.max.children > 0 && !s.items.some((x) => x.id === 'juice')) {
    const t = juiceTemplate(s.event);
    if (t) return { ...s, items: [...s.items, templateToItem(t)] };
  }
  return s;
}

export type ConflictChoice = 'keep' | 'use';

/** Accept a headcount change: flag affected tasks, resolve edited quantities, move the baseline. */
export function acceptChanges(s: AppState, choices: Record<string, ConflictChoice>): AppState {
  const to = stateHeadcount(s);
  const from: Headcount = s.baseline?.headcount ?? to;
  const impact = computeImpact(s, from, to);
  const reason = `Planning count changed from ${from.total} to ${to.total} guests. Check amounts and bookings.`;
  const flagIds = new Set(impact.tasks.map((t) => t.id));
  const tasks = s.tasks.map((t) => (flagIds.has(t.id) ? { ...t, affectedBy: reason } : t));
  const items = s.items.map((it) => {
    const line = impact.rows.find((r) => r.item.id === it.id)?.after;
    if (!line || it.qtyOverride === null) return it;
    const c = choices[it.id];
    if (c === 'use') return { ...it, qtyOverride: null, overrideAtRec: null };
    if (c === 'keep') return { ...it, overrideAtRec: line.rec };
    return it;
  });
  return withBaseline({ ...s, tasks, items });
}

// ─── After the Event ───────────────────────────────────────────────

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function learningsFromWrapUp(s: AppState): Learnings {
  const factors = { ...s.learnings.itemFactors };
  for (const [id, o] of Object.entries(s.wrapUp.outcomes) as [string, Outcome][]) {
    const f = factors[id] ?? 1;
    if (o === 'ran-out') factors[id] = round2(clamp(f * 1.15, 0.6, 1.6));
    else if (o === 'leftover') factors[id] = round2(clamp(f * 0.9, 0.6, 1.6));
  }
  const att = stateAttendance(s);
  const actual = s.wrapUp.actualAttendance;
  const history = [...s.learnings.history];
  let turnoutRatio = s.learnings.turnoutRatio;
  if (actual !== null && att.expected.total > 0) {
    history.push({ name: s.event.name, date: s.event.date, expected: att.expected.total, actual });
    const ratios = history.map((h) => h.actual / Math.max(1, h.expected));
    turnoutRatio = round2(ratios.reduce((a, b) => a + b, 0) / ratios.length);
  }
  return { itemFactors: factors, turnoutRatio, history };
}

/** Default share of "Not sure yet" guests who come. */
export const DEFAULT_NOT_SURE = 0.45;

/** Suggested "not sure" weight from past turnout. */
export function weightsFromLearnings(l: Learnings) {
  const k = l.turnoutRatio ? clamp(l.turnoutRatio, 0.6, 1.4) : 1;
  const w = round2(clamp(DEFAULT_NOT_SURE * k, 0.1, 1));
  return { maybe: w, unresponsive: w };
}

/** How much the whole-event estimate drops if the lowest-cost store mix is applied. */
export function lowestCostSaving(s: AppState, head: Headcount, plan: PlanTotals): number {
  const st = computeStrategies(plan).find((x) => x.id === 'lowest');
  if (!st || !st.complete) return 0;
  return Math.max(0, round2(plan.grandTotal - computePlan(applyAssignment(s, st.assignment), head).grandTotal));
}

// ─── Helpers (people who can own tasks and buy items) ──────────────

/** Returns an error message, or null when the name can be added to this list of helpers. */
export function helperListProblem(helpers: string[], raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Enter a name first.';
  if (name.toLowerCase() === 'you') return '"You" is already on the list. Try another name.';
  if (name.includes(',')) return 'Add one name at a time (no commas).';
  if (!/[\p{L}\p{N}]/u.test(name)) return 'Use letters or numbers in the name.';
  const existing = helpers.find((h) => h.toLowerCase() === name.toLowerCase());
  if (existing) return `${existing} is already an organizer.`;
  if (name.length > 40) return 'Keep the name under 40 characters.';
  if (helpers.length >= 20) return 'You can add up to 20 helpers.';
  return null;
}

export function helperNameProblem(s: AppState, raw: string): string | null {
  return helperListProblem(s.event.helpers, raw);
}

export function addHelper(s: AppState, raw: string): AppState {
  return { ...s, event: { ...s.event, helpers: [...s.event.helpers, raw.trim()] } };
}

/** Removes a helper. Their open tasks move to you and their purchases go back to "no buyer yet". */
export function removeHelper(s: AppState, name: string): { state: AppState; tasksMoved: number; itemsCleared: number } {
  let tasksMoved = 0;
  let itemsCleared = 0;
  const tasks = s.tasks.map((t) => {
    if (t.owner !== name) return t;
    if (t.status !== 'done') tasksMoved++;
    return { ...t, owner: 'You' };
  });
  const items = s.items.map((it) => {
    if (it.buyer !== name) return it;
    itemsCleared++;
    return { ...it, buyer: '' };
  });
  return { state: { ...s, event: { ...s.event, helpers: s.event.helpers.filter((h) => h !== name) }, tasks, items }, tasksMoved, itemsCleared };
}

/** Adding the very first guest shouldn't shrink the plan to that one group: keep planning for the current number until you pick otherwise. */
export function keepCountOnFirstGuest(prev: AppState, next: AppState): AppState {
  if (prev.guests.length > 0 || next.guests.length === 0 || prev.basis === 'custom') return next;
  return { ...next, basis: 'custom', customCount: stateHeadcount(prev).total };
}

/** A reply from the RSVP page, as it reaches the guest list. */
export interface RsvpReplyIn {
  name: string;
  status: 'yes' | 'maybe' | 'no';
  adults: number;
  kids: number;
  dietary: string;
  allergies: string;
  note: string;
  at: number;
}

/**
 * Puts one RSVP reply into the guest list: the group it came from before, else a group with the same name
 * that hasn't replied through the link yet, else a new group. Older replies never overwrite newer ones.
 */
export function applyRsvpReply(s: AppState, replyId: string, r: RsvpReplyIn): { state: AppState; change: 'new' | 'updated' | null; name: string } {
  const status = r.status === 'yes' ? 'confirmed' : r.status === 'maybe' ? 'maybe' : 'declined';
  const clean = (v: string, n: number) => String(v ?? '').trim().slice(0, n);
  const name = clean(r.name, 80) || 'Guest';
  const fields = {
    name, status: status as GuestGroup['status'],
    adults: Math.max(r.status === 'no' ? 0 : 1, Math.min(30, Math.round(Number(r.adults) || 0))),
    children: Math.max(0, Math.min(30, Math.round(Number(r.kids) || 0))),
    dietary: clean(r.dietary, 200) || undefined, allergies: clean(r.allergies, 200) || undefined, note: clean(r.note, 300) || undefined,
    rsvpId: replyId, rsvpAt: r.at,
  };
  const key = (n: string) => n.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const idx = s.guests.findIndex((g) => g.rsvpId === replyId || g.id === `rsvp-${replyId}`);
  const byName = idx < 0 ? s.guests.findIndex((g) => !g.rsvpId && key(g.name) === key(name)) : -1;
  const at = idx >= 0 ? idx : byName;
  if (at >= 0) {
    const g = s.guests[at];
    if ((g.rsvpAt ?? 0) >= r.at) return { state: s, change: null, name };
    // Someone already on the list keeps the name the host gave them
    const next = { ...g, ...fields, name: byName >= 0 || idx >= 0 ? g.name : name, adults: r.status === 'no' ? g.adults : fields.adults };
    return { state: ensureKidsItems({ ...s, guests: s.guests.map((x, i) => (i === at ? next : x)) }), change: 'updated', name: next.name };
  }
  const group: GuestGroup = { id: `rsvp-${replyId}`, ...fields, adults: Math.max(1, fields.adults) };
  return { state: ensureKidsItems({ ...s, guests: [...s.guests, group] }), change: 'new', name };
}
