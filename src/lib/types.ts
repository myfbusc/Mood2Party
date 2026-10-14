// ─────────────────────────────────────────────────────────────
// Mood2Party — shared types (single source of truth)
// ─────────────────────────────────────────────────────────────

/** 'unresponsive' is kept only so older saved plans load; it counts as 'maybe' ("Not sure yet"). */
export type RSVPStatus = 'confirmed' | 'maybe' | 'unresponsive' | 'declined';

export interface GuestGroup {
  id: string;
  name: string;
  adults: number;
  children: number;
  status: RSVPStatus;
  note?: string;
  plusOnes?: number; // extra adults the group may bring, counted as adults
  dietary?: string; // e.g. "vegetarian, halal"
  allergies?: string; // e.g. "peanuts"
  rsvpId?: string; // the reply from the RSVP link this group came from
  rsvpAt?: number; // when that reply was last sent
}

export type FoodFormat = 'buffet' | 'taco-bar' | 'bbq' | 'appetizers' | 'potluck';
export type Setting = 'indoors' | 'outdoors';

export interface EventInfo {
  name: string;
  type: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationHrs: number;
  venue: string;
  setting: Setting;
  venueCapacity: number;
  foodFormat: FoodFormat;
  dietary: string;
  theme: string;
  budget: number;
  helpers: string[];
  rsvpDeadline: string; // YYYY-MM-DD
  extraFood?: FoodFormat[]; // more food styles served alongside the main one
  alcohol?: Alcohol;
  softDrinks?: SoftDrink[];
  preferences?: string; // anything else the host wants remembered
  foodText?: string; // food in the host's own words ("BBQ, pupusas, cupcakes"); drives the menu items
  drinksText?: string; // drinks in the host's own words ("lemonade, beer")
}

export type Alcohol = 'none' | 'beer-wine' | 'full-bar' | 'byob';
export type SoftDrink = 'soda' | 'water' | 'juice' | 'coffee-tea';

/** Used for attendance scenarios before any RSVPs are entered. */
export interface GuestEstimate {
  min: number;
  expected: number;
  max: number;
  childPct: number; // 0..100 (older plans; used when children is not set)
  children?: number; // how many of the guests are children
}

export interface TurnoutWeights {
  maybe: number; // 0..1, share of "Not sure yet" guests expected to come
  unresponsive: number; // 0..1, no longer used (kept equal to maybe)
}

export type PlanningBasis = 'min' | 'expected' | 'max' | 'custom';

export interface Headcount {
  total: number;
  adults: number;
  children: number;
}

export type Category = 'food' | 'tableware' | 'decorations' | 'supplies';
/** Every item is essential unless the user marks it optional (nice to have, can be skipped if over budget). */
export type Priority = 'essential' | 'optional';
/** 'own' is a supplier the user typed in (a caterer, a local bakery, a rental shop); its name is on the option. */
export type RetailerId = 'costco' | 'target' | 'amazon' | 'instacart' | 'own';
export type Channel = 'in-store' | 'online' | 'delivery' | 'pickup' | 'vendor' | 'rental';

export type Rule =
  | { kind: 'per-guest'; perAdult: number; perChild: number; perHour?: boolean; buffer?: number; min?: number }
  | { kind: 'per-n'; n: number; min?: number }
  | { kind: 'fixed'; qty: number };

export interface RetailerOption {
  retailer: RetailerId;
  product: string;
  packQty: number; // units (same unit as the item) per package
  packLabel: string; // e.g. "40-pack"
  packPrice: number;
  supplier?: string; // name of the user's own supplier (retailer 'own')
  channel?: Channel; // how it is bought from that supplier
}

export interface PlanItem {
  id: string;
  name: string;
  category: Category;
  priority: Priority;
  unit: string;
  rule: Rule;
  ruleText: string;
  options: RetailerOption[];
  retailer: RetailerId;
  qtyOverride: number | null; // user-edited quantity
  overrideAtRec: number | null; // recommendation at the time the user overrode it
  ownedQty: number;
  removed: boolean;
  purchasedPkgs: number; // packages already bought (0 = not purchased)
  notes?: string; // the host's own notes (brand, size, where to pick it up)
  paidAmount?: number; // what was actually paid for the packages bought (replaces the estimate)
  buyer: string;
  source: 'plan' | 'user' | 'inspiration';
  priceNote?: string; // e.g. "User estimate"
  tag?: 'outdoor' | 'kids' | 'menu' | 'vendor';
  removedReason?: 'not-needed' | 'venue' | 'vendor'; // why it is off the list (none = just removed)
  coveredBy?: string; // vendor that handles it, when removedReason is 'vendor'
}

export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

export interface Task {
  id: string;
  title: string;
  category: string;
  owner: string;
  dueDate: string; // YYYY-MM-DD
  status: TaskStatus;
  priority: 'high' | 'medium' | 'low';
  blocker: string | null;
  affectedBy: string | null;
  needs?: string; // resources the owner needs: a car, cash, a ladder, someone's help
}

export interface OtherExpense {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  /** 'minimum': a restaurant or venue minimum spend; only the part your food and drinks don't reach is added. */
  kind?: 'cost' | 'minimum';
}

/** Snapshot of the inputs the plan was last reviewed against. */
export interface Baseline {
  headcount: Headcount;
  basis: PlanningBasis;
  reviewedAt: number;
}

export type Outcome = 'ran-out' | 'right' | 'leftover';

export interface Learnings {
  itemFactors: Record<string, number>; // multiplier by catalog id
  turnoutRatio: number | null; // actual / expected from past events
  history: { name: string; date: string; expected: number; actual: number }[];
}

export interface WrapUp {
  actualAttendance: number | null;
  outcomes: Record<string, Outcome>;
  notes: string;
  saved: boolean;
  feedbackHelped: boolean | null;
  feedbackComment: string;
}

export type OnboardingAction = 'guests' | 'basis' | 'shopping' | 'buyer' | 'purchased' | 'change' | 'task';

export interface Onboarding {
  introSeen: boolean;
  tourDone: boolean; // finished or skipped: do not prompt again
  tourCompleted?: boolean; // went through to the last step
  checklistHidden: boolean; // closed for good (only after finishing it)
  checklistCollapsed?: boolean; // minimized to a one-line bar
  did: Partial<Record<OnboardingAction, boolean>>;
}

export interface AppState {
  version: 1;
  eventId?: string; // identifies this plan in "Your events" (the sample party has none)
  started: boolean;
  isDemo: boolean;
  event: EventInfo;
  guests: GuestGroup[];
  estimate: GuestEstimate;
  weights: TurnoutWeights;
  basis: PlanningBasis;
  customCount: number;
  items: PlanItem[];
  tasks: Task[];
  expenses: OtherExpense[];
  baseline: Baseline | null;
  learnings: Learnings; // what past events taught, applied to the NEXT plan
  appliedFactors: Record<string, number>; // factors in effect for this event
  wrapUp: WrapUp;
  onboarding: Onboarding;
}
