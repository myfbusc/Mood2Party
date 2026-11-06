import { useCallback, useMemo, useState } from 'react';
import { CATEGORY_LABEL } from '../lib/catalog';
import { computePlan } from '../lib/plan';
import { applySpend, costFnFor, exampleFor, levelName, levelText, SPEND_CATEGORIES, TIER_HINT, TIER_LABEL, TIERS } from '../lib/tiers';
import { money } from '../lib/format';
import { cx } from './ui';
import type { AppState, Category, Headcount, Tier } from '../lib/types';

export type Spend = Partial<Record<Category, number>>;
type PlanLike = Pick<AppState, 'items' | 'event' | 'appliedFactors' | 'expenses'>;

const CAT_TITLE: Record<Category, string> = { food: 'Food and drinks', tableware: 'Plates, cups and cutlery', decorations: 'Decorations', supplies: 'Supplies' };

/** The plan with these spending levels applied. */
function planAt(state: PlanLike, head: Headcount, spend: Spend) {
  const ev = { ...state.event, spend };
  return computePlan({ ...state, event: ev, items: applySpend(state.items, ev, costFnFor(ev, state.appliedFactors, head)) }, head);
}

/** What each kind of thing costs at each level, and at any point in between. */
export function useSpendCosts(state: PlanLike, head: Headcount, spend: Spend) {
  const costs = useMemo(() => {
    const out = {} as Record<Category, Record<Tier, number>>;
    for (const c of SPEND_CATEGORIES) {
      out[c] = {} as Record<Tier, number>;
      for (const t of TIERS) out[c][t] = planAt(state, head, { ...spend, [c]: t }).byCategory[c];
    }
    return out;
  }, [state, head, spend]);
  const total = useMemo(() => planAt(state, head, spend).grandTotal, [state, head, spend]);
  /** The cost the plan can really reach for a level (items are mixed to get closest). */
  const costAt = useCallback((c: Category, level: number) => planAt(state, head, { ...spend, [c]: level }).byCategory[c], [state, head, spend]);
  /** The slider position that matches a cost, so the thumb shows where the plan really landed. */
  const levelOf = useCallback((c: Category, cost: number) => {
    const k = costs[c];
    if (cost <= k[2]) return k[2] - k[1] > 0.5 ? 1 + Math.max(0, (cost - k[1]) / (k[2] - k[1])) : cost < k[2] ? 1 : 2;
    return k[3] - k[2] > 0.5 ? 2 + Math.min(1, (cost - k[2]) / (k[3] - k[2])) : 2;
  }, [costs]);
  return { costs, total, costAt, levelOf };
}

/** One slider per kind of thing, from $ (basic) to $$$ (nicer). It slides freely and settles on the nearest cost the plan can reach. */
export function SpendLevels({ state, head, value, onChange, compact }: {
  state: PlanLike;
  head: Headcount;
  value: Spend;
  onChange: (c: Category, level: number) => void;
  compact?: boolean;
}) {
  const { costs, costAt, levelOf } = useSpendCosts(state, head, value);
  const [drag, setDrag] = useState<{ c: Category; v: number } | null>(null);
  const cats = SPEND_CATEGORIES.filter((c) => state.items.some((it) => it.category === c && !it.removed));
  // Let go: settle on the cost the plan can actually reach, and put the thumb there
  const settle = (c: Category, v: number) => {
    setDrag(null);
    const near = [1, 2, 3].find((t) => Math.abs(v - t) < 0.06);
    const snapped = near ?? Math.round(levelOf(c, costAt(c, v)) * 100) / 100;
    if (Math.abs(snapped - (value[c] ?? 2)) > 0.004) onChange(c, snapped);
  };
  return (
    <div className={cx('grid', compact ? 'gap-5' : 'gap-6')}>
      {cats.map((c) => {
        const cur = value[c] ?? 2;
        const live = drag?.c === c ? drag.v : cur;
        const cost = Number.isInteger(live) ? costs[c][live as Tier] : costAt(c, live);
        const example = exampleFor(state.items, c, live);
        const id = `spend-${c}`;
        return (
          <div key={c}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={id} className="font-semibold text-ink">{CAT_TITLE[c] ?? CATEGORY_LABEL[c]}</label>
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink">
                <span className="mr-1.5 text-[12px] font-semibold text-muted">{levelText(live)}</span>{money(cost, false)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="w-8 shrink-0 text-center font-display text-[15px] font-bold text-muted" aria-hidden="true">$</span>
              <input
                id={id}
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={live}
                onChange={(e) => setDrag({ c, v: Number(e.target.value) })}
                onPointerUp={(e) => settle(c, Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => settle(c, Number((e.target as HTMLInputElement).value))}
                onBlur={() => { if (drag?.c === c) settle(c, drag.v); }}
                aria-valuetext={`${levelName(live)}, about ${money(cost, false)}`}
                className="m2p-range h-2 min-w-0 flex-1 cursor-pointer touch-pan-y"
              />
              <span className="w-8 shrink-0 text-center font-display text-[15px] font-bold text-muted" aria-hidden="true">$$$</span>
            </div>
            <div className="mt-1.5 grid grid-cols-3 px-9 text-[12px] leading-tight" aria-hidden="true">
              {TIERS.map((x) => (
                <button
                  key={x}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onChange(c, x)}
                  className={cx('rounded-md py-0.5 tabular-nums', x === 1 ? 'text-left' : x === 3 ? 'text-right' : 'text-center', Math.abs(live - x) < 0.005 ? 'font-bold text-forest' : 'text-muted hover:text-ink')}
                >
                  <span className="block">{TIER_LABEL[x]}</span>
                  <span className="block">{money(costs[c][x], false)}</span>
                </button>
              ))}
            </div>
            {!compact && (
              <p className="mt-1.5 text-[13px] text-muted">
                {Number.isInteger(Math.round(live * 100) / 100) ? TIER_HINT[c][Math.round(live) as Tier] : levelName(live)}{example ? <>, like <span className="text-ink">{example.charAt(0).toLowerCase() + example.slice(1)}</span></> : null}.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Lowers levels a little at a time, where it saves the most, until the plan fits the budget (or everything is basic). */
export function fitToBudget(state: PlanLike, head: Headcount, spend: Spend, budget: number): { spend: Spend; total: number; fits: boolean } {
  const totalAt = (sp: Spend) => planAt(state, head, sp).grandTotal;
  let cur: Spend = { ...spend };
  let total = totalAt(cur);
  let guard = 0;
  while (total > budget && guard++ < 40) {
    let best: { sp: Spend; total: number } | null = null;
    for (const c of SPEND_CATEGORIES) {
      const t = cur[c] ?? 2;
      if (t <= 1) continue;
      const sp = { ...cur, [c]: Math.max(1, Math.round((t - 0.25) * 100) / 100) };
      const tt = totalAt(sp);
      if (tt < total - 0.5 && (!best || tt < best.total)) best = { sp, total: tt };
    }
    if (!best) {
      // Small steps save nothing more: drop a whole level where one is left
      const c = SPEND_CATEGORIES.find((x) => (cur[x] ?? 2) > 1);
      if (!c) break;
      cur = { ...cur, [c]: Math.max(1, Math.ceil((cur[c] ?? 2) - 1)) };
      total = totalAt(cur);
      continue;
    }
    cur = best.sp;
    total = best.total;
  }
  return { spend: cur, total, fits: total <= budget };
}
