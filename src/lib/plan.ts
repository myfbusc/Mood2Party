import { RETAILERS, RETAILER_IDS } from './catalog';
import type { AppState, Category, EventInfo, Headcount, PlanItem, RetailerId, RetailerOption, Task } from './types';

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** System recommendation for one item at a headcount (before the user's own edits). */
export function recommendQty(item: PlanItem, h: Headcount, ev: Pick<EventInfo, 'durationHrs'>, factors?: Record<string, number>): number {
  const r = item.rule;
  let q: number;
  if (r.kind === 'fixed') return r.qty;
  if (r.kind === 'per-n') {
    q = Math.ceil(h.total / r.n);
    q = Math.max(r.min ?? 0, q);
  } else {
    const hours = r.perHour ? Math.max(1, ev.durationHrs || 1) : 1;
    q = (h.adults * r.perAdult + h.children * r.perChild) * hours * (1 + (r.buffer ?? 0));
    q = Math.ceil(q - 1e-9);
    q = Math.max(r.min ?? 0, q);
  }
  const f = factors?.[item.id];
  if (f && f !== 1 && item.source === 'plan') q = Math.ceil(q * f - 1e-9);
  return q;
}

export function optionFor(item: PlanItem, retailer?: RetailerId): RetailerOption {
  return item.options.find((x) => x.retailer === (retailer ?? item.retailer)) ?? item.options[0];
}

export type LineStatus = 'removed' | 'owned' | 'to-buy' | 'purchased' | 'buy-more';

export interface Line {
  item: PlanItem;
  rec: number; // system recommendation
  need: number; // quantity the plan uses (user's quantity if edited)
  toBuy: number; // need minus owned
  opt: RetailerOption;
  pkgs: number;
  received: number;
  leftover: number;
  cost: number; // pkgs * packPrice
  status: LineStatus;
  morePkgs: number; // packages still to buy after previous purchases
  spent: number; // what was paid for packages already purchased (actual if entered, otherwise the estimate)
  paidEntered: boolean; // the actual amount paid was entered
  conflict: boolean; // user quantity differs from an updated recommendation
}

export function computeLine(item: PlanItem, h: Headcount, ev: Pick<EventInfo, 'durationHrs'>, factors?: Record<string, number>, retailer?: RetailerId): Line {
  const rec = recommendQty(item, h, ev, factors);
  const need = item.qtyOverride ?? rec;
  const toBuy = Math.max(0, need - item.ownedQty);
  const opt = optionFor(item, retailer);
  const pkgs = toBuy > 0 ? Math.ceil(toBuy / opt.packQty) : 0;
  const received = pkgs * opt.packQty;
  const morePkgs = Math.max(0, pkgs - item.purchasedPkgs);
  // Once bought, the amount actually paid replaces the estimate for those packages.
  const paid = item.purchasedPkgs > 0 && typeof item.paidAmount === 'number' && isFinite(item.paidAmount) ? Math.max(0, item.paidAmount) : null;
  const cost = item.removed ? 0 : paid !== null ? round2(paid + morePkgs * opt.packPrice) : round2(Math.max(pkgs, item.purchasedPkgs) * opt.packPrice);
  let status: LineStatus;
  if (item.removed) status = 'removed';
  else if (toBuy === 0) status = 'owned';
  else if (item.purchasedPkgs === 0) status = 'to-buy';
  else if (morePkgs > 0) status = 'buy-more';
  else status = 'purchased';
  const spent = item.removed ? 0 : paid !== null ? round2(paid) : round2(item.purchasedPkgs * opt.packPrice);
  return {
    item, rec, need, toBuy, opt, pkgs, received,
    leftover: received - toBuy,
    cost,
    status,
    morePkgs,
    spent,
    paidEntered: paid !== null,
    conflict: item.qtyOverride !== null && item.overrideAtRec !== null && item.overrideAtRec !== rec,
  };
}

export interface PlanTotals {
  lines: Line[];
  active: Line[]; // not removed
  itemsSubtotal: number;
  fees: Partial<Record<RetailerId, number>>;
  feeTotal: number;
  shoppingTotal: number;
  byCategory: Record<Category, number>;
  byRetailer: Partial<Record<RetailerId, number>>;
  spent: number; // purchased items
  otherTotal: number;
  otherPaid: number;
  grandTotal: number; // shopping + other expenses
  remaining: number; // budget - grandTotal (is the whole plan within budget?)
  spentAll: number; // purchased items + paid other costs
  leftToSpend: number; // budget - spentAll (goes down as things are bought)
  counts: { toBuy: number; purchased: number; buyMore: number; owned: number; removed: number; active: number };
  estimatedBought: number; // bought items with no actual amount entered yet
  expenseCost: (e: AppState['expenses'][number]) => number;
}

export function computePlan(s: Pick<AppState, 'items' | 'event' | 'appliedFactors' | 'expenses'>, h: Headcount, retailerMap?: Partial<Record<string, RetailerId>>): PlanTotals {
  const lines = s.items.map((it) => computeLine(it, h, s.event, s.appliedFactors, retailerMap?.[it.id]));
  const active = lines.filter((l) => !l.item.removed);
  const byCategory: Record<Category, number> = { food: 0, tableware: 0, decorations: 0, supplies: 0 };
  const byRetailer: Partial<Record<RetailerId, number>> = {};
  let itemsSubtotal = 0;
  let spent = 0;
  for (const l of active) {
    itemsSubtotal += l.cost;
    byCategory[l.item.category] += l.cost;
    if (l.cost > 0) byRetailer[l.opt.retailer] = (byRetailer[l.opt.retailer] ?? 0) + l.cost;
    spent += l.spent;
  }
  const fees: Partial<Record<RetailerId, number>> = {};
  let feeTotal = 0;
  for (const r of Object.keys(byRetailer) as RetailerId[]) {
    fees[r] = RETAILERS[r].fee;
    feeTotal += RETAILERS[r].fee;
  }
  itemsSubtotal = round2(itemsSubtotal);
  const shoppingTotal = round2(itemsSubtotal + feeTotal);
  const expenseCost = (e: AppState['expenses'][number]) => {
    const amt = Number(e.amount) || 0;
    // A minimum spend only adds what food and drinks don't already reach.
    return e.kind === 'minimum' ? round2(Math.max(0, amt - byCategory.food)) : amt;
  };
  const otherTotal = round2(s.expenses.reduce((a, e) => a + expenseCost(e), 0));
  const otherPaid = round2(s.expenses.filter((e) => e.paid).reduce((a, e) => a + expenseCost(e), 0));
  const estimatedBought = active.filter((l) => l.item.purchasedPkgs > 0 && !l.paidEntered).length;
  const grandTotal = round2(shoppingTotal + otherTotal);
  const counts = {
    toBuy: active.filter((l) => l.status === 'to-buy').length,
    purchased: active.filter((l) => l.status === 'purchased').length,
    buyMore: active.filter((l) => l.status === 'buy-more').length,
    owned: active.filter((l) => l.status === 'owned').length,
    removed: lines.length - active.length,
    active: active.length,
  };
  return {
    lines, active, itemsSubtotal, fees, feeTotal, shoppingTotal, byCategory, byRetailer,
    spent: round2(spent), otherTotal, otherPaid, grandTotal,
    remaining: round2(s.event.budget - grandTotal),
    spentAll: round2(spent + otherPaid),
    leftToSpend: round2(s.event.budget - spent - otherPaid),
    counts,
    estimatedBought,
    expenseCost,
  };
}

// ─── Shopping strategies ────────────────────────────────────────────────

export interface Strategy {
  id: 'current' | 'lowest' | 'fewest' | 'fastest';
  label: string;
  advantage: string;
  tradeoff: string;
  complete: boolean;
  missing: string[];
  assignment: Record<string, RetailerId>;
  stores: { retailer: RetailerId; items: string[]; subtotal: number; fee: number }[];
  itemsSubtotal: number;
  feeTotal: number;
  total: number;
}

function evaluateSubset(lines: Line[], subset: RetailerId[]) {
  const assignment: Record<string, RetailerId> = {};
  const missing: string[] = [];
  const stores = new Map<RetailerId, { items: string[]; subtotal: number }>();
  for (const l of lines) {
    let best: { r: RetailerId; cost: number } | null = null;
    for (const opt of l.item.options) {
      if (!subset.includes(opt.retailer)) continue;
      const c = round2(Math.ceil(l.toBuy / opt.packQty) * opt.packPrice);
      if (!best || c < best.cost - 1e-9) best = { r: opt.retailer, cost: c };
    }
    if (!best) {
      missing.push(l.item.name);
      continue;
    }
    assignment[l.item.id] = best.r;
    const s = stores.get(best.r) ?? { items: [], subtotal: 0 };
    s.items.push(l.item.name);
    s.subtotal = round2(s.subtotal + best.cost);
    stores.set(best.r, s);
  }
  const storeList = [...stores.entries()].map(([retailer, v]) => ({ retailer, ...v, fee: RETAILERS[retailer].fee }));
  const itemsSubtotal = round2(storeList.reduce((a, s) => a + s.subtotal, 0));
  const feeTotal = round2(storeList.reduce((a, s) => a + s.fee, 0));
  return { assignment, missing, stores: storeList, itemsSubtotal, feeTotal, total: round2(itemsSubtotal + feeTotal) };
}

function subsets<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let m = 1; m < 1 << arr.length; m++) out.push(arr.filter((_, i) => m & (1 << i)));
  return out;
}

