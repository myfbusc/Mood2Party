import { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Play, Plus, Send, Users, Utensils } from 'lucide-react';
import { useStore } from '../lib/store';
import { computePlan } from '../lib/plan';
import { dateLabel, money, plural } from '../lib/format';
import { daysBetween, todayISO, uid } from '../lib/tasks';
import { simulateRsvpReplies } from '../lib/demo';
import { ensureKidsItems, keepCountOnFirstGuest } from '../lib/actions';
import { Button, Card, Field, InfoTip, PageHeader, Pill, SectionHead, Segmented, NumberInput, cx, inputBase, inputCls, type Tone } from '../components/ui';
import type { GuestGroup, Headcount, PlanningBasis, RSVPStatus } from '../lib/types';

/** Guest groups shown before "Show all" (keeps long lists short). */
const GUEST_PREVIEW = 10;

/** The three statuses people can pick. "No reply yet" was merged into "Not sure yet". */
export const STATUS_OPTIONS: RSVPStatus[] = ['confirmed', 'maybe', 'declined'];
export const STATUS_LABEL: Record<RSVPStatus, string> = {
  confirmed: 'Confirmed', maybe: 'Not sure yet', unresponsive: 'Not sure yet', declined: "Can't come",
};
export const STATUS_TONE: Record<RSVPStatus, Tone> = { confirmed: 'green', maybe: 'gold', unresponsive: 'gold', declined: 'gray' };
const STATUS_SELECT: Record<RSVPStatus, string> = {
  confirmed: 'bg-ok-soft text-ok', maybe: 'bg-gold-soft text-warn-ink', unresponsive: 'bg-gold-soft text-warn-ink', declined: 'bg-chip text-muted',
};
/** Older plans can still hold "unresponsive"; show it as "Not sure yet". */
export const shownStatus = (s: RSVPStatus): RSVPStatus => (s === 'unresponsive' ? 'maybe' : s);


type Filter = 'all' | 'confirmed' | 'maybe' | 'declined';

