import type { Channel, Alcohol, Category, EventInfo, FoodFormat, PlanItem, Priority, RetailerId, RetailerOption, Rule, SoftDrink } from './types';

// Sample prices for concept testing only — not live retailer data.

export interface Retailer {
  id: RetailerId;
  name: string;
  short: string;
  fee: number; // per order
  fulfillment: 'Pickup' | 'Delivery' | 'Your choice';
  timing: string;
  membership: string | null;
  sameDay: boolean;
}

export const RETAILERS: Record<RetailerId, Retailer> = {
  costco: { id: 'costco', name: 'Costco', short: 'Costco', fee: 0, fulfillment: 'Pickup', timing: 'Same-day pickup', membership: 'Membership required', sameDay: true },
  target: { id: 'target', name: 'Target', short: 'Target', fee: 9.99, fulfillment: 'Delivery', timing: 'Same-day delivery', membership: null, sameDay: true },
  amazon: { id: 'amazon', name: 'Amazon', short: 'Amazon', fee: 0, fulfillment: 'Delivery', timing: '1–2 day delivery', membership: 'Free delivery with Prime', sameDay: false },
  instacart: { id: 'instacart', name: 'Instacart (local grocery)', short: 'Instacart', fee: 9.99, fulfillment: 'Delivery', timing: 'Delivery in about 2 hours', membership: null, sameDay: true },
  own: { id: 'own', name: 'Your own supplier', short: 'Own supplier', fee: 0, fulfillment: 'Your choice', timing: 'You arrange it', membership: null, sameDay: false },
};

/** The suggested stores (the user's own suppliers are not compared across stores). */
export const RETAILER_IDS: RetailerId[] = ['costco', 'target', 'amazon', 'instacart'];

export const CHANNEL_LABEL: Record<Channel, string> = {
  'in-store': 'In store', online: 'Online order', delivery: 'Delivery', pickup: 'Pickup', vendor: 'Vendor or caterer', rental: 'Rental',
};

/** Store name for an option: the user's own supplier name, or the suggested store. */
export const storeName = (o: RetailerOption) => (o.retailer === 'own' ? o.supplier?.trim() || 'Your own supplier' : RETAILERS[o.retailer].name);
export const storeShort = (o: RetailerOption) => (o.retailer === 'own' ? o.supplier?.trim() || 'Own supplier' : RETAILERS[o.retailer].short);

/** A checklist of common things people forget, to compare against the plan. Names are matched loosely. */
export const REFERENCE_CHECKLIST: Record<Category, { name: string; match: RegExp; unit: string; outdoor?: boolean }[]> = {
  food: [
    { name: 'Ice', match: /\bice\b/i, unit: 'bags' },
    { name: 'Water', match: /water/i, unit: 'bottles' },
    { name: 'Snacks or chips', match: /snack|chip/i, unit: 'bags' },
    { name: 'Dessert or cake', match: /dessert|cake|cupcake/i, unit: 'servings' },
    { name: 'Condiments and sauces', match: /condiment|sauce|ketchup|salsa/i, unit: 'sets' },
  ],
  tableware: [
    { name: 'Plates', match: /plate/i, unit: 'plates' },
    { name: 'Cups', match: /\bcups?\b/i, unit: 'cups' },
    { name: 'Napkins', match: /napkin/i, unit: 'napkins' },
    { name: 'Cutlery', match: /cutlery|fork|utensil/i, unit: 'sets' },
    { name: 'Serving spoons and tongs', match: /serving|tongs/i, unit: 'sets' },
    { name: 'Table covers', match: /table ?cover|tablecloth|linen/i, unit: 'covers' },
  ],
  decorations: [
    { name: 'Balloons', match: /balloon/i, unit: 'balloons' },
    { name: 'Banner or sign', match: /banner|sign/i, unit: 'items' },
    { name: 'Centerpieces', match: /centerpiece|flower/i, unit: 'items' },
    { name: 'Lights or candles', match: /light|candle/i, unit: 'sets' },
  ],
  supplies: [
    { name: 'Trash bags', match: /trash|garbage/i, unit: 'bags' },
    { name: 'Cooler', match: /cooler/i, unit: 'coolers' },
    { name: 'Tables and chairs', match: /table|chair/i, unit: 'sets' },
    { name: 'Paper towels and wipes', match: /paper towel|wipe/i, unit: 'rolls' },
    { name: 'Extension cord', match: /extension|cord/i, unit: 'cords' },
    { name: 'First aid kit', match: /first aid/i, unit: 'kits' },
    { name: 'Sunscreen and bug spray', match: /sunscreen|bug/i, unit: 'items', outdoor: true },
    { name: 'Shade (canopy or umbrellas)', match: /canop|umbrella|shade|tent/i, unit: 'items', outdoor: true },
  ],
};