/** Strategies cover only what still needs buying: active lines with packages to buy and nothing purchased yet. */
export function computeStrategies(plan: PlanTotals): Strategy[] {
  // Items from the user's own suppliers stay where they are; only suggested stores are compared.
  const lines = plan.active.filter((l) => l.pkgs > 0 && l.item.purchasedPkgs === 0 && l.opt.retailer !== 'own' && l.item.options.some((o) => o.retailer !== 'own'));
  const currentAssign: Record<string, RetailerId> = {};
  const currentStores = new Map<RetailerId, { items: string[]; subtotal: number }>();
  for (const l of lines) {
    currentAssign[l.item.id] = l.opt.retailer;
    const s = currentStores.get(l.opt.retailer) ?? { items: [], subtotal: 0 };
    s.items.push(l.item.name);
    s.subtotal = round2(s.subtotal + l.cost);
    currentStores.set(l.opt.retailer, s);
  }
  const curStoreList = [...currentStores.entries()].map(([retailer, v]) => ({ retailer, ...v, fee: RETAILERS[retailer].fee }));
  const curSub = round2(curStoreList.reduce((a, s) => a + s.subtotal, 0));
  const curFee = round2(curStoreList.reduce((a, s) => a + s.fee, 0));
  const current: Strategy = {
    id: 'current', label: 'Your current plan', advantage: 'No changes to the stores you picked', tradeoff: 'May not be the lowest cost',
    complete: true, missing: [], assignment: currentAssign, stores: curStoreList,
    itemsSubtotal: curSub, feeTotal: curFee, total: round2(curSub + curFee),
  };

  const all = subsets(RETAILER_IDS).map((sub) => ({ sub, ...evaluateSubset(lines, sub) }));
  const complete = all.filter((x) => x.missing.length === 0);
  const lowest = complete.reduce((a, b) => (b.total < a.total - 1e-9 ? b : a), complete[0]);
  const minStores = Math.min(...complete.map((x) => x.stores.length));
  const fewest = complete.filter((x) => x.stores.length === minStores).reduce((a, b) => (b.total < a.total - 1e-9 ? b : a));
  const fast = evaluateSubset(lines, RETAILER_IDS.filter((r) => RETAILERS[r].sameDay));

  const pick = (x: ReturnType<typeof evaluateSubset>) => ({
    complete: x.missing.length === 0, missing: x.missing, assignment: x.assignment, stores: x.stores,
    itemsSubtotal: x.itemsSubtotal, feeTotal: x.feeTotal, total: x.total,
  });
  const n = (k: number) => (k === 1 ? 'one store' : `${k} stores`);
  return [
    current,
    {
      id: 'lowest', label: 'Lowest total cost',
      advantage: `Cheapest way to buy everything, using ${n(lowest.stores.length)}`,
      tradeoff: lowest.stores.length > 1 ? 'More trips or deliveries to coordinate' : 'None',
      ...pick(lowest),
    },
    {
      id: 'fewest', label: minStores === 1 ? 'One-store plan' : `Fewest stores (${minStores})`,
      advantage: 'Fewest orders to place and track',
      tradeoff: 'May cost more than the lowest-cost mix',
      ...pick(fewest),
    },
    {
      id: 'fastest', label: 'Fastest (same day)',
      advantage: 'Everything can arrive or be picked up the same day',
      tradeoff: 'Skips Amazon, so some items may cost more or be unavailable',
      ...pick(fast),
    },
  ];
}

