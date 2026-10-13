import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useStore } from '../lib/store';
import { RETAILERS } from '../lib/catalog';
import { computePlan, computeStrategies, round2, type Strategy } from '../lib/plan';
import { money, plural } from '../lib/format';
import { applyAssignment } from '../lib/actions';
import { Button, Drawer, Note, Pill, SampleBadge, cx } from './ui';

export default function OptimizeDrawer() {
  const { s, head, plan, update, close, toast } = useStore();
  const planAfter = (st: Strategy) => computePlan(applyAssignment(s, st.assignment), head).grandTotal;
  const all = useMemo(() => computeStrategies(plan), [plan]);
  const [showOther, setShowOther] = useState(false);
  const current = all[0];
  const lowest = all.find((x) => x.id === 'lowest')!;
  const fewest = all.find((x) => x.id === 'fewest')!;
  const fastest = all.find((x) => x.id === 'fastest')!;
  const sameAsLowest = fewest.total === lowest.total && fewest.stores.length === lowest.stores.length;
  const count = Object.keys(current.assignment).length;

  const apply = (st: Strategy) => {
    const after = planAfter(st);
    const saved = round2(plan.grandTotal - after);
    update((p) => applyAssignment(p, st.assignment));
    close();
    toast({
      title: `${st.label} applied`,
      detail: saved > 0 ? `Stores updated. Your estimate drops by ${money(saved)} to ${money(after)}.` : `Stores updated. Your estimate is now ${money(after)}.`,
      tone: 'success',
    });
  };

  const card = (st: Strategy, badge?: string) => {
    const after = planAfter(st);
    const saved = round2(plan.grandTotal - after);
    const isCurrent = st.id === 'current';
    const pickups = st.stores.filter((x) => RETAILERS[x.retailer].fulfillment === 'Pickup').length;
    const deliveries = st.stores.length - pickups;
    return (
      <article key={st.id} className={cx('rounded-2xl border p-4', isCurrent ? 'border-line bg-paper' : st.complete ? 'border-forest/40 bg-paper' : 'border-line bg-row')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-bold">{st.label}</h3>
            <p className="text-[13px] text-muted">
              {plural(st.stores.length, 'store')} · {plural(pickups, 'pickup')} · {plural(deliveries, 'delivery', 'deliveries')}
            </p>
          </div>
          <div className="text-right">
            <p className="tnum text-xl font-bold">{money(st.total)}</p>
            {!isCurrent && st.complete && (
              <p className={cx('tnum text-[13px] font-semibold', saved > 0 ? 'text-ok' : saved < 0 ? 'text-coral' : 'text-muted')}>
                {saved > 0 ? `Saves ${money(saved)}` : saved < 0 ? `Costs ${money(-saved)} more` : 'Same cost'}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {badge && <Pill tone="green">{badge}</Pill>}
          {!st.complete && <Pill tone="coral">Incomplete</Pill>}
        </div>
        <table className="tnum mt-3 w-full text-[13px]">
          <caption className="sr-only">Stores in {st.label}</caption>
          <tbody>
            {st.stores.map((x) => (
              <tr key={x.retailer} className="border-t border-line">
                <th scope="row" className="py-1.5 pr-2 text-left font-semibold">
                  {RETAILERS[x.retailer].name}
                  <span className="block font-normal text-muted">{plural(x.items.length, 'item')} · {RETAILERS[x.retailer].fulfillment.toLowerCase()}</span>
                </th>
                <td className="py-1.5 text-right">{money(x.subtotal)}{x.fee ? <span className="block text-muted">+ {money(x.fee)} fee</span> : null}</td>
              </tr>
            ))}
            <tr className="border-t border-line font-semibold">
              <th scope="row" className="py-1.5 text-left">Items {money(st.itemsSubtotal)} + fees {money(st.feeTotal)}</th>
              <td className="py-1.5 text-right">{money(st.total)}</td>
            </tr>
          </tbody>
        </table>
        {!isCurrent && st.complete && <p className="tnum mt-2 text-[13px] text-muted">Whole-event estimate after switching: <b className="text-ink">{money(after)}</b> (now {money(plan.grandTotal)})</p>}
        {!st.complete && <p className="mt-2 text-[13px] text-coral">Not available from these stores: {st.missing.join(', ')}.</p>}
        <p className="mt-2 text-[13px] text-muted"><b className="text-ink">Why:</b> {st.advantage}. <b className="text-ink">Tradeoff:</b> {st.tradeoff}.</p>
        {!isCurrent && (
          <Button className="mt-3" size="sm" disabled={!st.complete || JSON.stringify(st.assignment) === JSON.stringify(current.assignment)} onClick={() => apply(st)}>
            <Check className="size-4" /> {st.complete ? 'Use this plan' : 'Cannot apply: items missing'}
          </Button>
        )}
      </article>
    );
  };

  return (
    <Drawer title="Compare Stores for the Whole List" subtitle={<SampleBadge />} onClose={close} wide footer={<Button variant="ghost" onClick={close}>Keep My Current Stores</Button>}>
      {count === 0 ? (
        <Note tone="green">Everything is already bought or you already had it. There is nothing left to compare.</Note>
      ) : (
        <>
          <p className="text-[15px] text-muted">
            Looks at all {plural(count, 'item')} you still need together and finds the cheapest mix of stores, counting each store's delivery fee once. Items already bought, already had, or from your own suppliers keep their stores. To compare prices for one item, tap <b>Compare options</b> on that item instead.
          </p>
          {plan.remaining < 0 && lowest.complete && (
            <Note tone={s.event.budget - planAfter(lowest) >= 0 ? 'green' : 'coral'} className="mt-3">
              You are {money(-plan.remaining)} over budget. The lowest-cost plan
              {s.event.budget - planAfter(lowest) >= 0 ? ' would bring you back within budget.' : ` saves ${money(plan.grandTotal - planAfter(lowest))}, which is not quite enough on its own.`}
            </Note>
          )}
          <div className="mt-4 grid gap-4">
            {card(current)}
            {card(lowest, sameAsLowest ? 'Lowest cost and fewest stores' : 'Lowest total cost')}
            {!sameAsLowest && card(fewest, 'Fewest stores')}
          </div>
          <button type="button" onClick={() => setShowOther((v) => !v)} aria-expanded={showOther} className="mt-5 flex min-h-11 items-center gap-2 font-semibold text-forest">
            <ChevronDown className={cx('size-4 transition-transform', showOther && 'rotate-180')} /> Other options
          </button>
          {showOther && <div className="mt-2 grid gap-4">{card(fastest, 'Fastest')}</div>}
        </>
      )}
    </Drawer>
  );
}
