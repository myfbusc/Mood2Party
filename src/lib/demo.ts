import { buildItems } from './catalog';
import { addDays, generateTasks, toISO, todayISO, uid } from './tasks';
import type { AppState, EventInfo, GuestGroup, Learnings, PlanItem, WrapUp } from './types';

/** A Saturday about five to six weeks out, so the demo never goes stale. */
function demoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 38);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return toISO(d);
}

export const emptyLearnings = (): Learnings => ({ itemFactors: {}, turnoutRatio: null, history: [] });
export const freshOnboarding = () => ({ introSeen: false, tourDone: false, checklistHidden: false, did: {} });

export const emptyWrapUp = (): WrapUp => ({
  actualAttendance: null, outcomes: {}, notes: '', saved: false, feedbackHelped: null, feedbackComment: '',
});

const g = (name: string, adults: number, children: number, status: GuestGroup['status'], note = ''): GuestGroup => ({
  id: uid('guest'), name, adults, children, status, note,
});

export function demoGuests(): GuestGroup[] {
  return [
    g('The Rivera family', 4, 2, 'confirmed', 'Bringing a fruit platter'),
    g('Sarah and Dave Jenkins', 2, 0, 'confirmed', 'Can help set up tables'),
    g('Elena Vance', 1, 0, 'confirmed'),
    g('Coach Patel and family', 2, 2, 'confirmed'),
    g('Grandma and Grandpa Lopez', 2, 0, 'confirmed', 'Need seats in the shade'),
    g('Aunt Lisa and cousins', 2, 2, 'confirmed'),
    g('Priya Shah', 1, 0, 'confirmed', 'Vegetarian'),
    g('Marcus Brody (+1)', 2, 0, 'confirmed'),
    g('Study group (Ana, Ben, Chloe, Dev)', 4, 0, 'confirmed'),
    g('Roommates Kim and Tess', 2, 0, 'confirmed'),
    g('Tom and Jess Carter', 2, 0, 'confirmed'),
    g('The Nguyens (neighbors)', 2, 0, 'confirmed'),
    g('Professor Adams', 1, 0, 'confirmed'),
    g('Olivia Grant (+1)', 2, 0, 'confirmed'),
    g('Jordan Lee', 1, 0, 'confirmed'),
    g('The Chen-Taylor household', 2, 3, 'maybe', 'Kids have soccer in the morning'),
    g('Uncle Ray and Aunt Bea', 2, 0, 'maybe', 'Driving in if the weather is good'),
    g('Hannah Kim', 1, 0, 'maybe', 'Checking her work shift'),
    g('Soccer team friends', 4, 0, 'maybe'),
    g("Ben's parents", 2, 0, 'maybe'),
    g('Priya and Arjun Patel', 2, 1, 'maybe', 'Texted on Tuesday'),
    g('Uncle Bob and Aunt Linda', 2, 0, 'maybe', 'Call Linda'),
    g('Lab partners (3)', 3, 0, 'maybe'),
    g('The Mendoza family', 2, 2, 'maybe'),
    g('Dana Wright', 1, 0, 'maybe'),
    g('High school friends (3)', 3, 0, 'maybe'),
    g('Carlos and Maria Mendez', 2, 2, 'declined', 'Out of town'),
    g('Liam Gallagher', 1, 0, 'declined', 'At a wedding that day'),
  ];
}

export function demoEvent(): EventInfo {
  const date = demoDate();
  return {
    name: "Maya's graduation party",
    type: 'Graduation party',
    date,
    startTime: '14:00',
    durationHrs: 5,
    venue: 'Backyard and garden, Los Angeles',
    setting: 'outdoors',
    venueCapacity: 75,
    foodFormat: 'taco-bar',
    dietary: 'A few vegetarian guests',
    theme: 'Lavender and gold',
    budget: 1700,
    helpers: ['Mom', 'Dad', 'Jake', 'Aunt Lisa'],
    rsvpDeadline: addDays(date, -21),
  };
}