// ─── Change impact ──────────────────────────────────────────────────────

export type ImpactKind = 'buy-more' | 'sufficient' | 'reduced' | 'unchanged' | 'owned' | 'removed';

export interface ImpactRow {
  item: PlanItem;
  before: Line;
  after: Line;
  kind: ImpactKind;
  costDelta: number;
}

export interface Impact {
  from: Headcount;
  to: Headcount;
  rows: ImpactRow[];
  beforeTotal: number;
  afterTotal: number;
  delta: number;
  tablesFrom: number;
  tablesTo: number;
  conflicts: Line[];
  tasks: Task[]; // tasks that should be re-checked
}

export const tablesFor = (guests: number) => Math.ceil(guests / 8);

const HEADCOUNT_WORDS = /headcount|food|drinks|cake|dessert|tables and chairs|tableware|seating/i;

export function computeImpact(s: AppState, from: Headcount, to: Headcount): Impact {
  const before = computePlan(s, from);
  const after = computePlan(s, to);
  const rows: ImpactRow[] = after.lines.map((a, i) => {
    const b = before.lines[i];
    let kind: ImpactKind;
    if (a.item.removed) kind = 'removed';
    else if (a.toBuy === 0 && a.item.ownedQty > 0) kind = 'owned';
    else if (a.pkgs > b.pkgs) kind = 'buy-more';
    else if (a.need > b.need) kind = 'sufficient';
    else if (a.need < b.need) kind = 'reduced';
    else kind = 'unchanged';
    return { item: a.item, before: b, after: a, kind, costDelta: round2(a.cost - b.cost) };
  });
  const changed = from.total !== to.total || from.adults !== to.adults;
  const tasks = changed
    ? s.tasks.filter((t) => t.status !== 'done' && !t.affectedBy && HEADCOUNT_WORDS.test(t.title))
    : [];
  return {
    from, to, rows,
    beforeTotal: before.grandTotal,
    afterTotal: after.grandTotal,
    delta: round2(after.grandTotal - before.grandTotal),
    tablesFrom: tablesFor(from.total),
    tablesTo: tablesFor(to.total),
    conflicts: after.active.filter((l) => l.conflict),
    tasks,
  };
}

export function sameHeadcount(a: Headcount, b: Headcount) {
  return a.total === b.total && a.adults === b.adults && a.children === b.children;
}
