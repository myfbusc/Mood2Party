import { useEffect, useMemo, useState } from 'react';
import { Balloon, Building2, Camera, ChevronDown, House, ListChecks, Package, Pencil, Pizza, Plus, RotateCcw, Scale, Store, Utensils } from 'lucide-react';
import { useStore } from '../lib/store';
import { CATEGORIES, CATEGORY_LABEL, REFERENCE_CHECKLIST, RETAILERS, VENUE_OFTEN_PROVIDES, storeShort } from '../lib/catalog';
import type { Line } from '../lib/plan';
import { needsPrice } from '../lib/menuText';
import { money, plural, qtyUnit } from '../lib/format';
import { lowestCostSaving, markPurchased, patchItem } from '../lib/actions';
import { getSample } from '../lib/ai';
import { Button, Card, PageHeader, InfoTip, Pill, Segmented, Stat, cx, inputBase } from '../components/ui';
import type { Category, PlanItem } from '../lib/types';

const REASON = (it: PlanItem) =>
  it.removedReason === 'venue' ? 'Already provided (venue or someone else)' : it.removedReason === 'vendor' ? `Covered by ${it.coveredBy || 'a vendor'}` : it.removedReason === 'not-needed' ? 'Not on your food and drinks list' : 'Taken off the list';

type StatusFilter = 'all' | 'to-buy' | 'purchased' | 'owned';

/** A colored icon for each shopping category (colors are defined in index.css for both themes). */
const CATEGORY_LOOK: Record<Category, { icon: typeof Pizza; cls: string }> = {
  food: { icon: Pizza, cls: 'bg-cat-food-soft text-cat-food' },
  tableware: { icon: Utensils, cls: 'bg-cat-tableware-soft text-cat-tableware' },
  decorations: { icon: Balloon, cls: 'bg-cat-decorations-soft text-cat-decorations' },
  supplies: { icon: Package, cls: 'bg-cat-supplies-soft text-cat-supplies' },
};


