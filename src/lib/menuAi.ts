// When AI is available, it fills in amounts and prices for menu items Mood2Party has no built-in numbers for.
import { getSample } from './ai';
import { needsPrice } from './menuText';
import { RETAILER_IDS } from './catalog';
import type { AppState, Headcount, PlanItem, RetailerId } from './types';

interface AiItem { id: string; product: string; unit: string; perAdult: number; perChild: number; packQty: number; packLabel: string; packPrice: number; store: string; why: string }

/** Returns item patches to apply, or null when AI isn't available or nothing needs it. */
export async function aiFillMenuItems(s: AppState, head: Headcount): Promise<Record<string, Partial<PlanItem>> | null> {
  const todo = s.items.filter((it) => !it.removed && needsPrice(it));
  if (!todo.length) return null;
  const sample = await getSample();
  if (!sample) return null;
  const list = todo.map((it) => `- id "${it.id}": ${it.name} (${it.id.startsWith('custom-drink-') ? 'drink' : 'food'})`).join('\n');
  const out = await sample.json<AiItem[]>(
    `You help a DIY host plan a ${s.event.type || 'party'} for ${head.adults} adults and ${head.children} children, ${s.event.durationHrs} hours long, in the US.
For each menu item below, suggest how much to buy and a realistic store option.
Reply with only a JSON array of objects: {"id": the id given, "product": what to buy at the store (short), "unit": plural unit (e.g. "pupusas", "cups", "trays"),
"perAdult": number of units per adult, "perChild": number per child, "packQty": units per package, "packLabel": short package label (e.g. "dozen", "1 gallon"),
"packPrice": realistic USD price per package, "store": one of "costco","target","amazon","instacart", "why": one short plain sentence explaining the amount}.

Items:
${list}`,
    { modelTier: 'quick' },
  );
  if (!Array.isArray(out)) return null;
  const ok = (n: unknown, max: number) => typeof n === 'number' && isFinite(n) && n >= 0 && n <= max;
  const patches: Record<string, Partial<PlanItem>> = {};
  for (const x of out) {
    const it = todo.find((t) => t.id === x?.id);
    if (!it || !ok(x.perAdult, 50) || !ok(x.perChild, 50) || !ok(x.packQty, 1000) || !ok(x.packPrice, 2000) || x.packQty < 1) continue;
    const store = (RETAILER_IDS as string[]).includes(x.store) ? (x.store as RetailerId) : 'instacart';
    const unit = typeof x.unit === 'string' && x.unit.trim() ? x.unit.trim().slice(0, 30) : it.unit;
    patches[it.id] = {
      unit,
      rule: { kind: 'per-guest', perAdult: x.perAdult, perChild: x.perChild },
      ruleText: `AI estimate: ${typeof x.why === 'string' && x.why.trim() ? x.why.trim().replace(/\.$/, '') : `${x.perAdult} ${unit} per adult`}`,
      options: [{ retailer: store, product: String(x.product || it.name).slice(0, 80), packQty: Math.round(x.packQty), packLabel: String(x.packLabel || `${Math.round(x.packQty)}-pack`).slice(0, 30), packPrice: Math.round(x.packPrice * 100) / 100 }],
      retailer: store,
      priceNote: 'AI price estimate; check before buying.',
      qtyOverride: null,
      overrideAtRec: null,
    };
  }
  return Object.keys(patches).length ? patches : null;
}

export function applyPatches(s: AppState, patches: Record<string, Partial<PlanItem>>): AppState {
  return { ...s, items: s.items.map((it) => (patches[it.id] && needsPrice(it) ? { ...it, ...patches[it.id] } : it)) };
}