/** Items a venue often supplies; offered as "Venue provides it" shortcuts. */
export const VENUE_OFTEN_PROVIDES = /table|chair|linen|tablecloth|cover|plate|cup|napkin|cutlery|fork|utensil|glass|serving|canop|tent|speaker|light|cooler|trash/i;

export const CATEGORY_LABEL: Record<Category, string> = {
  food: 'Food and drinks',
  tableware: 'Tableware',
  decorations: 'Decorations',
  supplies: 'Supplies',
};

export const CATEGORIES: Category[] = ['food', 'tableware', 'decorations', 'supplies'];

export const FOOD_FORMAT_LABEL: Record<FoodFormat, string> = {
  buffet: 'Buffet (catered trays)',
  'taco-bar': 'Taco bar',
  bbq: 'BBQ / grill',
  appetizers: 'Appetizers and finger food',
  potluck: 'Potluck (guests bring dishes)',
};

/** Short names for task titles and summaries. */
export const FOOD_SHORT: Record<FoodFormat, string> = { buffet: 'catered buffet', 'taco-bar': 'taco bar', bbq: 'BBQ', appetizers: 'appetizers', potluck: 'potluck' };

const o = (retailer: RetailerId, product: string, packQty: number, packLabel: string, packPrice: number): RetailerOption => ({
  retailer, product, packQty, packLabel, packPrice,
});

export interface Template {
  id: string;
  name: string;
  category: Category;
  priority: Priority;
  unit: string;
  rule: Rule;
  ruleText: string;
  options: RetailerOption[];
  tag?: 'outdoor' | 'kids' | 'menu';
  priceNote?: string;
}

