import { useMemo, useState } from 'react';
import { Check, Lightbulb, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { CATEGORIES, CATEGORY_LABEL } from '../lib/catalog';
import { computePlan, round2 } from '../lib/plan';
import { lowestCostSaving } from '../lib/actions';
import { money, plural } from '../lib/format';
import { uid } from '../lib/tasks';
import { Button, Card, PageHeader, NumberInput, PaidInput, InfoTip, Progress, SectionHead, Stat, cx, inputBase } from '../components/ui';
import { patchItem, setSpend } from '../lib/actions';
import { SpendLevels, useSpendCosts } from '../components/SpendLevels';
import { levelName, levelText, SPEND_CATEGORIES, TIER_LABEL, TIER_SIGN } from '../lib/tiers';
import type { Category, Tier } from '../lib/types';
import type { OtherExpense } from '../lib/types';

/** Common extra costs, one tap to add. A minimum spend is handled differently (see plan.ts). */
const PRESETS: { name: string; kind?: OtherExpense['kind']; hint: string }[] = [
  { name: 'Restaurant minimum spend', kind: 'minimum', hint: 'Only the part your food and drinks don\'t reach is added' },
  { name: 'Party or room fee', hint: 'Private room, hall or booking fee' },
  { name: 'Cake cutting fee', hint: 'Charged by some restaurants for outside cakes' },
  { name: 'Service charge or tips', hint: 'Staff, servers, delivery' },
  { name: 'Rentals', hint: 'Tables, chairs, a tent' },
];

export default function Budget() {
  const { s, att, head, plan, update, go, toast } = useStore();
  const [newName, setNewName] = useState('');
  const [newAmt, setNewAmt] = useState('');
  const [newKind, setNewKind] = useState<OtherExpense['kind']>('cost');
  const [editBudget, setEditBudget] = useState(false);
  // The last money-saving step taken here, so it can be undone from the same spot
  const [lastSave, setLastSave] = useState<{ label: string; undo: () => void } | null>(null);
  const bought = plan.active.filter((l) => l.item.purchasedPkgs > 0);
  const spent = round2(plan.spent + plan.otherPaid);
  const stillToSpend = round2(Math.max(0, plan.grandTotal - spent));
  const afterAll = round2(s.event.budget - plan.grandTotal);
  const savePaid = (id: string, name: string, n: number | undefined) => {
    update((p) => patchItem(p, id, { paidAmount: n }));
    toast({ title: n === undefined ? `${name}: using the estimate` : `Paid ${money(n)} for ${name.toLowerCase()}`, detail: 'Spent so far and remaining budget are updated.', tone: 'success' });
  };
  const optimizeSaving = useMemo(() => lowestCostSaving(s, head, plan), [s, head, plan]);
  const optional = plan.active.filter((l) => l.item.priority === 'optional' && l.cost > 0 && l.item.purchasedPkgs === 0);
  const optionalSaving = round2(optional.reduce((a, l) => a + l.cost, 0));
  const atSuggested = computePlan(s, att.expected).grandTotal;
  const spend = s.event.spend ?? {};
  const { costs: tierCosts } = useSpendCosts(s, head, spend);
  // The kind of thing where dropping to the next level down saves the most
  const tierStep = SPEND_CATEGORIES
    .map((c) => {
      const from = spend[c] ?? 2;
      if (from <= 1) return null;
      const to = Math.max(1, Math.ceil(from) - 1) as Tier;
      return { c, from, to, save: round2(plan.byCategory[c] - tierCosts[c][to]) };
    })
    .filter((x): x is { c: Category; from: number; to: Tier; save: number } => !!x && x.save >= 5)
    .sort((a, b) => b.save - a.save)[0];
  const changeSpend = (c: Category, level: number, quiet = false) => {
    const before = spend[c] ?? 2;
    if (Math.abs(before - level) < 0.004) return;
    const beforeCost = plan.byCategory[c];
    const next = setSpend(s, c, level);
    const afterCost = computePlan(next, head).byCategory[c];
    update((p) => setSpend(p, c, level));
    const diff = round2(afterCost - beforeCost);
    if (!quiet) toast({ title: `${CATEGORY_LABEL[c]}: ${levelText(level)} ${levelName(level).replace(/^Mix/, 'mix')}`, detail: Math.abs(diff) >= 1 ? `${diff > 0 ? 'Adds' : 'Saves'} about ${money(Math.abs(diff), false)}. Items you bought or set yourself keep their price.` : 'Prices updated.', tone: 'success' });
  };
  const basisSaving = s.basis === 'custom' && head.total > att.expected.total ? round2(plan.grandTotal - atSuggested) : 0;

  const rows: { label: string; value: number }[] = [
    ...CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], value: plan.byCategory[c] })),
    { label: 'Delivery fees', value: plan.feeTotal },
    { label: 'Other Costs', value: plan.otherTotal },
  ];
  const maxRow = Math.max(...rows.map((r) => r.value), 1);

  const addExpense = () => {
    const amount = Number(newAmt);
    if (!newName.trim() || !(amount >= 0)) return;
    update((p) => ({ ...p, expenses: [...p.expenses, { id: uid('exp'), name: newName.trim(), amount, paid: false, kind: newKind }] }));
    setNewName('');
    setNewAmt('');
    setNewKind('cost');
  };

  return (
    <>
      <PageHeader title="Budget" sub={<>For <b className="text-ink">{head.total} guests</b>. The projected cost updates as your plan changes, and spending updates when you tick items as bought.</>} />

      <section data-tour="budget-summary" aria-label="Budget summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="min-w-0 rounded-3xl border border-forest/40 bg-paper p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-muted">Total budget</p>
            {!editBudget && (
              <button type="button" onClick={() => setEditBudget(true)} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-forest hover:bg-sage-soft" aria-label="Edit total budget">
                <Pencil className="size-3.5" aria-hidden="true" /> Edit
              </button>
            )}
          </div>
          {editBudget ? (
            <form className="mt-1 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setEditBudget(false); toast({ title: `Budget set to ${money(s.event.budget, false)}`, tone: 'success' }); }}>
              <label htmlFor="budget-total" className="sr-only">Total budget in dollars</label>
              <NumberInput id="budget-total" step={50} autoFocus className={cx(inputBase, 'w-28 text-lg font-bold')} value={s.event.budget} onValue={(n) => update((p) => ({ ...p, event: { ...p.event, budget: n } }))} />
              <Button size="sm" type="submit" aria-label="Done editing budget"><Check className="size-4" /></Button>
            </form>
          ) : (
            <p className="tnum mt-1 text-2xl font-bold tracking-tight">{money(s.event.budget, false)}</p>
          )}
        </div>
        <Stat
          label="Projected total cost"
          value={money(plan.grandTotal)}
          tone={plan.remaining < 0 ? 'red' : undefined}
          sub={<>{money(spent, false)} spent + {money(stillToSpend, false)} still to spend</>}
        />
        <Stat label="Actually spent so far" value={money(spent)} sub="Items bought and costs marked paid" />
        <Stat
          label="Remaining budget"
          value={money(Math.abs(plan.leftToSpend))}
          tone={plan.leftToSpend < 0 ? 'red' : 'green'}
          sub={afterAll >= 0 ? <>{money(afterAll, false)} left after buying the rest</> : <span className="font-semibold text-danger">{money(-afterAll, false)} over after buying the rest</span>}
        />
      </section>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[13px] text-muted">
          <span>Projected cost compared with budget</span>
          <span className="tnum font-semibold">{Math.round((plan.grandTotal / Math.max(1, s.event.budget)) * 100)}%</span>
        </div>
        <Progress label="Projected cost compared with budget" value={plan.grandTotal} max={s.event.budget} tone={plan.remaining < 0 ? 'coral' : 'forest'} />
      </div>

      <section id="purchases" className="mt-8 scroll-mt-24" aria-labelledby="purchases-h">
        <SectionHead id="purchases-h" title={<span className="inline-flex items-center gap-1">What You've Bought<InfoTip label="About amounts paid">Type what you actually paid. An empty box uses the estimate.</InfoTip></span>} count={bought.length} />
        <Card>
          {bought.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted">Nothing bought yet. Tick an item in Plan and Shop when you buy it, then enter what you paid here or on the item.</p>
          ) : (
            <ul className="divide-y divide-line">
              {bought.map((l) => {
                const est = round2(l.item.purchasedPkgs * l.opt.packPrice);
                const diff = l.paidEntered ? round2((l.item.paidAmount ?? 0) - est) : 0;
                return (
                  <li key={l.item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{l.item.name}</span>
                      <span className="tnum block text-[13px] text-muted">
                        Estimate {money(est)}
                        {l.paidEntered && diff !== 0 && <> · <span className={diff > 0 ? 'font-semibold text-danger' : 'font-semibold text-ok'}>{money(Math.abs(diff))} {diff > 0 ? 'more' : 'less'}</span></>}
                        {l.status === 'buy-more' && <> · still need {plural(l.morePkgs, 'more pack', 'more packs')}</>}
                      </span>
                    </span>
                    <PaidInput id={`bpaid-${l.item.id}`} label={`Amount paid for ${l.item.name}`} value={l.item.paidAmount} estimate={est} onSave={(n) => savePaid(l.item.id, l.item.name, n)} />
                  </li>
                );
              })}
              <li className="tnum flex justify-between px-4 py-3 font-bold"><span>Items bought</span><span>{money(plan.spent)}</span></li>
            </ul>
          )}
        </Card>
      </section>

      <div className="mt-8">
        <section aria-labelledby="bycat" className="min-w-0">
          <SectionHead id="bycat" title="Where the Money Goes" />
          <Card className="p-4">
            <ul className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              {rows.map((r) => (
                <li key={r.label} className="grid gap-1">
                  <div className="flex justify-between text-[15px]"><span>{r.label}</span><span className="tnum font-semibold">{money(r.value)}</span></div>
                  <div className="h-2 rounded-full bg-cream"><div className="h-2 rounded-full bg-sage" style={{ width: `${(r.value / maxRow) * 100}%` }} /></div>
                </li>
              ))}
              <li className="flex justify-between border-t border-line pt-3 font-bold md:col-span-2"><span>Total</span><span className="tnum">{money(plan.grandTotal)}</span></li>
            </ul>
          </Card>
        </section>

        <section aria-labelledby="levels" className="mt-8 min-w-0">
          <SectionHead id="levels" title={<span className="inline-flex items-center gap-1">Spending Levels<InfoTip label="About spending levels">Slide toward $ to save on a kind of thing, or toward $$$ for nicer products. Items you already bought, and items you set a level for yourself, keep their price.</InfoTip></span>} />
          <Card className="p-4 sm:p-5">
            <SpendLevels state={s} head={head} value={spend} onChange={(c, t) => changeSpend(c, t)} compact />
          </Card>
        </section>
      </div>

      {(optimizeSaving > 0 || optional.length > 0 || basisSaving > 0 || tierStep || lastSave) && <section className="mt-8" aria-labelledby="save">
        <SectionHead id="save" title={plan.remaining < 0 ? 'Ways to Get Back Within Budget' : 'Ways to Save'} />
        {lastSave && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper px-4 py-2.5">
            <p className="flex items-center gap-2 text-[15px]"><Check className="size-4 text-ok" aria-hidden="true" /> {lastSave.label}</p>
            <Button size="sm" variant="secondary" onClick={lastSave.undo}><Undo2 className="size-4" /> Undo</Button>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          {optimizeSaving > 0 && <Card className="flex flex-col p-4">
            <Lightbulb className="size-5 text-gold" />
            <p className="mt-2 font-bold">Switch Stores</p>
            <p className="mt-1 flex-1 text-sm text-muted">{`A cheaper mix of stores saves about ${money(optimizeSaving)}.`}</p>
            <Button size="sm" variant="secondary" className="mt-3 self-start" onClick={() => go('plan')} disabled={optimizeSaving <= 0}>Open Plan and Shop</Button>
          </Card>}
          {tierStep && <Card className="flex flex-col p-4">
            <Lightbulb className="size-5 text-gold" />
            <p className="mt-2 font-bold">Go {TIER_LABEL[tierStep.to]} on {CATEGORY_LABEL[tierStep.c]}</p>
            <p className="mt-1 flex-1 text-sm text-muted">{`Moving ${CATEGORY_LABEL[tierStep.c].toLowerCase()} from ${levelText(tierStep.from)} to ${TIER_SIGN[tierStep.to]} saves about ${money(tierStep.save, false)}.`}</p>
            <Button size="sm" variant="secondary" className="mt-3 self-start" onClick={() => {
              const { c, from, to, save } = tierStep;
              changeSpend(c, to, true);
              const undo = () => { update((p) => setSpend(p, c, from)); setLastSave(null); toast({ title: `${CATEGORY_LABEL[c]} back to ${levelText(from)}`, tone: 'info' }); };
              setLastSave({ label: `${CATEGORY_LABEL[c]} set to ${TIER_SIGN[to]} ${TIER_LABEL[to]} (saves ${money(save, false)})`, undo });
              toast({ title: `${CATEGORY_LABEL[c]}: ${TIER_SIGN[to]} ${TIER_LABEL[to]}`, detail: `Saves about ${money(save, false)}.`, tone: 'success', action: { label: 'Undo', run: undo } });
            }}>Switch to {TIER_SIGN[tierStep.to]}</Button>
          </Card>}
          {optional.length > 0 && <Card className="flex flex-col p-4">
            <Lightbulb className="size-5 text-gold" />
            <p className="mt-2 font-bold">Skip Optional Items</p>
            <p className="mt-1 flex-1 text-sm text-muted">
              {plural(optional.length, 'optional item')} you haven't bought: {money(optionalSaving)} together.
            </p>
            <Button
              size="sm" variant="secondary" className="mt-3 self-start" disabled={!optional.length}
              onClick={() => {
                const ids = new Set(optional.map((l) => l.item.id));
                const n = optional.length;
                update((p) => ({ ...p, items: p.items.map((it) => (ids.has(it.id) ? { ...it, removed: true } : it)) }));
                const undo = () => {
                  update((p) => ({ ...p, items: p.items.map((it) => (ids.has(it.id) ? { ...it, removed: false } : it)) }));
                  setLastSave(null);
                  toast({ title: `${plural(n, 'optional item')} back on the list`, tone: 'info' });
                };
                setLastSave({ label: `Removed ${plural(n, 'optional item')} (saves ${money(optionalSaving)})`, undo });
                toast({ title: `Removed ${plural(n, 'optional item')}`, detail: `Saves ${money(optionalSaving)}.`, tone: 'success', action: { label: 'Undo', run: undo } });
              }}
            >
              Remove Optional Items
            </Button>
          </Card>}
          {basisSaving > 0 && <Card className="flex flex-col p-4">
            <Lightbulb className="size-5 text-gold" />
            <p className="mt-2 font-bold">Use the Suggested Guest Number</p>
            <p className="mt-1 flex-1 text-sm text-muted">
              {`Planning for ${att.expected.total} instead of ${head.total} saves about ${money(basisSaving)}.`}
            </p>
            <Button size="sm" variant="secondary" className="mt-3 self-start" disabled={basisSaving <= 0} onClick={() => {
              const prev = { basis: s.basis, customCount: s.customCount };
              const n = att.expected.total;
              update((p) => ({ ...p, basis: 'expected' }));
              const undo = () => {
                update((p) => ({ ...p, ...prev }));
                setLastSave(null);
                toast({ title: `Back to planning for ${head.total}`, tone: 'info' });
              };
              setLastSave({ label: `Now planning for ${n} instead of ${head.total}`, undo });
              toast({ title: `Planning for ${n}`, detail: `Saves about ${money(basisSaving)}.`, tone: 'success', action: { label: 'Undo', run: undo } });
            }}>
              Plan for {att.expected.total}
            </Button>
          </Card>}
        </div>
      </section>}

      <section className="mt-8" aria-labelledby="other">
        <SectionHead id="other" title="Other Costs" count={s.expenses.length} />
        <Card>
          <ul className="divide-y divide-line">
            {s.expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <input
                  type="checkbox" className="size-5 accent-forest" checked={e.paid}
                  aria-label={`Mark ${e.name} as paid`}
                  onChange={() => update((p) => ({ ...p, expenses: p.expenses.map((x) => (x.id === e.id ? { ...x, paid: !x.paid } : x)) }))}
                />
                <span className={cx('min-w-0 flex-1 font-semibold max-sm:basis-[calc(100%-2.75rem)]', e.paid && 'text-muted')}>
                  {e.name}{e.paid && <span className="ml-2 text-[13px] font-medium text-ok">Paid</span>}
                  {e.kind === 'minimum' && (
                    <span className="tnum block text-[13px] font-normal text-muted">
                      Minimum {money(Number(e.amount) || 0, false)} · food and drinks {money(plan.byCategory.food, false)} ·{' '}
                      {plan.expenseCost(e) > 0 ? <b className="text-ink">adds {money(plan.expenseCost(e))} to reach it</b> : 'already reached, adds nothing'}
                    </span>
                  )}
                </span>
                <label htmlFor={`amt-${e.id}`} className="sr-only">Amount for {e.name}</label>
                <NumberInput id={`amt-${e.id}`} inputMode="decimal" className={cx(inputBase, 'w-28 text-right max-sm:ml-8')} value={e.amount} onValue={(n) => update((p) => ({ ...p, expenses: p.expenses.map((x) => (x.id === e.id ? { ...x, amount: n } : x)) }))} />
                <button type="button" aria-label={`Delete ${e.name}`} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger" onClick={() => update((p) => ({ ...p, expenses: p.expenses.filter((x) => x.id !== e.id) }))}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {s.expenses.length === 0 && <li className="px-4 py-4 text-sm text-muted">Add costs that are not on the shopping list, like a venue fee, rentals or a photographer.</li>}
          </ul>
          <div className="border-t border-line px-4 pt-3">
            <p className="text-[13px] font-semibold text-muted">Quick add</p>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {PRESETS.filter((pr) => !s.expenses.some((e) => e.name === pr.name)).map((pr) => (
                <li key={pr.name}>
                  <button type="button" title={pr.hint} onClick={() => { setNewName(pr.name); setNewKind(pr.kind ?? 'cost'); document.getElementById('exp-amt')?.focus(); }} className={cx('inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold hover:border-forest/60', newName === pr.name ? 'border-forest bg-sage-soft text-forest' : 'border-line bg-paper')}>
                    <Plus className="size-3.5" aria-hidden="true" /> {pr.name}
                  </button>
                </li>
              ))}
            </ul>
            {newKind === 'minimum' && <p className="mt-2 text-[13px] text-muted">Enter the minimum the restaurant requires. Mood2Party only adds the part your food and drinks don't already reach.</p>}
          </div>
          <form className="flex flex-wrap gap-2 border-t border-line p-4" onSubmit={(e) => { e.preventDefault(); addExpense(); }}>
            <label htmlFor="exp-name" className="sr-only">Cost name</label>
            <input id="exp-name" className={cx(inputBase, 'min-w-0 flex-1 basis-48')} placeholder="For example, tent rental" value={newName} onChange={(e) => { setNewName(e.target.value); if (newKind === 'minimum' && !/minimum/i.test(e.target.value)) setNewKind('cost'); }} />
            <label htmlFor="exp-amt" className="sr-only">Amount</label>
            <input id="exp-amt" type="number" min={0} className={cx(inputBase, 'w-28')} placeholder="$" value={newAmt} onChange={(e) => setNewAmt(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={!newName.trim() || newAmt === ''}><Plus className="size-4" /> Add Cost</Button>
          </form>
        </Card>
      </section>
    </>
  );
}
