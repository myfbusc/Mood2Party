import { FOOD_FORMAT_LABEL, FOOD_SHORT } from './catalog';
import type { EventInfo, Task } from './types';

export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function daysBetween(fromISO: string, toISOStr: string) {
  const a = new Date(`${fromISO}T12:00:00`).getTime();
  const b = new Date(`${toISOStr}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

interface Suggestion {
  title: string;
  category: string;
  helper: number; // 0 = host, 1..n = helper index
  daysBefore: number;
  priority: Task['priority'];
}

/** Starter task list, generated from the event details (from the task-tracker MVP). */
export function generateTasks(ev: EventInfo): Task[] {
  const food = [ev.foodFormat, ...(ev.extraFood ?? [])].map((f) => FOOD_SHORT[f]).join(' + ');
  const s: Suggestion[] = [
    { title: 'Send invitations', category: 'Guests', helper: 0, daysBefore: 42, priority: 'high' },
    { title: `Book or order the food (${food})`, category: 'Food', helper: 0, daysBefore: 28, priority: 'high' },
    { title: 'Follow up with guests who are not sure yet', category: 'Guests', helper: 0, daysBefore: 14, priority: 'medium' },
    { title: 'Confirm the final headcount with the food vendor', category: 'Food', helper: 0, daysBefore: 7, priority: 'high' },
    { title: 'Buy decorations', category: 'Decorations', helper: 2, daysBefore: 14, priority: 'low' },
    { title: 'Borrow or rent tables and chairs', category: 'Setup', helper: 1, daysBefore: 14, priority: 'medium' },
    { title: 'Buy tableware and supplies', category: 'Shopping', helper: 1, daysBefore: 7, priority: 'medium' },
    { title: ev.alcohol === 'beer-wine' || ev.alcohol === 'full-bar' ? 'Buy drinks, alcohol and ice (an adult with ID)' : 'Buy drinks and ice', category: 'Shopping', helper: 1, daysBefore: 1, priority: 'medium' },
    { title: 'Pick up the cake or dessert', category: 'Food', helper: 2, daysBefore: 1, priority: 'medium' },
    { title: 'Assign day-of roles to organizers', category: 'Organizers', helper: 0, daysBefore: 10, priority: 'medium' },
    { title: 'Set up tables, decorations and the food station', category: 'Day of', helper: 3, daysBefore: 0, priority: 'medium' },
    { title: 'Clean up and pack leftovers', category: 'Day of', helper: 3, daysBefore: 0, priority: 'low' },
  ];
  if (ev.setting === 'outdoors') {
    s.push({ title: 'Get canopies for shade', category: 'Setup', helper: 0, daysBefore: 21, priority: 'high' });
    s.push({ title: 'Check the weather forecast and make a rain plan', category: 'Setup', helper: 0, daysBefore: 3, priority: 'medium' });
  }
  if (ev.foodFormat === 'potluck' || (ev.extraFood ?? []).includes('potluck')) {
    s.push({ title: 'Ask guests which dish they will bring', category: 'Food', helper: 0, daysBefore: 10, priority: 'medium' });
  }
  if (ev.dietary && !/^no\b|none/i.test(ev.dietary)) {
    s.push({ title: `Label dishes for dietary needs (${ev.dietary})`, category: 'Food', helper: 0, daysBefore: 2, priority: 'medium' });
  }
  const helpers = ev.helpers.filter(Boolean);
  const owner = (i: number) => (i === 0 || helpers.length === 0 ? 'You' : helpers[(i - 1) % helpers.length]);
  return s
    .map((x) => ({
      id: uid('task'),
      title: x.title,
      category: x.category,
      owner: owner(x.helper),
      dueDate: addDays(ev.date, -x.daysBefore),
      status: 'todo' as const,
      priority: x.priority,
      blocker: null,
      affectedBy: null,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

type DetailKey = 'date' | 'venue' | 'setting' | 'foodFormat' | 'theme' | 'budget' | 'venueCapacity' | 'durationHrs';

const RULES: { key: DetailKey; label: string; words: RegExp; reason: (f: string, t: string) => string }[] = [
  {
    key: 'date', label: 'Date',
    words: /invit|book|reserv|rent|canop|cater|vendor|food|rsvp|headcount|cake|dessert|ice|drink|setup|set up|table|weather|reply/i,
    reason: (f, t) => `Date moved from ${f} to ${t}. Check the due date and any bookings.`,
  },
  {
    key: 'venue', label: 'Location',
    words: /venue|reserv|seat|chair|table|tent|canop|shade|lights|parking|decor|setup|set up|invit|rent/i,
    reason: (f, t) => `Location changed from "${f}" to "${t}". Check space, setup and directions.`,
  },
  {
    key: 'setting', label: 'Indoors or outdoors',
    words: /seat|chair|table|tent|canop|shade|weather|rain|lights|rent|cooler|ice|decor|setup|set up/i,
    reason: (f, t) => `Moved from ${f} to ${t}. Check seating, weather and equipment.`,
  },
  {
    key: 'foodFormat', label: 'Food',
    words: /food|cater|menu|dietary|cake|dessert|drink|vendor|ice|headcount|dishes/i,
    reason: (f, t) => `Food changed from ${f} to ${t}. Check the vendor, menu and dietary needs.`,
  },
  {
    key: 'theme', label: 'Theme',
    words: /decor|balloon|banner|light|centerpiece|tablecloth|backdrop/i,
    reason: (f, t) => `Theme changed from "${f}" to "${t}". Check decorations.`,
  },
  {
    key: 'venueCapacity', label: 'Venue capacity',
    words: /table|chair|seat|setup|set up|invit|rsvp/i,
    reason: (f, t) => `Venue capacity changed from ${f} to ${t}. Check the guest list and seating.`,
  },
  {
    key: 'durationHrs', label: 'Duration',
    words: /drink|ice|food|cater|setup|clean/i,
    reason: (f, t) => `Event length changed from ${f} to ${t} hours. Check food and drink amounts.`,
  },
  {
    key: 'budget', label: 'Budget',
    words: /buy|book|order|rent|cater/i,
    reason: (f, t) => `Budget changed from $${f} to $${t}. Check purchases that are not done yet.`,
  },
];

export function fmtFood(v: string) {
  return (FOOD_FORMAT_LABEL as Record<string, string>)[v]?.toLowerCase() ?? v;
}

/** Compare old and new event details; flag tasks affected by what changed. */
export function applyEventChange(prev: EventInfo, next: EventInfo, tasks: Task[]) {
  const changed = RULES.filter((r) => String(prev[r.key]).trim() !== String(next[r.key]).trim());
  let count = 0;
  const shift = next.date !== prev.date ? daysBetween(prev.date, next.date) : 0;
  const updated = tasks.map((t) => {
    if (t.status === 'done') return t;
    let task = t;
    if (shift) task = { ...task, dueDate: addDays(task.dueDate, shift) };
    const hit = changed.find((r) => r.words.test(`${t.title} ${t.category}`));
    if (!hit) return task;
    count++;
    const f = hit.key === 'foodFormat' ? fmtFood(String(prev[hit.key])) : String(prev[hit.key]);
    const to = hit.key === 'foodFormat' ? fmtFood(String(next[hit.key])) : String(next[hit.key]);
    return { ...task, affectedBy: hit.reason(f, to) };
  });
  return { tasks: updated, changed: changed.map((c) => c.label), flagged: count, shiftedDays: shift };
}

export function isOverdue(t: Task, today = todayISO()) {
  return t.status !== 'done' && t.dueDate < today;
}
export function isBlocked(t: Task) {
  return t.status !== 'done' && (t.status === 'blocked' || !!t.blocker);
}
export function needsAttention(t: Task, today = todayISO()) {
  return t.status !== 'done' && (isOverdue(t, today) || isBlocked(t) || !!t.affectedBy);
}
/** Not started and due within 3 days: likely to slip unless someone acts now. */
export function isAtRisk(t: Task, today = todayISO()) {
  return t.status === 'todo' && !isBlocked(t) && t.dueDate >= today && daysBetween(today, t.dueDate) <= 3;
}
/** The owner said they need something (a car, cash, help). */
export function needsResource(t: Task) {
  return t.status !== 'done' && !!t.needs?.trim();
}
export function isDueSoon(t: Task, today = todayISO()) {
  return t.status !== 'done' && t.dueDate >= today && daysBetween(today, t.dueDate) <= 14;
}