function mains(format: FoodFormat): Template {
  switch (format) {
    case 'taco-bar':
      return {
        id: 'mains', name: 'Taco bar', category: 'food', priority: 'essential', unit: 'servings',
        rule: { kind: 'per-guest', perAdult: 1.25, perChild: 0.75 },
        ruleText: '1.25 servings per adult and 0.75 per child, so hungry guests can go back for seconds',
        options: [
          o('instacart', 'Taco bar kit with proteins and toppings (serves 12)', 12, 'serves 12', 54.99),
          o('costco', 'Street taco party kit (serves 20)', 20, 'serves 20', 79.99),
        ],
      };
    case 'bbq':
      return {
        id: 'mains', name: 'Burgers, hot dogs and buns', category: 'food', priority: 'essential', unit: 'servings',
        rule: { kind: 'per-guest', perAdult: 1.5, perChild: 1 },
        ruleText: '1.5 per adult and 1 per child, because grill food goes fast',
        options: [
          o('costco', 'Burger patties and hot dogs bundle with buns (24 servings)', 24, '24 servings', 36.99),
          o('target', 'Burger patties and buns (12 servings)', 12, '12 servings', 21.99),
          o('instacart', 'Grill pack from local grocery (16 servings)', 16, '16 servings', 32.99),
        ],
      };
    case 'appetizers':
      return {
        id: 'mains', name: 'Appetizer platters', category: 'food', priority: 'essential', unit: 'servings',
        rule: { kind: 'per-guest', perAdult: 1.5, perChild: 1, perHour: false },
        ruleText: '1.5 servings per adult and 1 per child when appetizers replace a meal',
        options: [
          o('costco', 'Appetizer party platter (serves 18)', 18, 'serves 18', 44.99),
          o('instacart', 'Deli party platter (serves 12)', 12, 'serves 12', 34.99),
        ],
      };
    case 'potluck':
      return {
        id: 'mains', name: 'Main dish (host contribution)', category: 'food', priority: 'essential', unit: 'servings',
        rule: { kind: 'per-guest', perAdult: 0.5, perChild: 0.3 },
        ruleText: 'Half a serving per guest, because guests bring the rest',
        options: [
          o('costco', 'Rotisserie chicken and pasta tray (serves 16)', 16, 'serves 16', 39.99),
          o('instacart', 'Deli main-dish tray (serves 10)', 10, 'serves 10', 29.99),
        ],
      };
    default:
      return {
        id: 'mains', name: 'Main dish trays', category: 'food', priority: 'essential', unit: 'servings',
        rule: { kind: 'per-guest', perAdult: 1.25, perChild: 0.75 },
        ruleText: '1.25 servings per adult and 0.75 per child, so hungry guests can go back for seconds',
        options: [
          o('instacart', 'Catered main-dish tray (serves 10)', 10, 'serves 10', 39.99),
          o('costco', 'Deli party tray (serves 16)', 16, 'serves 16', 49.99),
        ],
      };
  }
}

// ─── Menu: extra food styles and drinks (follow the setup choices) ─────

export const ALCOHOL_LABEL: Record<Alcohol, string> = { none: 'No alcohol', 'beer-wine': 'Beer and wine', 'full-bar': 'Full bar', byob: 'Guests bring their own' };
export const SOFT_DRINK_LABEL: Record<SoftDrink, string> = { soda: 'Soda', water: 'Water', juice: 'Juice or lemonade', 'coffee-tea': 'Coffee and tea' };
export const DEFAULT_SOFT_DRINKS: SoftDrink[] = ['soda', 'water'];

const EXTRA_NAME: Record<FoodFormat, string> = {
  buffet: 'Catered trays (extra)', 'taco-bar': 'Taco bar (extra)', bbq: 'Grill food (extra)', appetizers: 'Appetizers and finger food', potluck: 'Potluck dishes (from guests)',
};

/** A second food style served alongside the main one: same products, about half the amount. */
function extraTemplate(f: FoodFormat): Template | null {
  if (f === 'potluck') return null; // guests bring it: a task, not a purchase
  const m = mains(f);
  const rule = m.rule.kind === 'per-guest' ? { ...m.rule, perAdult: +(m.rule.perAdult * 0.5).toFixed(2), perChild: +(m.rule.perChild * 0.5).toFixed(2) } : m.rule;
  return { ...m, id: `extra-${f}`, name: EXTRA_NAME[f], priority: 'essential', tag: 'menu', rule, ruleText: `About half the usual amount, because it is served alongside the main food (${m.ruleText.split(',')[0].toLowerCase()})` };
}

