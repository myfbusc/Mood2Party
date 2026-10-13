import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, Check, ClipboardList, Loader2, Sparkles } from 'lucide-react';
import { useStore } from '../lib/store';
import { storeShort } from '../lib/catalog';
import { computeImpact, type ImpactRow } from '../lib/plan';
import { costChange, money, plural, signed } from '../lib/format';
import { acceptChanges, type ConflictChoice } from '../lib/actions';
import { aiErrorCopy, aiName, getSample } from '../lib/ai';
import { Button, Drawer, Note, Pill, cx } from './ui';

function Row({ r, note }: { r: ImpactRow; note?: string }) {
  const b = r.before;
  const a = r.after;
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{r.item.name}</p>
        <p className="tnum text-[13px] text-muted">
          {b.need} <ArrowRight className="inline size-3" aria-label="to" /> {a.need} {r.item.unit}
          {a.pkgs !== b.pkgs && <> · packages {b.pkgs} → {a.pkgs} ({a.opt.packLabel}, {storeShort(a.opt)})</>}
        </p>
        {note && <p className="text-[13px] text-attn-ink">{note}</p>}
      </div>
      {Math.abs(r.costDelta) >= 0.005 && (
        <span className={cx('tnum text-sm font-semibold', r.costDelta > 0 ? 'text-coral' : 'text-ok')}>{costChange(r.costDelta)}</span>
      )}
    </li>
  );
}