export function demoState(learnings = emptyLearnings()): AppState {
  const event = demoEvent();
  const items: PlanItem[] = buildItems(event, true).map((it) => {
    const x = { ...it };
    switch (it.id) {
      case 'serving-utensils': x.ownedQty = 6; break;
      case 'coolers': x.ownedQty = 1; break;
      case 'balloons': x.purchasedPkgs = 1; x.buyer = 'Aunt Lisa'; break;
      case 'banner': x.purchasedPkgs = 1; x.buyer = 'Aunt Lisa'; break;
      case 'plates': x.retailer = 'costco'; x.purchasedPkgs = 1; x.buyer = 'Dad'; break;
      case 'water': case 'soda': case 'ice': x.buyer = 'Jake'; break;
      case 'dessert': x.buyer = 'Mom'; x.retailer = 'instacart'; break;
      case 'mains': case 'sides': x.buyer = 'You'; break;
      case 'trash-bags': case 'paper-towels': x.buyer = 'Dad'; x.retailer = 'target'; break;
      case 'napkins': case 'cups': case 'cutlery': x.retailer = 'target'; break;
    }
    return x;
  });

  const today = todayISO();
  const tasks = generateTasks(event).map((t) => {
    if (t.dueDate < today) return { ...t, status: 'done' as const };
    if (/Book or order the food/.test(t.title)) return { ...t, status: 'in-progress' as const };
    if (/final headcount/.test(t.title))
      return { ...t, status: 'blocked' as const, blocker: 'Waiting on 11 groups to reply. The taco caterer needs a final number.' };
    return t;
  });
  tasks.push(
    { id: uid('task'), title: 'Build the photo slideshow', category: 'Decorations', owner: 'Dad', dueDate: addDays(event.date, -5), status: 'blocked', priority: 'medium', blocker: 'Waiting on family photos from relatives', affectedBy: null },
    { id: uid('task'), title: 'Confirm the canopy rental quote', category: 'Setup', owner: 'You', dueDate: addDays(today, -2), status: 'todo', priority: 'high', blocker: null, affectedBy: null },
    { id: uid('task'), title: 'Create the party playlist', category: 'Day of', owner: 'Jake', dueDate: addDays(event.date, -3), status: 'in-progress', priority: 'low', blocker: null, affectedBy: null },
  );
  tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    version: 1,
    started: true,
    isDemo: true,
    event,
    guests: demoGuests(),
    estimate: { min: 40, expected: 50, max: 60, childPct: 15, children: 8 },
    weights: { maybe: 0.45, unresponsive: 0.45 },
    basis: 'expected',
    customCount: 50,
    items,
    tasks,
    expenses: [
      { id: uid('exp'), name: 'Photographer (2 hours)', amount: 250, paid: false },
      { id: uid('exp'), name: 'Printed invitations and postage', amount: 64, paid: true },
    ],
    baseline: null, // set by the store after the first render
    learnings,
    appliedFactors: {},
    wrapUp: emptyWrapUp(),
    onboarding: freshOnboarding(),
  };
}

/** Simulated RSVP replies for moderated tests: three groups confirm and a new group joins. */
export function simulateRsvpReplies(guests: GuestGroup[]): GuestGroup[] {
  const confirm = ['The Chen-Taylor household', 'Soccer team friends', 'Priya and Arjun Patel'];
  const next = guests.map((x) => (confirm.includes(x.name) && x.status !== 'confirmed' ? { ...x, status: 'confirmed' as const, note: x.note ? `${x.note} · Just confirmed` : 'Just confirmed' } : x));
  if (!next.some((x) => x.name === "Maya's internship team")) {
    next.unshift(g("Maya's internship team", 5, 0, 'confirmed', 'New: added after the invitations went out'));
  }
  return next;
}

export function blankState(learnings = emptyLearnings()): AppState {
  const s = demoState(learnings);
  return { ...s, started: false, isDemo: false, guests: [], items: [], tasks: [], expenses: [], baseline: null };
}