/** Every item the menu choices can add; ids are stable so changing a choice adds or sets aside the right item. */
export function menuTemplates(ev: Pick<EventInfo, 'foodFormat' | 'extraFood' | 'alcohol' | 'softDrinks'>): Template[] {
  const t: Template[] = [];
  for (const f of ev.extraFood ?? []) {
    if (f === ev.foodFormat) continue;
    const x = extraTemplate(f);
    if (x) t.push(x);
  }
  const soft = ev.softDrinks ?? DEFAULT_SOFT_DRINKS;
  if (soft.includes('water')) t.push({
    id: 'water', name: 'Bottled water', category: 'food', priority: 'essential', unit: 'bottles',
    rule: { kind: 'per-guest', perAdult: 0.4, perChild: 0.4, perHour: true },
    ruleText: '0.4 bottles per guest per hour of the event',
    options: [
      o('costco', 'Purified water, 16.9 oz, 40-pack', 40, '40-pack', 5.99),
      o('target', 'Purified water, 16.9 oz, 24-pack', 24, '24-pack', 4.49),
      o('amazon', 'Purified water, 16.9 oz, 32-pack', 32, '32-pack', 8.99),
    ],
  });
  if (soft.includes('soda')) t.push({
    id: 'soda', name: 'Sodas and sparkling drinks', category: 'food', priority: 'essential', unit: 'cans',
    rule: { kind: 'per-guest', perAdult: 0.35, perChild: 0.25, perHour: true },
    ruleText: '0.35 cans per adult and 0.25 per child for each hour of the event',
    options: [
      o('costco', 'Assorted soda and sparkling water, 35-pack', 35, '35-pack', 16.99),
      o('target', 'Assorted soda, 12-pack', 12, '12-pack', 7.49),
      o('instacart', 'Assorted soda, 12-pack', 12, '12-pack', 8.49),
    ],
  });
  if (soft.includes('juice')) t.push({
    id: 'juice-adults', name: 'Juice and lemonade', category: 'food', priority: 'essential', unit: 'cups', tag: 'menu',
    rule: { kind: 'per-guest', perAdult: 0.5, perChild: 0 },
    ruleText: 'Half a cup per adult (kids get juice pouches when there are children)',
    options: [o('costco', 'Lemonade, 2 x 89 oz (22 cups)', 22, '2-pack', 7.99), o('target', 'Juice, 64 oz (8 cups)', 8, '64 oz', 3.99)],
  });
  if (soft.includes('coffee-tea')) t.push({
    id: 'coffee-tea', name: 'Coffee and tea', category: 'food', priority: 'essential', unit: 'cups', tag: 'menu',
    rule: { kind: 'per-guest', perAdult: 0.6, perChild: 0 },
    ruleText: 'About 6 in 10 adults have a cup',
    options: [o('costco', 'Coffee and tea kit with cups (serves 40)', 40, 'serves 40', 24.99), o('target', 'Coffee carafe box (serves 12)', 12, 'serves 12', 16.99)],
  });
  const alc = ev.alcohol ?? 'none';
  const adultsOnly = 'Adults 21+ only; an adult with ID buys it';
  if (alc === 'beer-wine' || alc === 'full-bar') {
    t.push({
      id: 'beer', name: 'Beer', category: 'food', priority: 'essential', unit: 'cans', tag: 'menu',
      rule: { kind: 'per-guest', perAdult: 0.4, perChild: 0, perHour: true },
      ruleText: `0.4 cans per adult per hour, assuming about half the adults drink beer. ${adultsOnly}`,
      options: [o('costco', 'Beer variety pack, 24 cans', 24, '24-pack', 24.99), o('target', 'Beer, 12 cans', 12, '12-pack', 15.99), o('instacart', 'Beer, 12 cans', 12, '12-pack', 17.49)],
    });
    t.push({
      id: 'wine', name: 'Wine', category: 'food', priority: 'essential', unit: 'bottles', tag: 'menu',
      rule: { kind: 'per-guest', perAdult: 0.1, perChild: 0, perHour: true },
      ruleText: `About 1 bottle (5 glasses) per 10 adults per hour. ${adultsOnly}`,
      options: [o('costco', 'Red and white wine, 6 bottles', 6, '6 bottles', 47.99), o('target', 'Wine, 1 bottle', 1, '1 bottle', 9.99)],
    });
  }
  if (alc === 'full-bar') t.push({
    id: 'spirits', name: 'Spirits and mixers', category: 'food', priority: 'optional', unit: 'bottles', tag: 'menu',
    rule: { kind: 'per-guest', perAdult: 0.06, perChild: 0, min: 1 },
    ruleText: `About 1 bottle per 16 adults, plus mixers. ${adultsOnly}`,
    options: [o('costco', 'Spirit, 1.75 L, with mixers', 1, '1.75 L + mixers', 34.99), o('instacart', 'Spirit, 750 ml, with mixers', 1, '750 ml + mixers', 27.99)],
  });
  if (alc === 'byob') t.push({
    id: 'byob-kit', name: 'Drink tub and bottle openers', category: 'supplies', priority: 'optional', unit: 'kits', tag: 'menu',
    rule: { kind: 'fixed', qty: 1 },
    ruleText: 'Guests bring their own drinks; a tub of ice and openers keeps them cold',
    options: [o('target', 'Party drink tub with 2 openers', 1, '1 kit', 19.99), o('amazon', 'Galvanized drink tub with openers', 1, '1 kit', 24.99)],
  });
  return t;
}