export default function ImpactDrawer() {
  const { s, head, update, close, toast, open, go, markDid, cloud } = useStore();
  const from = s.baseline?.headcount ?? head;
  const impact = useMemo(() => computeImpact(s, from, head), [s, from, head]);
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});
  const [ai, setAi] = useState<{ ready: boolean; busy: boolean; text: string; note: string }>({ ready: false, busy: false, text: '', note: '' });

  useEffect(() => {
    if (s.baseline && s.baseline.headcount.total !== head.total) markDid('change');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    getSample().then((x) => live && setAi((p) => ({ ...p, ready: !!x })));
    return () => {
      live = false;
    };
  }, [cloud.user]);

  const buyMore = impact.rows.filter((r) => r.kind === 'buy-more');
  const sufficient = impact.rows.filter((r) => r.kind === 'sufficient');
  const reduced = impact.rows.filter((r) => r.kind === 'reduced');
  const unchanged = impact.rows.filter((r) => r.kind === 'unchanged');
  const owned = impact.rows.filter((r) => r.kind === 'owned');
  const updated = impact.rows.filter((r) => !r.item.removed && r.before.need !== r.after.need).length;
  const diff = head.total - from.total;
  const budgetLeft = s.event.budget - impact.afterTotal;
  const wasWithin = s.event.budget - impact.beforeTotal >= 0;
  const cap = s.event.venueCapacity;

  const summary = [
    `Your planning count ${diff >= 0 ? 'went up' : 'went down'} by ${Math.abs(diff)}, from ${from.total} to ${head.total} guests.`,
    buyMore.length ? `${plural(buyMore.length, 'item needs', 'items need')} more packages (${buyMore.slice(0, 3).map((r) => r.item.name.toLowerCase()).join(', ')}${buyMore.length > 3 ? ' and more' : ''}).` : 'No item needs extra packages.',
    sufficient.length ? `${plural(sufficient.length, 'item goes', 'items go')} up but the packages you planned still cover ${sufficient.length === 1 ? 'it' : 'them'}.` : '',
    `The estimate is ${costChange(impact.delta).toLowerCase()} (${money(impact.beforeTotal)} → ${money(impact.afterTotal)}), ${budgetLeft >= 0 ? `leaving ${money(budgetLeft)} in your budget` : `${money(-budgetLeft)} over your budget${wasWithin ? ', which it was not before' : ''}`}.`,
    impact.tablesTo !== impact.tablesFrom ? `You need ${impact.tablesTo} guest tables instead of ${impact.tablesFrom}.` : '',
    impact.tasks.length ? `${plural(impact.tasks.length, 'task', 'tasks')} should be rechecked.` : '',
  ].filter(Boolean).join(' ');

  const actions: string[] = [
    ...buyMore.map((r) => {
      const extra = r.after.pkgs - r.before.pkgs;
      return `Buy ${plural(extra, 'more package')} of ${r.item.name.toLowerCase()} (${r.after.opt.packLabel}) at ${storeShort(r.after.opt)}${r.item.buyer ? `; tell ${r.item.buyer}` : ''}.`;
    }),
    ...(impact.tablesTo > impact.tablesFrom ? [`Set up ${plural(impact.tablesTo - impact.tablesFrom, 'more guest table')} (${impact.tablesTo} in total).`] : []),
    ...(budgetLeft < 0 ? ['Use Compare stores for the whole list (Plan and Shop) or remove optional items to get back within budget.'] : []),
    ...(impact.tasks.some((t) => /headcount/i.test(t.title)) ? [`Send the new count (${head.total}) to your food vendor.`] : []),
  ];

  const accept = () => {
    const flagged = impact.tasks.length;
    update((p) => acceptChanges(p, choices));
    close();
    toast({ title: 'Changes accepted', detail: `${flagged ? `${plural(flagged, 'task')} marked to recheck. ` : ''}Your plan now uses ${head.total} guests.`, tone: 'success' });
  };

  const explain = async () => {
    const sample = await getSample();
    if (!sample) return;
    setAi((p) => ({ ...p, busy: true, note: '', text: '' }));
    const data = {
      event: s.event.name, from: from.total, to: head.total, budget: s.event.budget,
      totals: { before: impact.beforeTotal, after: impact.afterTotal },
      buyMore: buyMore.map((r) => ({ item: r.item.name, qty: `${r.before.need}→${r.after.need} ${r.item.unit}`, packages: `${r.before.pkgs}→${r.after.pkgs}`, cost: r.costDelta })),
      stillEnough: sufficient.map((r) => r.item.name),
      tables: { from: impact.tablesFrom, to: impact.tablesTo }, venueCapacity: cap,
      tasks: impact.tasks.map((t) => `${t.title} (${t.owner})`),
    };
    try {
      await sample(
        `You are helping a DIY party host understand a change to their plan. In 3 to 5 short, calm sentences of plain language, explain what changed, what they need to do first, and whether the budget is a concern. Use only these numbers; do not invent any. No lists, no headings.\n\n${JSON.stringify(data)}`,
        { modelTier: 'quick', onText: ({ text }: { text: string }) => setAi((p) => ({ ...p, text })) },
      );
      setAi((p) => ({ ...p, busy: false }));
    } catch (e) {
      const c = aiErrorCopy(e);
      setAi((p) => ({ ...p, busy: false, ready: c.hide ? false : p.ready, note: c.text }));
    }
  };

  const optimizeAfter = () => {
    update((p) => acceptChanges(p, choices));
    open({ type: 'optimize' });
  };

  if (!s.baseline || from.total === head.total && from.adults === head.adults) {
    return (
      <Drawer title="What Changed" onClose={close}>
        <Note tone="green">Your plan matches the last time you reviewed it. Nothing to update.</Note>
      </Drawer>
    );
  }

  return (
    <Drawer
      title="What Changed"
      subtitle="Before and after, using the same stores. Store changes are a separate step."
      onClose={close}
      wide
      footer={
        <>
          <Button onClick={accept}><Check className="size-4" /> Accept and Flag Tasks</Button>
          {budgetLeft < 0 && <Button variant="secondary" onClick={optimizeAfter}>Accept and Compare Stores</Button>}
          <Button variant="ghost" onClick={() => { close(); go('plan'); }}>See Shopping List</Button>
        </>
      }
    >
      <div className="rounded-2xl border border-line bg-paper p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div><p className="text-[13px] text-muted">Before</p><p className="tnum text-3xl font-bold text-muted">{from.total}</p></div>
          <ArrowRight className="size-6 text-muted" aria-hidden="true" />
          <div><p className="text-[13px] text-muted">Now</p><p className="tnum text-3xl font-bold text-forest">{head.total}</p></div>
          <Pill tone={diff > 0 ? 'coral' : 'green'} className="text-sm">{signed(diff)} guests</Pill>
          <p className="tnum w-full text-[13px] text-muted sm:w-auto sm:flex-1 sm:text-right">
            {from.adults} → {head.adults} adults · {from.children} → {head.children} children
          </p>
        </div>
      </div>

      <div className="tnum mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { l: 'Quantities updated', v: updated },
          { l: 'Need more packages', v: buyMore.length, tone: buyMore.length ? 'text-coral' : '' },
          { l: 'Current packages still enough', v: sufficient.length, tone: 'text-ok' },
          { l: 'Cost change', v: impact.delta === 0 ? '$0' : `${impact.delta > 0 ? '+' : '−'}${money(Math.abs(impact.delta))}`, tone: impact.delta > 0 ? 'text-coral' : 'text-ok' },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-line bg-paper p-3">
            <p className={cx('text-xl font-bold', x.tone)}>{x.v}</p>
            <p className="text-[12px] leading-tight text-muted">{x.l}</p>
          </div>
        ))}
      </div>

      <Note tone={budgetLeft < 0 ? 'coral' : 'green'} className="mt-3">
        Estimate {money(impact.beforeTotal)} → <b>{money(impact.afterTotal)}</b>.{' '}
        {budgetLeft < 0 ? <>That is <b>{money(-budgetLeft)} over</b> your {money(s.event.budget, false)} budget.</> : <>You still have <b>{money(budgetLeft)}</b> left in your budget.</>}
      </Note>

      <section className="mt-5" aria-labelledby="in-short">
        <h3 id="in-short" className="font-bold">In Short</h3>
        <p className="mt-1 text-[15px] leading-relaxed">{ai.text || summary}</p>
        {ai.ready && (
          <Button variant="quiet" size="sm" className="mt-1 -ml-2" onClick={explain} disabled={ai.busy}>
            {ai.busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {ai.busy ? `${aiName() === 'Claude' ? 'Claude' : 'The AI'} is writing…` : ai.text ? 'Explain again' : 'Explain it with Claude'}
          </Button>
        )}
        {ai.note && <p className="mt-1 text-[13px] text-muted">{ai.note}</p>}
      </section>

      {impact.conflicts.length > 0 && (
        <section className="mt-6" aria-labelledby="yours">
          <h3 id="yours" className="font-bold">Quantities You Set Yourself</h3>
          <p className="text-sm text-muted">Mood2Party will not change these without asking.</p>
          <ul className="mt-2 grid gap-2">
            {impact.conflicts.map((l) => {
              const c = choices[l.item.id] ?? 'keep';
              return (
                <li key={l.item.id} className="rounded-xl border border-gold-bright/60 bg-gold-soft p-3">
                  <p className="font-semibold">{l.item.name}</p>
                  <p className="tnum text-sm">Your quantity: <b>{l.need}</b> · Updated recommendation: <b>{l.rec}</b> {l.item.unit}</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`Quantity for ${l.item.name}`}>
                    {(['keep', 'use'] as ConflictChoice[]).map((v) => (
                      <button key={v} type="button" role="radio" aria-checked={c === v} onClick={() => setChoices((p) => ({ ...p, [l.item.id]: v }))}
                        className={cx('min-h-10 rounded-lg border px-3 text-sm font-semibold', c === v ? 'border-transparent m2p-grad' : 'border-line-strong bg-paper')}>
                        {v === 'keep' ? `Keep my ${l.need}` : `Use ${l.rec}`}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {buyMore.length > 0 && (
        <section className="mt-6" aria-labelledby="buy-more">
          <h3 id="buy-more" className="font-bold text-coral">Additional purchase required ({buyMore.length})</h3>
          <ul className="divide-y divide-line">
            {buyMore.map((r) => (
              <Row key={r.item.id} r={r} note={r.item.purchasedPkgs > 0 ? `You already bought ${plural(r.item.purchasedPkgs, 'package')}; buy ${plural(r.after.morePkgs, 'more')}.` : r.item.buyer ? `Buyer: ${r.item.buyer}` : 'No buyer assigned yet'} />
            ))}
          </ul>
        </section>
      )}

      {sufficient.length > 0 && (
        <section className="mt-6" aria-labelledby="enough">
          <h3 id="enough" className="font-bold text-ok">Current package still enough ({sufficient.length})</h3>
          <p className="text-sm text-muted">The recommended amount went up, but the packages already planned cover it. No additional purchase required.</p>
          <ul className="divide-y divide-line">{sufficient.map((r) => <Row key={r.item.id} r={r} />)}</ul>
        </section>
      )}

      {reduced.length > 0 && (
        <section className="mt-6" aria-labelledby="reduced">
          <h3 id="reduced" className="font-bold">Need Less ({reduced.length})</h3>
          <p className="text-sm text-muted">{reduced.some((r) => r.item.purchasedPkgs > 0) ? 'Some of these are already bought, so expect leftovers.' : 'You can buy less of these.'}</p>
          <ul className="divide-y divide-line">{reduced.map((r) => <Row key={r.item.id} r={r} />)}</ul>
        </section>
      )}

      <section className="mt-6" aria-labelledby="venue">
        <h3 id="venue" className="flex items-center gap-2 font-bold"><Building2 className="size-4 text-forest" /> Venue and setup</h3>
        <ul className="mt-2 grid gap-1.5 text-[15px]">
          <li>{impact.tablesTo === impact.tablesFrom ? `Guest tables stay at ${impact.tablesTo} (8 per table).` : `Guest tables: ${impact.tablesFrom} → ${impact.tablesTo} (8 per table), with a tablecloth and centerpiece each.`}</li>
          <li>Seats needed: {from.total} → {head.total}.</li>
        </ul>
      </section>

      {impact.tasks.length > 0 && (
        <section className="mt-6" aria-labelledby="tasks">
          <h3 id="tasks" className="flex items-center gap-2 font-bold"><ClipboardList className="size-4 text-forest" /> Tasks to recheck ({impact.tasks.length})</h3>
          <p className="text-sm text-muted">These get an "Affected by a change" flag when you accept, so their owners see it.</p>
          <ul className="mt-2 grid gap-1 text-[15px]">
            {impact.tasks.map((t) => <li key={t.id}>{t.title} <span className="text-muted">· {t.owner}</span></li>)}
          </ul>
        </section>
      )}

      {actions.length > 0 && (
        <section className="mt-6 rounded-2xl border border-forest/30 bg-sage-soft p-4" aria-labelledby="next">
          <h3 id="next" className="font-bold text-forest">What to Do Next</h3>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-[15px]">
            {actions.map((a) => <li key={a}>{a}</li>)}
          </ol>
        </section>
      )}

      {(unchanged.length > 0 || owned.length > 0) && (
        <details className="mt-6">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-forest">Unchanged ({unchanged.length}) and already owned ({owned.length})</summary>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {unchanged.map((r) => <li key={r.item.id}>{r.item.name}: {r.after.need} {r.item.unit}</li>)}
            {owned.map((r) => <li key={r.item.id}>{r.item.name}: you have {r.item.ownedQty}</li>)}
          </ul>
        </details>
      )}
    </Drawer>
  );
}