export default function Plan() {
  const { s, head, plan, update, open, toast, markDid, cloud } = useStore();
  const [cat, setCat] = useState<'all' | Category>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [buyerFilter, setBuyerFilter] = useState<string>('anyone'); // 'anyone' | 'none' | a person's name
  const [canInspire, setCanInspire] = useState(false);

  useEffect(() => {
    let live = true;
    getSample().then(async (x) => {
      if (!live) return;
      if (!x) { setCanInspire(false); return; }
      try {
        const lim = await x.limits();
        if (live) setCanInspire(!!lim.images);
      } catch {
        /* no image support */
      }
    });
    return () => {
      live = false;
    };
  }, [cloud.user]);

  // Folded categories, remembered in this browser
  const FOLD_KEY = 'mood2party:folded-categories';
  const [folded, setFolded] = useState<Category[]>(() => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]'); } catch { return []; } });
  const saveFolded = (next: Category[]) => { setFolded(next); try { localStorage.setItem(FOLD_KEY, JSON.stringify(next)); } catch { /* remembered for this visit */ } };
  const toggleFold = (c: Category) => saveFolded(folded.includes(c) ? folded.filter((x) => x !== c) : [...folded, c]);
  const allFolded = CATEGORIES.every((c) => folded.includes(c));

  const saving = useMemo(() => lowestCostSaving(s, head, plan), [s, head, plan]);

  // You and every helper, plus the current buyer if they are no longer on the helper list
  const people = ['You', ...s.event.helpers];
  const buyerChoices = (current: string) => (!current || people.includes(current) ? people : [...people, current]);
  const filterPeople = [...new Set([...people, ...plan.active.map((l) => l.item.buyer).filter(Boolean)])];

  const matches = (l: Line) => {
    if (cat !== 'all' && l.item.category !== cat) return false;
    if (buyerFilter !== 'anyone') {
      if (l.status === 'owned') return false; // nothing to buy, so no buyer
      if (buyerFilter === 'none' ? l.item.buyer !== '' : l.item.buyer !== buyerFilter) return false;
    }
    if (status === 'to-buy') return l.status === 'to-buy' || l.status === 'buy-more';
    if (status === 'purchased') return l.status === 'purchased';
    if (status === 'owned') return l.status === 'owned';
    return true;
  };
  const removed = plan.lines.filter((l) => l.item.removed);
  const firstId = plan.lines.find((l) => !l.item.removed && matches(l))?.item.id;

  const setBuyer = (l: Line, buyer: string) => {
    if (buyer === l.item.buyer) return;
    update((p) => patchItem(p, l.item.id, { buyer }));
    if (buyer) markDid('buyer');
    const leavesView = buyerFilter !== 'anyone' && (buyerFilter === 'none' ? buyer !== '' : buyer !== buyerFilter);
    toast({
      title: buyer ? `${buyer === 'You' ? 'You' : buyer} will buy ${l.item.name.toLowerCase()}` : `${l.item.name} has no buyer now`,
      detail: leavesView ? 'It no longer matches the "Who buys" filter. Choose "Anyone buys" to see it.' : undefined,
      tone: buyer ? 'success' : 'info',
    });
  };


  const togglePurchased = (l: Line) => {
    const on = !(l.status === 'purchased');
    update((p) => markPurchased(p, l.item.id, on));
    if (on) markDid('purchased');
    toast({ title: on ? `${l.item.name} marked as bought` : `${l.item.name} moved back to Need to buy`, detail: on ? 'Type what you actually paid in the "Paid $" box on the item.' : undefined, tone: on ? 'success' : 'info' });
  };




  return (
    <>
      <PageHeader
        title="Plan and Shop"
        sub={<span className="inline-flex items-center gap-1">Sized for <b className="text-ink">{head.total} guests</b>
          <InfoTip label="How the shopping list works">Amounts are worked out from your guest count. Tick an item when it's bought, and tap the pencil to change the amount, store, price or status. Prices are samples for concept testing.</InfoTip></span>}
      >
        <Button variant="secondary" aria-label="Shop by Store" onClick={() => open({ type: 'stores' })}><Store className="size-4" /> <span className="max-sm:hidden">Shop by Store</span><span className="sm:hidden">Stores</span></Button>
        <Button variant="secondary" aria-label="Compare Stores" onClick={() => open({ type: 'optimize' })} title={saving >= 1 ? `Could save about ${money(saving, false)}` : 'Finds the cheapest mix of stores'}>
          <Scale className="size-4" /> <span className="max-sm:hidden">Compare Stores</span><span className="sm:hidden">Compare</span>
        </Button>
        {canInspire && <Button variant="secondary" aria-label="Add from a Photo" onClick={() => open({ type: 'inspire' })}><Camera className="size-4" /> <span className="max-sm:hidden">From a Photo</span><span className="sm:hidden">Photo</span></Button>}
        <Button aria-label="Add Item" onClick={() => open({ type: 'add-item', category: cat === 'all' ? undefined : cat })}><Plus className="size-4" /> <span className="max-sm:hidden">Add Item</span><span className="sm:hidden">Add</span></Button>
      </PageHeader>

      <section aria-label="Shopping summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Shopping estimate" value={money(plan.shoppingTotal)} sub={plan.feeTotal > 0 ? `Includes ${money(plan.feeTotal)} in delivery fees` : 'No delivery fees'} />
        <Stat label="Already spent" value={money(plan.spent)} sub={`${plural(plan.counts.purchased, 'item')} bought`} />
        <Stat label="Still to buy" value={plan.counts.toBuy + plan.counts.buyMore} tone={plan.counts.buyMore ? 'coral' : undefined} sub={plan.counts.buyMore ? `${plan.counts.buyMore} need more packs` : `${plan.counts.owned} you already have`} />
        <Stat
          label={plan.leftToSpend >= 0 ? 'Budget left' : 'Over budget'}
          value={money(Math.abs(plan.leftToSpend))}
          tone={plan.leftToSpend < 0 ? 'red' : 'green'}
          sub={plan.remaining >= 0 ? `${money(plan.remaining, false)} left after buying the rest` : <span className="font-semibold text-danger">{money(-plan.remaining, false)} over after buying the rest</span>}
        />
      </section>


      <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
        <label htmlFor="cat" className="sr-only">Category</label>
        <select id="cat" className={cx(inputBase, 'h-[50px] w-full sm:w-auto sm:min-w-48')} value={cat} onChange={(e) => setCat(e.target.value as 'all' | Category)}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
        <Segmented label="Status" value={status} onChange={setStatus} options={[
          { value: 'all', label: 'All' }, { value: 'to-buy', label: 'Need to buy' }, { value: 'purchased', label: 'Bought' }, { value: 'owned', label: 'Already have' },
        ]} />
        <Button variant="quiet" size="sm" className="ml-auto" onClick={() => saveFolded(allFolded ? [] : [...CATEGORIES])}>
          <ChevronDown className={cx('size-4 transition-transform', allFolded && '-rotate-90')} /> {allFolded ? 'Expand All' : 'Collapse All'}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="buyer-filter" className="text-[13px] font-semibold text-muted">Who buys</label>
        <select id="buyer-filter" className={cx(inputBase, 'h-[50px] w-auto min-w-48', buyerFilter !== 'anyone' && 'border-forest font-semibold text-forest')} value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)}>
          <option value="anyone">Anyone buys</option>
          <option value="none">No buyer yet</option>
          {filterPeople.map((n) => <option key={n} value={n}>{n === 'You' ? 'You buy' : `${n} buys`}</option>)}
        </select>
      </div>

      {buyerFilter !== 'anyone' && (() => {
        const mine = plan.active.filter(matches);
        const total = mine.reduce((a, l) => a + l.cost, 0);
        const who = buyerFilter === 'none' ? 'No buyer yet' : buyerFilter === 'You' ? 'You buy' : `${buyerFilter} buys`;
        return (
          <p role="status" className="mt-3 text-[14px] text-muted">
            <b className="text-ink">{who}:</b> {plural(mine.length, 'item')} · <span className="tnum">{money(total)}</span> ·{' '}
            <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => setBuyerFilter('anyone')}>Show everyone's items</button>
          </p>
        );
      })()}

      {plan.active.filter(matches).length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">No items match these filters.</p>
      )}

      {CATEGORIES.filter((c) => cat === 'all' || c === cat).map((c) => {
        const rows = plan.lines.map((l, i) => ({ l, i })).filter(({ l }) => !l.item.removed && l.item.category === c && matches(l));
        const unfiltered = status === 'all' && buyerFilter === 'anyone';
        if (!rows.length && !unfiltered) return null;
        return (
          <section key={c} className="mt-6" aria-labelledby={`cat-${c}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id={`cat-${c}`} className="font-display text-xl font-semibold">
               <button type="button" onClick={() => toggleFold(c)} aria-expanded={!folded.includes(c)} className="flex items-center gap-2.5 rounded-lg text-left hover:opacity-80">
                {(() => {
                  const { icon: Icon, cls } = CATEGORY_LOOK[c];
                  return <span className={cx('grid size-8 place-items-center rounded-full', cls)} aria-hidden="true"><Icon className="size-[18px]" /></span>;
                })()}
                {CATEGORY_LABEL[c]}
                <ChevronDown className={cx('size-5 text-muted transition-transform', folded.includes(c) && '-rotate-90')} aria-hidden="true" />
               </button>
              </h2>
              <span className="flex items-center gap-1">
                {folded.includes(c) && <span className="tnum mr-2 text-sm text-muted">{plural(rows.length, 'item')} · {rows.filter(({ l }) => l.status === 'to-buy' || l.status === 'buy-more').length} to buy</span>}
                <span className="tnum text-sm font-semibold text-muted">{money(buyerFilter === 'anyone' ? plan.byCategory[c] : rows.reduce((a, { l }) => a + l.cost, 0))}</span>
              </span>
            </div>
            {!folded.includes(c) && <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {rows.length === 0 && <li className="px-4 py-4 text-sm text-muted">Nothing here yet. Add your own items, or one vendor who handles all of it.</li>}
                {rows.map(({ l }) => {
                  const bought = l.status === 'purchased';
                  const owned = l.status === 'owned';
                  const first = l.item.id === firstId;
                  return (
                    <li key={l.item.id} data-tour={first ? 'first-item' : undefined} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex sm:px-4">
                      {/* A label with an invisible larger edge: the box looks the same but is easier to tap */}
                      <label className="relative grid shrink-0 cursor-pointer place-items-center before:absolute before:-inset-2.5 before:content-[''] size-7">
                        {owned ? (
                          <span className="grid size-6 place-items-center rounded-md bg-cat-supplies-soft text-cat-supplies" title="Already have"><House className="size-3.5" aria-hidden="true" /><span className="sr-only">Already have</span></span>
                        ) : (
                          <input type="checkbox" className="size-6 cursor-pointer accent-forest" checked={bought} onChange={() => togglePurchased(l)} aria-label={`Mark ${l.item.name} as bought`} />
                        )}
                      </label>
                      <div className="min-w-0 sm:flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <button type="button" onClick={() => open({ type: 'item', id: l.item.id })} className={cx('-my-1.5 py-1.5 text-left font-semibold hover:underline', bought && 'text-muted')}>{l.item.name}</button>
                          {bought && <Pill tone="green">Bought</Pill>}
                          {l.status === 'buy-more' && <Pill tone="coral">Buy {plural(l.morePkgs, 'more pack', 'more packs')}</Pill>}
                          {owned && <Pill className="bg-cat-supplies-soft text-cat-supplies">Already have</Pill>}
                          {needsPrice(l.item) && <Pill tone="gold">Add a price</Pill>}
                          {l.item.priority === 'optional' && !owned && <Pill tone="sage">Optional</Pill>}
                          {l.item.tag === 'vendor' && <Pill tone="sage">Vendor</Pill>}
                        </p>
                        <p className="tnum mt-0.5 truncate text-[13px] text-muted">
                          {qtyUnit(l.need, l.item.unit)}{!owned && l.pkgs > 0 && <> · {storeShort(l.opt)}</>}{l.item.purchasedPkgs > 0 && typeof l.item.paidAmount === 'number' && <> · paid {money(l.item.paidAmount)}</>}
                        </p>
                      </div>
                      <div className="col-span-3 col-start-2 row-start-2 flex items-center justify-between gap-3 sm:contents">
                        {owned ? <span className="sm:w-36" aria-hidden="true" /> : (
                          <>
                            <label htmlFor={`buyer-${l.item.id}`} className="sr-only">Who buys {l.item.name}</label>
                            <select
                              id={`buyer-${l.item.id}`}
                              value={l.item.buyer}
                              onChange={(e) => setBuyer(l, e.target.value)}
                              className={cx('min-h-9 w-36 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-paper py-1 pl-2.5 pr-7 text-[13px] font-semibold hover:border-forest/60', l.item.buyer ? 'text-ink' : 'text-muted')}
                            >
                              <option value="">No buyer</option>
                              {buyerChoices(l.item.buyer).map((n) => <option key={n} value={n}>{n === 'You' ? 'You buy' : `${n} buys`}</option>)}
                            </select>
                          </>
                        )}
                        <span className={cx('tnum w-20 shrink-0 text-right font-semibold', owned && 'text-muted')}>{l.cost ? money(l.cost) : owned ? money(0) : '—'}</span>
                        <button type="button" onClick={() => open({ type: 'item', id: l.item.id })} aria-label={`Edit ${l.item.name}`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line-strong text-muted hover:border-forest/60 hover:text-forest">
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {unfiltered && (
                <div className="flex flex-wrap gap-x-1 gap-y-1 border-t border-line px-2 py-1.5">
                  <Button variant="quiet" size="sm" onClick={() => open({ type: 'add-item', category: c })} aria-label={`Add an item to ${CATEGORY_LABEL[c]}`}><Plus className="size-4" /> Add to {CATEGORY_LABEL[c].toLowerCase()}</Button>
                  <Button variant="quiet" size="sm" onClick={() => open({ type: 'vendor', category: c })} aria-label={`Use one vendor for ${CATEGORY_LABEL[c]}`}><Building2 className="size-4" /> One Vendor for All of It</Button>
                </div>
              )}
            </Card>}
          </section>
        );
      })}


      {plan.feeTotal > 0 && (
        <p className="mt-4 text-sm text-muted">
          Delivery fees (once per store): {Object.entries(plan.fees).filter(([, f]) => f! > 0).map(([r, f]) => `${RETAILERS[r as keyof typeof RETAILERS].short} ${money(f!)}`).join(', ')}.
        </p>
      )}

      <ListCheck />

      {removed.length > 0 && (
        <details className="mt-6">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-forest">Off the List ({removed.length})</summary>
          <Card className="mt-2">
            <ul className="divide-y divide-line">
              {removed.map((l) => (
                <li key={l.item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="text-muted">{l.item.name}</span>
                    <span className="block text-[13px] text-muted">{REASON(l.item)}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => { update((p) => patchItem(p, l.item.id, { removed: false, removedReason: undefined, coveredBy: undefined })); toast({ title: `${l.item.name} is back on the list`, tone: 'success' }); }}>
                    <RotateCcw className="size-4" /> Bring Back
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </details>
      )}
    </>
  );
}

/** Two optional checks: common things people forget, and things the venue may already supply. */
function ListCheck() {
  const { s, plan, update, open, toast } = useStore();
  const outdoors = s.event.setting === 'outdoors';
  const names = s.items.filter((it) => !it.removed).map((it) => it.name);
  const missing = CATEGORIES.flatMap((c) =>
    REFERENCE_CHECKLIST[c].filter((r) => (!r.outdoor || outdoors) && !names.some((n) => r.match.test(n))).map((r) => ({ ...r, category: c })),
  );
  const venueItems = plan.active.filter((l) => l.item.tag !== 'vendor' && l.item.purchasedPkgs === 0 && l.status !== 'owned' && VENUE_OFTEN_PROVIDES.test(l.item.name));
  if (!missing.length && !venueItems.length) return null;
  const venue = s.event.venue?.trim();
  return (
    <details className="mt-6 rounded-2xl border border-line bg-paper">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold text-forest">
        <ListChecks className="size-4" /> Check the List <span className="font-normal text-muted">· anything missing or already provided?</span>
      </summary>
      <div className="grid gap-5 border-t border-line p-4 lg:grid-cols-2">
        {missing.length > 0 && (
          <section aria-labelledby="ck-missing">
            <h3 id="ck-missing" className="font-semibold">Often Forgotten</h3>
            <p className="text-[13px] text-muted">A reference list only. Add what you need; skip the rest.</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {missing.map((m) => (
                <li key={m.name}>
                  <button type="button" onClick={() => open({ type: 'add-item', category: m.category, name: m.name, unit: m.unit })} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-paper px-3 text-[13px] font-semibold transition-colors hover:border-forest/60 hover:bg-sage-soft hover:text-forest">
                    <Plus className="size-3.5" aria-hidden="true" /> {m.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {venueItems.length > 0 && (
          <section aria-labelledby="ck-venue">
            <h3 id="ck-venue" className="font-semibold">Already Provided?</h3>
            <p className="text-[13px] text-muted">{venue ? `If ${venue} or someone else` : 'If the venue or someone else'} is supplying any of these, tap it to take it off the list.</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {venueItems.map((l) => (
                <li key={l.item.id}>
                  <button
                    type="button"
                    onClick={() => { update((p) => patchItem(p, l.item.id, { removed: true, removedReason: 'venue' })); toast({ title: `${l.item.name}: already provided`, detail: `Saves ${money(l.cost)}. Bring it back from "Off the list".`, tone: 'info' }); }}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-paper px-3 text-[13px] font-semibold transition-colors hover:border-forest/60 hover:bg-sage-soft hover:text-forest"
                  >
                    <Building2 className="size-3.5" aria-hidden="true" /> {l.item.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </details>
  );
}
