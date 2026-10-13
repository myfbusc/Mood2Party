// Food and drinks typed in plain words ("BBQ, pupusas, cupcakes" / "lemonade, beer") turned into the plan:
// known styles map to the built-in templates; anything else becomes its own shopping item and task.
import { FOOD_SHORT, SOFT_DRINK_LABEL, ALCOHOL_LABEL, templateToItem, type Template } from './catalog';
import { addDays } from './tasks';
import type { Alcohol, AppState, EventInfo, FoodFormat, PlanItem, RetailerOption, SoftDrink, Task } from './types';

export interface MenuEntry { key: string; label: string; kind: 'food' | 'drink' }
export interface ParsedMenu {
  foodFormat: FoodFormat;
  extraFood: FoodFormat[];
  alcohol: Alcohol;
  softDrinks: SoftDrink[];
  custom: MenuEntry[];
  /** No known food style was typed, only your own dishes: the generic "main food" item is not needed. */
  customMainOnly: boolean;
}

const FORMATS: [RegExp, FoodFormat][] = [
  [/taco/i, 'taco-bar'], [/bbq|barbecue|grill|burger|hot ?dog|cookout/i, 'bbq'], [/potluck|bring a dish/i, 'potluck'],
  [/appetizer|finger food|hors d|light bites|canap/i, 'appetizers'], [/buffet|cater/i, 'buffet'],
];
/** Words already covered by built-in items (dessert, snacks, drinks, ice), so they don't become duplicates. */
const COVERED_FOOD = /^(?:cake|birthday cake|dessert|desserts|snacks?|chips|chips and dip|chips and salsa|side dishes|sides|food)$/i;

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "tacos, cupcakes and lemonade" → ["tacos", "cupcakes", "lemonade"] */
export function splitList(text: string): string[] {
  return text
    .split(/\n|,|;|\/|\+|&|\band\b|\bplus\b|\bwith\b/i)
    .map((x) => x.replace(/^(?:some|a few|lots of|a|an|the)\s+/i, '').replace(/[.!]+$/, '').trim())
    .filter((x) => x.length > 1 && x.length <= 60);
}

export function parseMenu(foodText: string, drinksText: string): ParsedMenu {
  const custom: MenuEntry[] = [];
  const styles: FoodFormat[] = [];
  for (const entry of splitList(foodText)) {
    const hit = FORMATS.find(([re]) => re.test(entry));
    if (hit) { if (!styles.includes(hit[1])) styles.push(hit[1]); continue; }
    if (COVERED_FOOD.test(entry)) continue;
    if (!custom.some((c) => c.key === `food-${slug(entry)}`)) custom.push({ key: `food-${slug(entry)}`, label: entry, kind: 'food' });
  }

  const drinks = drinksText.trim();
  let alcohol: Alcohol = 'none';
  const softDrinks: SoftDrink[] = [];
  if (!drinks) softDrinks.push('soda', 'water');
  for (const entry of splitList(drinks)) {
    if (/no alcohol|alcohol[- ]free|\bdry\b|sober/i.test(entry)) continue;
    if (/byob|bring your own/i.test(entry)) { alcohol = 'byob'; continue; }
    if (/full bar|open bar|cocktail|spirit|liquor|margarita|tequila|vodka|rum|whiskey|mixed drink/i.test(entry)) { alcohol = 'full-bar'; continue; }
    if (/\bbeers?\b|\bwines?\b|prosecco|champagne|mimosa|sangria|hard seltzer|cider/i.test(entry)) { if (alcohol === 'none') alcohol = 'beer-wine'; continue; }
    if (/\bsoda|\bpop\b|coke|sprite|soft drink|sparkling/i.test(entry)) { if (!softDrinks.includes('soda')) softDrinks.push('soda'); continue; }
    if (/^water$|bottled water|\bwater\b(?!melon)/i.test(entry)) { if (!softDrinks.includes('water')) softDrinks.push('water'); continue; }
    if (/\bjuice/i.test(entry)) { if (!softDrinks.includes('juice')) softDrinks.push('juice'); continue; }
    if (/coffee|\btea\b(?!.*iced)/i.test(entry) && !/iced/i.test(entry)) { if (!softDrinks.includes('coffee-tea')) softDrinks.push('coffee-tea'); continue; }
    if (/^ice$/i.test(entry)) continue;
    if (!custom.some((c) => c.key === `drink-${slug(entry)}`)) custom.push({ key: `drink-${slug(entry)}`, label: entry, kind: 'drink' });
  }
  const hasCustomFood = custom.some((c) => c.kind === 'food');
  return {
    foodFormat: styles[0] ?? 'buffet',
    extraFood: styles.slice(1),
    alcohol,
    softDrinks,
    custom,
    customMainOnly: styles.length === 0 && hasCustomFood,
  };
}