/** "2 adults, 1 child, +1" */
function partyText(g: GuestGroup) {
  const parts = [plural(g.adults, 'adult')];
  if (g.children) parts.push(plural(g.children, 'kid'));
  if (g.plusOnes) parts.push(`+${g.plusOnes} plus-one${g.plusOnes === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export default function Guests() {
  const { s, att, head, update, open, toast, markDid } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const deadlineDays = daysBetween(todayISO(), s.event.rsvpDeadline);

  // Quick add form (the only "add" entry point on this page)
  const [qName, setQName] = useState('');
  const [qAdults, setQAdults] = useState(1);
  const [qKids, setQKids] = useState(0);
  const [qPlus, setQPlus] = useState(0);
  const [qStatus, setQStatus] = useState<RSVPStatus>('confirmed');
  const [qMore, setQMore] = useState(false);
  const [qDiet, setQDiet] = useState('');
  const [qAllergy, setQAllergy] = useState('');
  const [qNote, setQNote] = useState('');

  const quickAdd = () => {
    const name = qName.trim();
    if (!name) return;
    const g: GuestGroup = {
      id: uid('guest'), name, adults: qAdults, children: qKids, status: qStatus,
      note: qNote.trim(), plusOnes: qPlus || undefined, dietary: qDiet.trim() || undefined, allergies: qAllergy.trim() || undefined,
    };
    update((p) => keepCountOnFirstGuest(p, ensureKidsItems({ ...p, guests: [g, ...p.guests] })));
    toast({ title: `Added ${name}`, detail: `${qAdults + qKids + qPlus} ${qAdults + qKids + qPlus === 1 ? 'person' : 'people'}, ${STATUS_LABEL[qStatus].toLowerCase()}.`, tone: 'success' });
    setQName(''); setQAdults(1); setQKids(0); setQPlus(0); setQDiet(''); setQAllergy(''); setQNote('');
  };
  const setStatus = (id: string, status: RSVPStatus) => update((p) => ({ ...p, guests: p.guests.map((g) => (g.id === id ? { ...g, status } : g)) }));

  const shown = s.guests.filter((g) => filter === 'all' || shownStatus(g.status) === filter);
  const notSure = att.byStatus.maybe;

  // Dietary needs and allergies across everyone who might come
  const needs = useMemo(() => {
    const coming = s.guests.filter((g) => g.status !== 'declined');
    return {
      dietary: coming.filter((g) => g.dietary?.trim()).map((g) => ({ who: g.name, what: g.dietary!.trim() })),
      allergies: coming.filter((g) => g.allergies?.trim()).map((g) => ({ who: g.name, what: g.allergies!.trim() })),
    };
  }, [s.guests]);

  return (
    <>
      <PageHeader
        title="Guests and RSVPs"
        sub={<>Replies due {dateLabel(s.event.rsvpDeadline)} · {deadlineDays >= 0 ? `${plural(deadlineDays, 'day')} left` : `passed ${plural(-deadlineDays, 'day')} ago`}</>}
      >
        {s.isDemo && (
          <Button variant="secondary" onClick={() => { update((p) => ensureKidsItems({ ...p, guests: simulateRsvpReplies(p.guests) })); toast({ title: 'New RSVP replies arrived', detail: 'Three groups confirmed and a new group of 5 was added.', tone: 'info' }); }}>
            <Play className="size-4" /> Simulate New Replies
          </Button>
        )}
        <Button onClick={() => open({ type: 'rsvp' })}><Send className="size-4" /> Send RSVP Link</Button>
      </PageHeader>

      {/* 1. The one number everything is planned for */}
      <PlanFor head={head} markDid={markDid} />

      {/* 2. Add guests */}
      <Card className="mt-4 p-4 sm:p-5">
        <h2 className="flex items-center gap-1 font-display text-lg font-semibold">
          Add a Guest Group
          <InfoTip label="About guest groups">One person, a couple or a whole family. Plus-ones count as adults. You can edit a group anytime.</InfoTip>
        </h2>
        <form className="mt-3" onSubmit={(e) => { e.preventDefault(); quickAdd(); }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_84px_92px_150px_auto] sm:items-end">
            <Field label="Name" htmlFor="q-name" className="col-span-2 sm:col-span-1"><input id="q-name" className={inputCls} placeholder="e.g. Sam Rivera" value={qName} onChange={(e) => setQName(e.target.value)} /></Field>
            <Field label="Adults" htmlFor="q-a"><NumberInput id="q-a" className={inputCls} value={qAdults} onValue={(n) => setQAdults(Math.round(n))} /></Field>
            <Field label="Plus-ones" htmlFor="q-p"><NumberInput id="q-p" className={inputCls} value={qPlus} onValue={(n) => setQPlus(Math.round(n))} /></Field>
            <Field label="Status" htmlFor="q-s" className="col-span-2 sm:col-span-1">
              <select id="q-s" className={inputCls} value={qStatus} onChange={(e) => setQStatus(e.target.value as RSVPStatus)}>
                {STATUS_OPTIONS.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
            </Field>
            <Button type="submit" className="col-span-2 min-h-11 sm:col-span-1" disabled={!qName.trim()}><Plus className="size-4" /> Add</Button>
          </div>
          {qMore && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[84px_repeat(3,minmax(0,1fr))]">
              <Field label="Kids" htmlFor="q-k"><NumberInput id="q-k" className={inputCls} value={qKids} onValue={(n) => setQKids(Math.round(n))} /></Field>
              <Field label="Dietary needs" htmlFor="q-diet"><input id="q-diet" className={inputCls} placeholder="Vegetarian…" value={qDiet} onChange={(e) => setQDiet(e.target.value)} /></Field>
              <Field label="Allergies" htmlFor="q-allergy"><input id="q-allergy" className={inputCls} placeholder="Peanuts…" value={qAllergy} onChange={(e) => setQAllergy(e.target.value)} /></Field>
              <Field label="Note" htmlFor="q-note"><input id="q-note" className={inputCls} placeholder="Bringing dessert…" value={qNote} onChange={(e) => setQNote(e.target.value)} /></Field>
            </div>
          )}
          <button type="button" onClick={() => setQMore((v) => !v)} aria-expanded={qMore} className="mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-forest">
            <ChevronDown className={cx('size-4 transition-transform', qMore && 'rotate-180')} aria-hidden="true" /> {qMore ? 'Fewer details' : 'More: kids, dietary needs, allergies, note'}
          </button>
        </form>
      </Card>

      {/* 4. The guest list */}
      {s.guests.length > 0 && (
        <section className="mt-6" aria-labelledby="guest-list">
          <SectionHead id="guest-list" title="Guest Groups" count={s.guests.length} />
          <Segmented
            size="sm"
            label="Filter guests"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All ${s.guests.length}` },
              { value: 'confirmed', label: `Confirmed ${att.byStatus.confirmed.groups}` },
              { value: 'maybe', label: `Not sure yet ${notSure.groups}` },
              { value: 'declined', label: `Can't come ${att.byStatus.declined.groups}` },
            ]}
          />

          {(needs.dietary.length > 0 || needs.allergies.length > 0) && (
            <p className="mt-3 flex items-start gap-1.5 text-[13px] text-muted">
              <Utensils className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {needs.allergies.length > 0 && <><b className="text-ink">Allergies:</b> {needs.allergies.map((n) => `${n.what} (${n.who})`).join(', ')}</>}
                {needs.allergies.length > 0 && needs.dietary.length > 0 && ' · '}
                {needs.dietary.length > 0 && <><b className="text-ink">Dietary:</b> {needs.dietary.map((n) => `${n.what} (${n.who})`).join(', ')}</>}
              </span>
            </p>
          )}

          <Card className="mt-3">
            <ul className="divide-y divide-line">
              {(showAll || filter !== 'all' ? shown : shown.slice(0, GUEST_PREVIEW)).map((g) => (
                <li key={g.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{g.name}</p>
                    <p className="tnum text-[13px] text-muted">
                      {partyText(g)}{g.note ? ` · ${g.note}` : ''}
                    </p>
                    {(g.dietary || g.allergies) && (
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {g.allergies && <Pill tone="coral">Allergy: {g.allergies}</Pill>}
                        {g.dietary && <Pill tone="sage">{g.dietary}</Pill>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`st-${g.id}`}>RSVP Status for {g.name}</label>
                    <select
                      id={`st-${g.id}`}
                      value={shownStatus(g.status)}
                      onChange={(e) => setStatus(g.id, e.target.value as RSVPStatus)}
                      className={cx('min-h-10 rounded-full border-0 px-3 text-[13px] font-semibold', STATUS_SELECT[g.status])}
                    >
                      {STATUS_OPTIONS.map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
                    </select>
                    <button type="button" onClick={() => open({ type: 'guest', id: g.id })} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-cream hover:text-ink" aria-label={`Edit ${g.name}`}>
                      <Pencil className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
              {shown.length === 0 && <li className="px-4 py-6 text-sm text-muted">No guests match this filter.</li>}
            </ul>
            {filter === 'all' && shown.length > GUEST_PREVIEW + 2 && (
              <div className="border-t border-line p-2">
                <Button variant="quiet" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                  {showAll ? 'Show Fewer' : `Show All ${shown.length} Groups`}
                </Button>
              </div>
            )}
          </Card>
        </section>
      )}

    </>
  );
}

/** Before replies, minimum and maximum are your guess give or take 20%. */
const spread = (n: number) => ({ min: Math.max(0, Math.round(n * 0.8)), max: Math.round(n * 1.2) });

function PlanFor({ head, markDid }: { head: Headcount; markDid: (a: 'basis') => void }) {
  const { s, att, update } = useStore();
  const noReplies = att.source === 'estimate';
  const guess = s.estimate.expected;
  const range = noReplies ? spread(guess) : { min: att.min.total, max: att.max.total };
  const OPTIONS: { b: PlanningBasis; label: string; n?: number }[] = [
    { b: 'min', label: 'Minimum', n: range.min },
    { b: 'expected', label: 'Expected', n: att.expected.total },
    { b: 'max', label: 'Maximum', n: range.max },
    { b: 'custom', label: 'My own number' },
  ];

  const setNumber = (n: number) => {
    const v = Math.max(0, Math.round(n));
    markDid('basis');
    if (noReplies && s.basis === 'expected') {
      // Before replies, "Expected" is your guess: typing changes the guess (and its range)
      update((p) => ({ ...p, estimate: { ...p.estimate, expected: v, ...spread(v) } }));
    } else {
      update((p) => ({ ...p, basis: 'custom', customCount: v }));
    }
  };
  const choose = (b: PlanningBasis) => {
    markDid('basis');
    update((p) => ({
      ...p,
      basis: b,
      customCount: b === 'custom' ? head.total : p.customCount,
      estimate: noReplies ? { ...p.estimate, ...spread(p.estimate.expected) } : p.estimate,
    }));
  };
  const [kidsOpen, setKidsOpen] = useState(false);
  const kids = typeof s.estimate.children === 'number' ? s.estimate.children : Math.round((s.estimate.expected * s.estimate.childPct) / 100);
  const setKids = (n: number) => update((p) => {
    const c = Math.max(0, Math.min(p.estimate.expected, Math.round(n)));
    return ensureKidsItems({ ...p, estimate: { ...p.estimate, children: c, childPct: p.estimate.expected ? Math.round((c / p.estimate.expected) * 100) : 0 } });
  });

  const cost = computePlan(s, head).grandTotal;
  // A slider for the planning number, with the minimum-to-maximum band behind it.
  // Its ends stay put while dragging; letting go on Min, Expected or Max picks that option.
  const [drag, setDrag] = useState<{ n: number; lo: number; hi: number } | null>(null);
  const pad = Math.max(2, Math.round((range.max - range.min) * 0.25));
  const bounds = drag ?? { lo: Math.max(0, Math.min(range.min, head.total) - pad), hi: Math.max(range.max, head.total) + pad };
  const shown = drag?.n ?? head.total;
  // Positions line up with the slider's thumb (20px wide), not the raw track
  const at = (n: number) => { const f = Math.min(1, Math.max(0, (n - bounds.lo) / Math.max(1, bounds.hi - bounds.lo))); return `calc(${f * 100}% + ${10 - f * 20}px)`; };
  const commitDrag = (n: number) => {
    setDrag(null);
    if (n === head.total) return;
    markDid('basis');
    const tick = n === range.min ? 'min' : n === att.expected.total ? 'expected' : n === range.max ? 'max' : null;
    if (tick) choose(tick);
    else update((p) => ({ ...p, basis: 'custom', customCount: n }));
  };
  const ticks = [
    { b: 'min' as const, label: 'Min', n: range.min },
    { b: 'expected' as const, label: 'Expected', n: att.expected.total },
    { b: 'max' as const, label: 'Max', n: range.max },
  ];

  return (
    <Card className="relative overflow-hidden px-4 py-4 sm:px-5">
      <span className="m2p-grad absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
      <div data-tour="scenarios" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="m2p-grad grid size-11 shrink-0 place-items-center rounded-2xl" aria-hidden="true"><Users className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-1 font-display text-lg font-semibold leading-tight">
              Planning For
              <InfoTip label="How the planning number works">
                Shopping amounts, budget and tasks all follow this number.{' '}
                {noReplies
                  ? <>Before guests reply, <b>Expected</b> is your guess, and <b>Minimum</b> and <b>Maximum</b> are 20% below and above it.</>
                  : <><b>Minimum</b> counts confirmed guests. <b>Expected</b> adds {Math.round(s.weights.maybe * 100)}% of those not sure yet. <b>Maximum</b> counts everyone who hasn't said no.</>}
                {' '}Pick <b>My own number</b> or type any number.
              </InfoTip>
            </h2>
            <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span>{head.children > 0 ? <>{head.adults} adults · {head.children} kids</> : plural(head.total, 'person', 'people')}</span>
              <span className="rounded-full bg-sage-soft px-2 py-0.5 font-semibold text-forest">about {money(cost, false)}</span>
              {noReplies && kids === 0 && !kidsOpen && <button type="button" onClick={() => setKidsOpen(true)} className="font-semibold text-forest underline underline-offset-2">Any kids?</button>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label htmlFor="plan-count" className="sr-only">Plan for how many people</label>
          <NumberInput id="plan-count" className={cx(inputBase, 'h-12 w-24 rounded-2xl border-2 border-forest/40 text-center font-display text-2xl font-bold text-ink focus:border-forest')} value={shown} onValue={setNumber} />
          <label htmlFor="plan-basis" className="sr-only">Which number to plan for</label>
          <select id="plan-basis" className={cx(inputBase, 'h-12 w-auto min-w-44 rounded-2xl font-semibold')} value={s.basis} onChange={(e) => choose(e.target.value as PlanningBasis)}>
            {OPTIONS.map((o) => <option key={o.b} value={o.b}>{o.label}{o.n !== undefined ? ` (${o.n})` : ''}</option>)}
          </select>
          {noReplies && (kids > 0 || kidsOpen) && (
            <span className="flex items-center gap-2">
              <label htmlFor="est-kids" className="ml-1 text-sm font-semibold">Kids</label>
              <NumberInput id="est-kids" className={cx(inputBase, 'h-12 w-16 rounded-2xl text-center')} value={kids} onValue={setKids} />
            </span>
          )}
        </div>
      </div>

      {range.max > range.min && (
        <div className="mt-4 pl-0 sm:pl-14">
          <div className="relative flex h-7 items-center">
            <div className="absolute inset-x-0 h-2 rounded-full bg-chip" aria-hidden="true" />
            <div className="absolute h-2 rounded-full bg-sage/70" style={{ left: at(range.min), right: `calc(100% - ${at(range.max)})` }} aria-hidden="true" />
            <input
              type="range"
              aria-label="Plan for how many people"
              aria-valuetext={`${shown} people`}
              min={bounds.lo}
              max={bounds.hi}
              step={1}
              value={shown}
              onChange={(e) => setDrag({ n: Number(e.target.value), lo: bounds.lo, hi: bounds.hi })}
              onPointerUp={(e) => commitDrag(Number((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => commitDrag(Number((e.target as HTMLInputElement).value))}
              onBlur={() => { if (drag) commitDrag(drag.n); }}
              className="m2p-range-plain relative w-full cursor-pointer touch-pan-y"
            />
          </div>
          <div className="relative mt-1 h-4 text-[12px]" aria-hidden="true">
            {ticks.map((t, i) => (
              <button
                type="button"
                tabIndex={-1}
                key={t.b}
                onClick={() => choose(t.b)}
                className={cx('tnum absolute whitespace-nowrap hover:text-ink', i === 1 && '-translate-x-1/2', s.basis === t.b ? 'font-bold text-forest' : 'text-muted')}
                style={i === 0 ? { left: `max(0px, calc(${at(t.n)} - 10px))` } : i === 2 ? { right: `max(0px, calc(100% - ${at(t.n)} - 10px))` } : { left: at(t.n) }}
              >
                {t.label} {t.n}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
