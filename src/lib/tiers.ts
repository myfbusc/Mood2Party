import type { Category, EventInfo, Headcount, PlanItem, RetailerId, RetailerOption, Tier } from './types';
import { computeLine } from './plan';

// Price levels: $ Basic, $$ Standard (the catalog's own products), $$$ Nicer.
// Sample prices for concept testing only — not live retailer data.

export const TIERS: Tier[] = [1, 2, 3];
export const TIER_SIGN: Record<Tier, string> = { 1: '$', 2: '$$', 3: '$$$' };
export const TIER_LABEL: Record<Tier, string> = { 1: 'Basic', 2: 'Standard', 3: 'Nicer' };

/** What each level means for a category, in a few words. */
export const TIER_HINT: Record<Category, Record<Tier, string>> = {
  food: { 1: 'Store brands and bulk packs', 2: 'Name brands and party trays', 3: 'Bakery, deli and premium picks' },
  tableware: { 1: 'Thin paper and light plastic', 2: 'Heavy-duty paper and plastic', 3: 'Gold-rim plates, sturdy cutlery, nicer cups' },
  decorations: { 1: 'A few simple touches', 2: 'Balloon garland, banner, tablecloths', 3: 'Florist flowers, arches, fabric linens' },
  supplies: { 1: 'Store brands', 2: 'Name brands', 3: 'Heavy-duty and longer-lasting' },
};

export const SPEND_CATEGORIES: Category[] = ['food', 'tableware', 'decorations', 'supplies'];

const o = (retailer: RetailerId, product: string, packQty: number, packLabel: string, packPrice: number): RetailerOption => ({ retailer, product, packQty, packLabel, packPrice });