/** Ids the menu choices control (other items are left alone). */
export const MENU_IDS = [
  ...(['buffet', 'taco-bar', 'bbq', 'appetizers', 'potluck'] as FoodFormat[]).map((f) => `extra-${f}`),
  'water', 'soda', 'juice-adults', 'coffee-tea', 'beer', 'wine', 'spirits', 'byob-kit',
];

/** Adds or sets aside menu items so they match the current choices. Returns the new list and short notes. */
export function syncMenuItems(items: PlanItem[], ev: EventInfo): { items: PlanItem[]; notes: string[] } {
  const want = new Map(menuTemplates(ev).map((x) => [x.id, x]));
  const notes: string[] = [];
  let next = items.map((it) => {
    if (!MENU_IDS.includes(it.id)) return it;
    if (want.has(it.id) && it.removed) { notes.push(`Added ${it.name.toLowerCase()} back`); return { ...it, removed: false }; }
    if (!want.has(it.id) && !it.removed) { notes.push(`Set aside ${it.name.toLowerCase()}`); return { ...it, removed: true }; }
    return it;
  });
  for (const [id, tpl] of want) {
    if (!next.some((it) => it.id === id)) { next = [...next, templateToItem(tpl)]; notes.push(`Added ${tpl.name.toLowerCase()}`); }
  }
  return { items: next, notes };
}