/** Written versions of older plans that only had the choice lists. */
export function menuTextFromEvent(ev: EventInfo): { food: string; drinks: string } {
  const food = ev.foodText ?? [ev.foodFormat, ...(ev.extraFood ?? [])].map((f) => FOOD_SHORT[f]).join(', ');
  const drinkParts = (ev.softDrinks ?? ['soda', 'water']).map((d) => SOFT_DRINK_LABEL[d].toLowerCase());
  if (ev.alcohol && ev.alcohol !== 'none') drinkParts.push(ALCOHOL_LABEL[ev.alcohol].toLowerCase());
  return { food, drinks: ev.drinksText ?? drinkParts.join(', ') };
}

/** Common dishes and drinks with sensible amounts and sample prices; anything else gets a generic amount and no price. */
const o = (retailer: RetailerOption['retailer'], product: string, packQty: number, packLabel: string, packPrice: number): RetailerOption => ({ retailer, product, packQty, packLabel, packPrice });
const PRESETS: { re: RegExp; unit: string; perAdult: number; perChild: number; why: string; options: (label: string) => RetailerOption[] }[] = [
  { re: /pizza/i, unit: 'pizzas', perAdult: 0.375, perChild: 0.25, why: '3 slices per adult and 2 per child, 8 slices a pizza', options: () => [o('costco', 'Whole pizza (food court)', 1, '1 pizza', 9.95), o('instacart', 'Large pizza from a local shop', 1, '1 pizza', 16.99)] },
  { re: /cupcake/i, unit: 'cupcakes', perAdult: 1.2, perChild: 1, why: 'about 1 per guest, plus a few extra', options: () => [o('costco', 'Cupcakes, 24-pack', 24, '24-pack', 19.99), o('instacart', 'Bakery cupcakes, dozen', 12, 'dozen', 14.99)] },
  { re: /cookie|brownie/i, unit: 'pieces', perAdult: 2, perChild: 2, why: '2 per guest', options: (l) => [o('costco', `${cap(l)}, 24-pack`, 24, '24-pack', 11.99), o('instacart', `${cap(l)}, dozen`, 12, 'dozen', 8.99)] },
  { re: /sandwich|slider|wrap|sub\b|hoagie/i, unit: 'pieces', perAdult: 1.5, perChild: 0.75, why: '1.5 per adult and less for kids', options: (l) => [o('costco', `${cap(l)} platter (16 pieces)`, 16, '16 pieces', 39.99), o('instacart', `${cap(l)} tray (12 pieces)`, 12, '12 pieces', 34.99)] },
  { re: /fruit|veggie|vegetable|crudit/i, unit: 'servings', perAdult: 1, perChild: 1, why: '1 serving per guest', options: (l) => [o('costco', `${cap(l)} tray (serves 16)`, 16, 'serves 16', 24.99), o('instacart', `${cap(l)} platter (serves 10)`, 10, 'serves 10', 22.99)] },
  { re: /salad/i, unit: 'servings', perAdult: 1, perChild: 0.5, why: '1 serving per adult and half for kids', options: (l) => [o('costco', `${cap(l)} tray (serves 16)`, 16, 'serves 16', 24.99), o('instacart', `${cap(l)} (serves 8)`, 8, 'serves 8', 17.99)] },
  { re: /pasta|lasagna|mac/i, unit: 'servings', perAdult: 1, perChild: 0.6, why: '1 serving per adult and 0.6 per child', options: (l) => [o('costco', `${cap(l)} tray (serves 12)`, 12, 'serves 12', 29.99), o('instacart', `${cap(l)} catering tray (serves 10)`, 10, 'serves 10', 39.99)] },
  { re: /wing/i, unit: 'wings', perAdult: 5, perChild: 2, why: '5 per adult and 2 per child', options: () => [o('costco', 'Chicken wings, 48-piece', 48, '48 pieces', 44.99), o('instacart', 'Wings platter, 24-piece', 24, '24 pieces', 29.99)] },
  { re: /ice cream|gelato|popsicle/i, unit: 'servings', perAdult: 1, perChild: 1, why: '1 serving per guest', options: (l) => [o('costco', `${cap(l)}, family pack (24 servings)`, 24, '24 servings', 14.99), o('instacart', `${cap(l)} (12 servings)`, 12, '12 servings', 6.99)] },
  { re: /lemonade|punch|agua fresca|horchata|iced tea|sweet tea|jamaica/i, unit: 'cups', perAdult: 2, perChild: 2, why: 'about 2 cups per person, 16 cups a gallon', options: (l) => [o('costco', `${cap(l)}, 2 gallons`, 32, '2 gallons', 9.99), o('instacart', `${cap(l)}, 1 gallon`, 16, '1 gallon', 5.99)] },
];