/** Real products for the levels of the items where the difference shows most. Level 2 is the item's own options. */
const VARIANTS: Record<string, Partial<Record<Tier, RetailerOption[]>>> = {
  plates: {
    1: [o('costco', 'Basic paper plates, 9 in, 150-count', 150, '150-count', 9.99), o('target', 'Basic paper plates, 9 in, 50-count', 50, '50-count', 3.99)],
    3: [o('amazon', 'Plastic plates with gold rim, 10 in, 50-count', 50, '50-count', 29.99), o('costco', 'Palm leaf plates, 10 in, 100-count', 100, '100-count', 44.99)],
  },
  'dessert-plates': {
    1: [o('costco', 'Basic paper dessert plates, 7 in, 200-count', 200, '200-count', 8.99), o('target', 'Basic paper dessert plates, 7 in, 40-count', 40, '40-count', 2.99)],
    3: [o('amazon', 'Plastic dessert plates with gold rim, 7 in, 50-count', 50, '50-count', 19.99), o('costco', 'Palm leaf dessert plates, 7 in, 100-count', 100, '100-count', 29.99)],
  },
  cups: {
    1: [o('costco', 'Basic plastic cups, 16 oz, 240-count', 240, '240-count', 12.99), o('target', 'Basic plastic cups, 16 oz, 50-count', 50, '50-count', 3.99)],
    3: [o('amazon', 'Clear tumblers with gold rim, 12 oz, 50-count', 50, '50-count', 24.99), o('target', 'Clear hard-plastic tumblers, 10 oz, 40-count', 40, '40-count', 14.99)],
  },
  cutlery: {
    1: [o('costco', 'Light plastic cutlery, 180 sets', 180, '180 sets', 16.99), o('target', 'Light plastic cutlery, 24 sets', 24, '24 sets', 3.99)],
    3: [o('amazon', 'Gold-look heavy plastic cutlery, 40 sets', 40, '40 sets', 26.99), o('target', 'Silver-look heavy plastic cutlery, 24 sets', 24, '24 sets', 14.99), o('costco', 'Birchwood cutlery, 100 sets', 100, '100 sets', 39.99)],
  },
  napkins: {
    1: [o('costco', 'Basic 1-ply napkins, 1000-count', 1000, '1000-count', 11.99), o('target', 'Basic 1-ply napkins, 250-count', 250, '250-count', 3.99)],
    3: [o('amazon', 'Linen-feel napkins, 100-count', 100, '100-count', 21.99), o('target', 'Printed 3-ply napkins, 60-count', 60, '60-count', 6.99)],
  },
  'serving-utensils': {
    1: [o('target', 'Plastic serving utensils, 6 pieces', 6, '6-piece', 5.99), o('amazon', 'Plastic serving utensils, 12 pieces', 12, '12-piece', 9.99)],
    3: [o('amazon', 'Stainless steel serving set, 12 pieces', 12, '12-piece', 29.99), o('target', 'Stainless steel serving set, 6 pieces', 6, '6-piece', 19.99)],
  },
  tablecloths: {
    1: [o('amazon', 'Thin plastic tablecloths, 12-pack', 12, '12-pack', 11.99), o('target', 'Thin plastic tablecloths, 4-pack', 4, '4-pack', 5.99)],
    3: [o('amazon', 'Polyester fabric tablecloths, 4-pack', 4, '4-pack', 39.99), o('target', 'Fabric tablecloth', 1, '1 tablecloth', 14.99)],
  },
  centerpieces: {
    1: [o('instacart', 'Grocery greenery bunch', 1, '1 bunch', 4.99), o('amazon', 'Tea lights and glass holders, 12-pack', 12, '12-pack', 14.99)],
    3: [o('instacart', 'Florist centerpiece arrangement', 1, '1 arrangement', 34.99), o('costco', 'Premium rose bunches, 2-pack', 2, '2-pack', 39.99)],
  },
  balloons: {
    1: [o('amazon', 'Latex balloons, 50-pack', 1, '1 pack', 8.99), o('target', 'Latex balloons, 30-pack', 1, '1 pack', 6.99)],
    3: [o('amazon', 'Balloon arch kit with foil accents, 180 balloons', 1, '1 kit', 49.99), o('target', 'Balloon arch kit with stand', 1, '1 kit', 59.99)],
  },
  banner: {
    1: [o('target', 'Party banner', 1, '1 banner', 5.0), o('amazon', 'Letter banner', 1, '1 banner', 6.99)],
    3: [o('amazon', 'Custom vinyl banner, 6 ft', 1, '1 banner', 39.99), o('target', 'Glitter letter banner', 1, '1 banner', 15.0)],
  },
  lights: {
    1: [o('amazon', 'LED fairy lights, 33 ft', 1, '1 strand', 9.99), o('target', 'String lights, 20 ft', 1, '1 strand', 7.99)],
    3: [o('amazon', 'Edison bulb string lights, 48 ft', 1, '1 strand', 39.99), o('costco', 'Commercial-grade LED string lights, 48 ft', 1, '1 strand', 34.99)],
  },
  backdrop: {
    1: [o('amazon', 'Metallic fringe curtain backdrop', 1, '1 kit', 9.99)],
    3: [o('amazon', 'Flower wall backdrop panels', 1, '1 kit', 79.99)],
  },
  dessert: {
    1: [o('costco', 'Grocery sheet cake (serves 48)', 48, 'serves 48', 19.99), o('target', 'Store-brand cupcakes, 24-count', 24, '24-count', 14.99), o('instacart', 'Grocery sheet cake (serves 30)', 30, 'serves 30', 29.99)],
    3: [o('instacart', 'Bakery custom cake (serves 24)', 24, 'serves 24', 74.99), o('costco', 'Bakery sheet cake with custom design (serves 48)', 48, 'serves 48', 59.99)],
  },
};

/** Items priced by level with a simple price step (store brand vs. premium) where no product list is above. */
const SCALED = new Set(['mains', 'sides', 'snacks', 'dessert', 'juice', 'juice-adults', 'soda', 'coffee-tea', 'beer', 'wine', 'spirits', 'trash-bags', 'paper-towels', 'coolers', 'containers', 'canopies']);
const FACTOR: Record<Category, Record<Tier, number>> = {
  food: { 1: 0.8, 2: 1, 3: 1.45 },
  tableware: { 1: 0.65, 2: 1, 3: 2 },
  decorations: { 1: 0.5, 2: 1, 3: 2.2 },
  supplies: { 1: 0.8, 2: 1, 3: 1.35 },
};

/** Whether an item has price levels. */
export const hasLevels = (it: Pick<PlanItem, 'id' | 'source'>) => it.source === 'plan' && (it.id in VARIANTS || SCALED.has(it.id));

const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** The suggested-store options for an item at a level, from its standard options. */
export function optionsAtTier(id: string, category: Category, std: RetailerOption[], tier: Tier): RetailerOption[] {
  if (tier === 2) return std;
  const v = VARIANTS[id]?.[tier];
  if (v) return v;
  const f = FACTOR[category][tier];
  return std.map((x) => ({
    ...x,
    product: `${tier === 1 ? 'Store-brand' : 'Premium'} ${lower(x.product.replace(/^(?:Store-brand|Premium)\s+/i, ''))}`,
    packPrice: Math.round(x.packPrice * f * 100) / 100,
  }));
}