export function buildTemplates(ev: Pick<EventInfo, 'foodFormat' | 'setting' | 'theme' | 'extraFood' | 'alcohol' | 'softDrinks'>, hasChildren: boolean): Template[] {
  const t: Template[] = [];
  const f = ev.foodFormat;
  t.push(mains(f));
  if (f !== 'appetizers') {
    t.push({
      id: 'sides', name: 'Side dishes and salads', category: 'food', priority: 'essential', unit: 'servings',
      rule: { kind: 'per-guest', perAdult: 1, perChild: 0.6 },
      ruleText: '1 serving per adult and 0.6 per child, spread across two or three dishes',
      options: [
        o('costco', 'Side salad and pasta salad trays (serves 16)', 16, 'serves 16', 24.99),
        o('instacart', 'Deli side-dish tray (serves 10)', 10, 'serves 10', 22.99),
      ],
    });
  }
  t.push({
    id: 'snacks', name: 'Chips and snacks', category: 'food', priority: 'essential', unit: 'snack bags',
    rule: { kind: 'per-guest', perAdult: 1.5, perChild: 1.5 },
    ruleText: '1.5 snack bags per guest for grazing before and after the meal',
    options: [
      o('costco', 'Variety snack box, 30 bags', 30, '30-count', 17.99),
      o('target', 'Variety snack box, 18 bags', 18, '18-count', 11.49),
      o('amazon', 'Variety snack box, 40 bags', 40, '40-count', 24.99),
    ],
  });
  t.push({
    id: 'dessert', name: 'Cake or dessert', category: 'food', priority: 'essential', unit: 'servings',
    rule: { kind: 'per-guest', perAdult: 1, perChild: 1, buffer: 0.1 },
    ruleText: '1 slice per guest plus a 10% buffer',
    options: [
      o('costco', 'Bakery half-sheet cake (serves 48)', 48, 'serves 48', 24.99),
      o('instacart', 'Bakery sheet cake (serves 30)', 30, 'serves 30', 39.99),
      o('target', 'Cupcakes, 24-count', 24, '24-count', 19.99),
    ],
  });
  t.push(...menuTemplates(ev));
  if (hasChildren) {
    t.push({
      id: 'juice', name: 'Juice pouches for kids', category: 'food', priority: 'essential', unit: 'pouches', tag: 'kids',
      rule: { kind: 'per-guest', perAdult: 0, perChild: 2 },
      ruleText: '2 per child, because pouches are easier for small hands than cups',
      options: [
        o('costco', 'Juice pouches, 40-count', 40, '40-count', 12.99),
        o('target', 'Juice pouches, 10-count', 10, '10-count', 4.49),
      ],
    });
  }
  t.push({
    id: 'ice', name: 'Ice', category: 'food', priority: 'essential', unit: 'lbs',
    rule: { kind: 'per-guest', perAdult: 1.25, perChild: 1.25 },
    ruleText: '1.25 lbs per guest for coolers and drinks',
    options: [
      o('instacart', 'Bagged ice, 10 lb', 10, '10 lb bag', 4.99),
      o('target', 'Bagged ice, 7 lb', 7, '7 lb bag', 3.29),
    ],
  });

  // Tableware
  t.push({
    id: 'plates', name: 'Dinner plates', category: 'tableware', priority: 'essential', unit: 'plates',
    rule: { kind: 'per-guest', perAdult: 1.5, perChild: 1.5 },
    ruleText: '1.5 per guest for seconds, spills and buffet refills',
    options: [
      o('costco', 'Heavy-duty paper plates, 10 in, 100-count', 100, '100-count', 14.99),
      o('target', 'Paper plates, 10 in, 50-count', 50, '50-count', 8.49),
      o('amazon', 'Compostable plates, 10 in, 50-count', 50, '50-count', 11.99),
    ],
  });
  t.push({
    id: 'dessert-plates', name: 'Dessert plates', category: 'tableware', priority: 'essential', unit: 'plates',
    rule: { kind: 'per-guest', perAdult: 1.1, perChild: 1.1 },
    ruleText: '1.1 per guest for cake and snacks',
    options: [
      o('costco', 'Paper dessert plates, 7 in, 150-count', 150, '150-count', 12.99),
      o('target', 'Paper dessert plates, 7 in, 40-count', 40, '40-count', 4.99),
    ],
  });
  t.push({
    id: 'cups', name: 'Cups', category: 'tableware', priority: 'essential', unit: 'cups',
    rule: { kind: 'per-guest', perAdult: 2, perChild: 2 },
    ruleText: '2 per guest, since people set cups down and grab a new one',
    options: [
      o('costco', 'Plastic cups, 18 oz, 240-count', 240, '240-count', 17.99),
      o('target', 'Plastic cups, 18 oz, 50-count', 50, '50-count', 5.99),
      o('amazon', 'Plastic cups, 16 oz, 100-count', 100, '100-count', 12.99),
    ],
  });
  t.push({
    id: 'cutlery', name: 'Cutlery sets', category: 'tableware', priority: 'essential', unit: 'sets',
    rule: { kind: 'per-guest', perAdult: 1.25, perChild: 1.25 },
    ruleText: '1.25 sets per guest to cover dropped forks and seconds',
    options: [
      o('costco', 'Plastic cutlery, 120 sets', 120, '120 sets', 19.99),
      o('amazon', 'Plastic cutlery, 50 sets', 50, '50 sets', 13.99),
      o('target', 'Plastic cutlery, 24 sets', 24, '24 sets', 6.99),
    ],
  });
  t.push({
    id: 'napkins', name: 'Napkins', category: 'tableware', priority: 'essential', unit: 'napkins',
    rule: { kind: 'per-guest', perAdult: 3, perChild: 3 },
    ruleText: '3 per guest for eating, drinks and spills',
    options: [
      o('costco', 'Paper napkins, 500-count', 500, '500-count', 12.99),
      o('target', 'Paper napkins, 200-count', 200, '200-count', 6.49),
      o('amazon', 'Paper napkins, 250-count', 250, '250-count', 9.99),
    ],
  });
  t.push({
    id: 'serving-utensils', name: 'Serving utensils', category: 'tableware', priority: 'essential', unit: 'pieces',
    rule: { kind: 'fixed', qty: 6 },
    ruleText: 'About 6 for a buffet line; this does not change with guest count',
    options: [
      o('amazon', 'Serving utensil set, 12 pieces', 12, '12-piece', 15.99),
      o('target', 'Serving utensil set, 6 pieces', 6, '6-piece', 9.99),
    ],
  });

  // Decorations
  const theme = ev.theme?.trim() ? ev.theme.trim() : 'party';
  t.push({
    id: 'tablecloths', name: 'Tablecloths', category: 'decorations', priority: 'essential', unit: 'tablecloths',
    rule: { kind: 'per-n', n: 8 },
    ruleText: '1 per guest table, with 8 guests per table',
    options: [
      o('amazon', 'Plastic tablecloths, 12-pack', 12, '12-pack', 17.99),
      o('target', 'Plastic tablecloths, 4-pack', 4, '4-pack', 9.99),
    ],
  });
  t.push({
    id: 'centerpieces', name: 'Flower centerpieces', category: 'decorations', priority: 'optional', unit: 'bunches',
    rule: { kind: 'per-n', n: 8 },
    ruleText: '1 bunch per guest table, with 8 guests per table',
    options: [
      o('instacart', 'Fresh flower bunch', 1, '1 bunch', 9.99),
      o('costco', 'Fresh flower bunches, 2-pack', 2, '2-pack', 16.99),
    ],
  });
  t.push({
    id: 'balloons', name: `Balloon garland kit (${theme})`, category: 'decorations', priority: 'essential', unit: 'kits',
    rule: { kind: 'fixed', qty: 1 },
    ruleText: 'One per event; this does not change with guest count',
    options: [
      o('amazon', 'Balloon garland kit, 120 balloons', 1, '1 kit', 24.99),
      o('target', 'Balloon garland kit, 80 balloons', 1, '1 kit', 29.99),
    ],
  });
  t.push({
    id: 'banner', name: 'Banner', category: 'decorations', priority: 'essential', unit: 'banners',
    rule: { kind: 'fixed', qty: 1 },
    ruleText: 'One per event; this does not change with guest count',
    options: [
      o('amazon', 'Custom-print banner', 1, '1 banner', 12.99),
      o('target', 'Party banner', 1, '1 banner', 10.0),
    ],
  });
  t.push({
    id: 'lights', name: 'String lights', category: 'decorations', priority: 'optional', unit: 'strands',
    rule: { kind: 'fixed', qty: 2 },
    ruleText: 'Two strands to light the main area; this does not change with guest count',
    options: [
      o('amazon', 'Warm white string lights, 48 ft', 1, '1 strand', 19.99),
      o('target', 'Warm white string lights, 25 ft', 1, '1 strand', 14.99),
    ],
  });
  t.push({
    id: 'backdrop', name: 'Photo backdrop', category: 'decorations', priority: 'optional', unit: 'backdrops',
    rule: { kind: 'fixed', qty: 1 },
    ruleText: 'One per event; this does not change with guest count',
    options: [o('amazon', 'Photo backdrop with stand', 1, '1 kit', 29.99)],
  });

  // Supplies
  t.push({
    id: 'trash-bags', name: 'Trash bags', category: 'supplies', priority: 'essential', unit: 'bags',
    rule: { kind: 'per-n', n: 8, min: 3 },
    ruleText: '1 bag per 8 guests, at least 3',
    options: [
      o('costco', 'Heavy-duty trash bags, 90-count', 90, '90-count', 21.99),
      o('target', 'Heavy-duty trash bags, 40-count', 40, '40-count', 11.99),
      o('amazon', 'Heavy-duty trash bags, 50-count', 50, '50-count', 14.99),
    ],
  });
  t.push({
    id: 'paper-towels', name: 'Paper towels', category: 'supplies', priority: 'essential', unit: 'rolls',
    rule: { kind: 'per-n', n: 12, min: 2 },
    ruleText: '1 roll per 12 guests, at least 2',
    options: [
      o('costco', 'Paper towels, 12 rolls', 12, '12 rolls', 22.99),
      o('target', 'Paper towels, 6 rolls', 6, '6 rolls', 10.99),
    ],
  });
  t.push({
    id: 'coolers', name: 'Coolers', category: 'supplies', priority: 'essential', unit: 'coolers',
    rule: { kind: 'per-n', n: 25, min: 1 },
    ruleText: '1 large cooler per 25 guests',
    options: [
      o('target', 'Large cooler, 48 qt', 1, '1 cooler', 29.99),
      o('amazon', 'Large cooler, 52 qt', 1, '1 cooler', 34.99),
    ],
  });
  t.push({
    id: 'containers', name: 'Food storage containers', category: 'supplies', priority: 'optional', unit: 'containers',
    rule: { kind: 'per-n', n: 4, min: 8 },
    ruleText: '1 per 4 guests for leftovers, at least 8',
    options: [o('amazon', 'Take-home containers, 20-pack', 20, '20-pack', 16.99)],
  });
  t.push({
    id: 'first-aid', name: 'First-aid kit', category: 'supplies', priority: 'optional', unit: 'kits',
    rule: { kind: 'fixed', qty: 1 },
    ruleText: 'One per event',
    options: [
      o('target', 'First-aid kit, 100 pieces', 1, '1 kit', 12.99),
      o('amazon', 'First-aid kit, 160 pieces', 1, '1 kit', 15.99),
    ],
  });
  t.push({
    id: 'canopies', name: 'Pop-up canopies for shade', category: 'supplies', priority: 'essential', unit: 'canopies', tag: 'outdoor',
    rule: { kind: 'per-n', n: 20, min: 1 },
    ruleText: '1 canopy (10 × 10 ft) per 20 guests for outdoor shade',
    options: [
      o('amazon', 'Pop-up canopy, 10 × 10 ft', 1, '1 canopy', 89.99),
      o('costco', 'Pop-up canopy, 10 × 10 ft', 1, '1 canopy', 99.99),
    ],
  });
  t.push({
    id: 'sun-kit', name: 'Sunscreen and bug spray', category: 'supplies', priority: 'optional', unit: 'kits', tag: 'outdoor',
    rule: { kind: 'fixed', qty: 1 },
    ruleText: 'One shared kit for an outdoor event',
    options: [
      o('target', 'Sunscreen and bug spray bundle', 1, '1 bundle', 14.99),
      o('amazon', 'Sunscreen and bug spray bundle', 1, '1 bundle', 17.49),
    ],
  });

  return t.filter((x) => (x.tag === 'outdoor' ? ev.setting === 'outdoors' : true));
}

export function templateToItem(t: Template): PlanItem {
  return {
    ...t,
    retailer: t.options[0].retailer,
    qtyOverride: null,
    overrideAtRec: null,
    ownedQty: 0,
    removed: false,
    purchasedPkgs: 0,
    buyer: '',
    source: 'plan',
  };
}

export function buildItems(ev: EventInfo, hasChildren: boolean): PlanItem[] {
  return buildTemplates(ev, hasChildren).map(templateToItem);
}

/** Templates that depend on the setting, used when the event moves indoors/outdoors. */
export function outdoorTemplates(ev: EventInfo): Template[] {
  return buildTemplates({ ...ev, setting: 'outdoors' }, false).filter((t) => t.tag === 'outdoor');
}

export function juiceTemplate(ev: EventInfo): Template | undefined {
  return buildTemplates(ev, true).find((t) => t.id === 'juice');
}