/** The shopping item for one typed entry. */
export function customTemplate(e: MenuEntry): Template {
  const p = PRESETS.find((x) => x.re.test(e.label));
  const name = cap(e.label);
  if (p) {
    return {
      id: `custom-${e.key}`, name, category: 'food', priority: 'essential', unit: p.unit,
      rule: { kind: 'per-guest', perAdult: p.perAdult, perChild: p.perChild }, ruleText: `From your menu: ${p.why}`,
      options: p.options(e.label), tag: 'menu', priceNote: 'Sample prices for concept testing.',
    } as Template;
  }
  const drink = e.kind === 'drink';
  return {
    id: `custom-${e.key}`, name, category: 'food', priority: 'essential', unit: drink ? 'drinks' : 'servings',
    rule: { kind: 'per-guest', perAdult: drink ? 1.5 : 1, perChild: drink ? 1 : 0.6 },
    ruleText: drink ? 'From your menu: about 1.5 drinks per adult and 1 per child' : 'From your menu: 1 serving per adult and 0.6 per child',
    options: [{ retailer: 'own', product: name, packQty: 1, packLabel: '1 serving', packPrice: 0, supplier: 'Store of your choice', channel: 'in-store' }],
    tag: 'menu', priceNote: 'Add a price.',
  } as Template;
}

export const needsPrice = (it: PlanItem) => it.id.startsWith('custom-') && it.priceNote === 'Add a price.';

/** The task for one typed entry. */
function customTask(e: MenuEntry, ev: EventInfo): Task {
  return {
    id: `task-menu-${e.key}`,
    title: e.kind === 'drink' ? `Buy ${e.label.toLowerCase()}` : `Order or make the ${e.label.toLowerCase()}`,
    category: e.kind === 'drink' ? 'Shopping' : 'Food',
    owner: 'You',
    dueDate: addDays(ev.date, e.kind === 'drink' ? -1 : -3),
    status: 'todo', priority: 'medium', blocker: null, affectedBy: null,
  };
}

/** Short food summary for the main food task. */
export function foodSummary(ev: EventInfo): string {
  if (ev.foodText?.trim()) return splitList(ev.foodText).slice(0, 4).join(', ').toLowerCase() || ev.foodText.trim();
  return [ev.foodFormat, ...(ev.extraFood ?? [])].map((f) => FOOD_SHORT[f]).join(' + ');
}

/** Fills the derived choice fields from the typed text. */
export function withParsedMenu(ev: EventInfo): EventInfo {
  if (ev.foodText === undefined && ev.drinksText === undefined) return ev;
  const m = parseMenu(ev.foodText ?? '', ev.drinksText ?? '');
  return { ...ev, foodFormat: m.foodFormat, extraFood: m.extraFood, alcohol: m.alcohol, softDrinks: m.softDrinks };
}

/** Adds, brings back or sets aside your own menu items and their tasks so they match what you typed. */
export function syncCustomMenu(s: Pick<AppState, 'items' | 'tasks' | 'event'>, ev: EventInfo): { items: PlanItem[]; tasks: Task[]; notes: string[] } {
  const m = parseMenu(ev.foodText ?? '', ev.drinksText ?? '');
  const want = new Map(m.custom.map((e) => [`custom-${e.key}`, e]));
  const notes: string[] = [];
  let items = s.items.map((it) => {
    if (!it.id.startsWith('custom-food-') && !it.id.startsWith('custom-drink-')) return it;
    if (want.has(it.id) && it.removed && it.removedReason === 'not-needed') { notes.push(`Added ${it.name.toLowerCase()} back`); return { ...it, removed: false, removedReason: undefined }; }
    if (!want.has(it.id) && !it.removed) { notes.push(`Set aside ${it.name.toLowerCase()}`); return { ...it, removed: true, removedReason: 'not-needed' as const }; }
    return it;
  });
  for (const [id, e] of want) {
    if (!items.some((it) => it.id === id)) { items = [...items, templateToItem(customTemplate(e))]; notes.push(`Added ${e.label.toLowerCase()}`); }
  }
  // The generic "main food" item is only needed when a known food style was typed
  items = items.map((it) => {
    if (it.id !== 'mains') return it;
    if (m.customMainOnly && !it.removed) return { ...it, removed: true, removedReason: 'not-needed' as const };
    if (!m.customMainOnly && it.removed && it.removedReason === 'not-needed') return { ...it, removed: false, removedReason: undefined };
    return it;
  });
  let tasks = s.tasks.filter((t) => !t.id.startsWith('task-menu-') || t.status === 'done' || want.has(`custom-${t.id.slice('task-menu-'.length)}`));
  for (const e of m.custom) if (!tasks.some((t) => t.id === `task-menu-${e.key}`)) tasks = [...tasks, customTask(e, ev)];
  // Keep the main food task's wording in step with the menu
  const summary = foodSummary(ev);
  tasks = tasks.map((t) => (t.title.startsWith('Book or order the food') ? { ...t, title: `Book or order the food (${summary})` } : t));
  return { items, tasks, notes };
}

/** Food and drink chips offered under the boxes. */
export const FOOD_SUGGESTIONS = ['Taco bar', 'BBQ', 'Pizza', 'Appetizers', 'Sandwiches', 'Cake'];
export const DRINK_SUGGESTIONS = ['Water', 'Soda', 'Lemonade', 'Beer', 'Wine'];