/** A level as $ signs: "$$", or "$–$$" for a mix. */
export function levelText(p: number): string {
  const r = Math.round(p * 100) / 100;
  if (Number.isInteger(r)) return TIER_SIGN[r as Tier];
  return `${TIER_SIGN[Math.floor(r) as Tier]}–${TIER_SIGN[Math.ceil(r) as Tier]}`;
}
export function levelName(p: number): string {
  const r = Math.round(p * 100) / 100;
  if (Number.isInteger(r)) return TIER_LABEL[r as Tier];
  return `Mix of ${TIER_LABEL[Math.floor(r) as Tier].toLowerCase()} and ${TIER_LABEL[Math.ceil(r) as Tier].toLowerCase()}`;
}

/** What an item costs at a level, for the plan's current guest count. */
export type CostFn = (it: PlanItem, t: Tier) => number;
export const costFnFor = (ev: Pick<EventInfo, 'durationHrs'>, factors: Record<string, number> | undefined, head: Headcount): CostFn =>
  (it, t) => computeLine(itemAtTier(it, t), head, ev, factors).cost;

/** Puts one item at a level, keeping the host's own supplier and anything already bought. */
export function itemAtTier(it: PlanItem, tier: Tier, pinned = it.tierPinned): PlanItem {
  if (!hasLevels(it)) return it;
  const std = it.stdOptions ?? it.options.filter((x) => x.retailer !== 'own');
  const own = it.options.filter((x) => x.retailer === 'own');
  const options = [...optionsAtTier(it.id, it.category, std, tier), ...own];
  const retailer = options.some((x) => x.retailer === it.retailer) ? it.retailer : options[0].retailer;
  return { ...it, options, retailer, tier, stdOptions: std, tierPinned: pinned || undefined };
}

const movable = (it: PlanItem) => hasLevels(it) && it.purchasedPkgs === 0 && !/your price/i.test(it.priceNote ?? '') && !it.tierPinned;

/**
 * Applies the event's spending levels. A whole level ($, $$, $$$) puts every item there; a level in between
 * moves the items that get closest to the matching cost, so the slider can sit anywhere.
 * Bought items, hand-typed prices and items set on their own keep theirs.
 */
export function applySpend(items: PlanItem[], ev: Pick<EventInfo, 'spend'>, cost?: CostFn): PlanItem[] {
  const want = new Map<string, Tier>();
  for (const c of SPEND_CATEGORIES) {
    const p = Math.min(3, Math.max(1, ev.spend?.[c] ?? 2));
    const group = items.filter((it) => it.category === c && movable(it) && !it.removed);
    const lo = Math.floor(p) as Tier;
    const hi = Math.ceil(p) as Tier;
    if (lo === hi || !cost) { for (const it of group) want.set(it.id, Math.round(p) as Tier); continue; }
    const rows = group.map((it) => ({ it, a: cost(it, lo), d: cost(it, hi) - cost(it, lo) }));
    const base = rows.reduce((x, r) => x + r.a, 0);
    const target = base + (p - lo) * rows.reduce((x, r) => x + r.d, 0);
    let acc = base;
    for (const r of [...rows].sort((x, y) => y.d - x.d || x.it.id.localeCompare(y.it.id))) {
      const up = Math.abs(acc + r.d - target) < Math.abs(acc - target) - 1e-9;
      if (up) acc += r.d;
      want.set(r.it.id, up ? hi : lo);
    }
  }
  return items.map((it) => {
    if (!hasLevels(it) || it.purchasedPkgs > 0 || /your price/i.test(it.priceNote ?? '')) return it;
    const t = it.tierPinned && it.tier ? it.tier : want.get(it.id) ?? (Math.round(ev.spend?.[it.category] ?? 2) as Tier);
    if ((it.tier ?? 2) === t) return it;
    return itemAtTier(it, t);
  });
}

/** One example product for a category at a level, to show what the level means. */
export function exampleFor(items: PlanItem[], category: Category, level: number): string {
  const tier = Math.round(level) as Tier;
  const pick = { food: ['dessert', 'mains', 'snacks'], tableware: ['cutlery', 'plates', 'cups'], decorations: ['centerpieces', 'balloons', 'tablecloths'], supplies: ['trash-bags', 'coolers'] }[category];
  for (const id of pick) {
    const it = items.find((x) => x.id === id && !x.removed);
    if (it) {
      const opts = optionsAtTier(it.id, it.category, it.stdOptions ?? it.options.filter((x) => x.retailer !== 'own'), tier);
      if (opts[0]) return opts[0].product;
    }
  }
  return '';
}
