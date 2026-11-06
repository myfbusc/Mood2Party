import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, Copy, Hand, LogOut, MessageSquareText, MoreHorizontal, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { eventDetail, useStore, type EventDetail } from '../lib/store';
import { demoState } from '../lib/demo';
import { Logo } from '../components/Shell';
import { AccountMenu } from '../components/AccountMenu';
import { HeroArt } from '../components/HeroArt';
import { Button, cx } from '../components/ui';
import { dateLabel } from '../lib/format';
import { daysBetween, todayISO } from '../lib/tasks';
import { withBaseline } from '../lib/actions';

export default function Welcome() {
  const { s, replace, go, startTour, tour, cloud } = useStore();
  const startDemo = () => {
    const demo = demoState(s.learnings);
    // Keep whatever onboarding the person has already seen or skipped
    replace(withBaseline({ ...demo, onboarding: { ...demo.onboarding, introSeen: s.onboarding.introSeen, tourDone: s.onboarding.tourDone } }));
    go('overview');
  };
  const ready = s.isDemo && !!s.onboarding.tourCompleted;
  // Loading the sample party would replace a saved plan, so it is only offered when there is none.
  const hasOwnPlan = s.started && !s.isDemo;
  if (ready) return <ReadyToPlan />;
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <AccountMenu compact />
      </div>

      {tour === null && <InviteCard />}
      {tour === null && <YourParties />}

      <section className="mx-auto grid max-w-[1120px] items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-14">
        <div>
          <h1 className=" font-display text-[38px] font-semibold leading-[1.08] text-ink sm:text-[52px]">
            Plan confidently, <span className="m2p-grad-text">even when the details change.</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-muted">
            Guests, shopping, budget and tasks in one plan that updates as replies come in.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" variant={hasOwnPlan ? 'secondary' : 'primary'} data-tour="home-create" onClick={() => go('setup')}>
              Create an Event <ArrowRight className="size-5" />
            </Button>
{!hasOwnPlan && (
            <Button size="lg" variant="secondary" onClick={startDemo}>
              Explore the Sample Party
            </Button>
            )}
          </div>
          <p className="mt-3 text-[13px] text-muted">
            {cloud.available ? 'Look around without an account. You sign in with Google to save your plan.' : 'No account needed. Your plan stays in this browser.'}{' '}
            {s.onboarding.introSeen && !s.onboarding.tourCompleted && (
              <button type="button" onClick={startTour} className="font-semibold text-forest underline">Take the 1-Minute Tour</button>
            )}
          </p>
        </div>

        <HeroArt className="mx-auto w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[480px]" />
      </section>

      <section className="border-t border-line bg-paper/60" aria-labelledby="who-does-what">
        <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6">
          <h2 id="who-does-what" className="font-display text-[24px] font-semibold">What Mood2Party Does, and What You Do</h2>
          <p className="mt-1 max-w-[40rem] text-[15px] text-muted">It works things out and points out what changed. It never buys, books or messages anyone for you.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-line bg-paper p-5">
              <p className="flex items-center gap-2 font-display text-[18px] font-semibold"><RefreshCw className="size-5 text-forest" aria-hidden="true" /> Updates Automatically</p>
              <ul className="mt-3 grid gap-2 text-[15px] text-muted">
                <li>Quantities and packages when the guest count changes</li>
                <li>Cost estimate, money spent and money left</li>
                <li>Which items still need buying, and which packs are still enough</li>
                <li>Tasks marked to recheck after a change, and due dates when the date moves</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-line bg-paper p-5">
              <p className="flex items-center gap-2 font-display text-[18px] font-semibold"><Hand className="size-5 text-coral" aria-hidden="true" /> You Enter or Decide</p>
              <ul className="mt-3 grid gap-2 text-[15px] text-muted">
                <li>Guests and their replies</li>
                <li>How many people to plan for</li>
                <li>What to buy, where, and what you actually paid</li>
                <li>Who buys each item and who does each task, and telling them</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

/** Where the demo tour ends: one clear next step, starting the user's own plan. */
function ReadyToPlan() {
  const { go } = useStore();
  const steps = [
    { icon: MessageSquareText, t: 'Describe Your Event', d: 'A sentence or two, or a short form.' },
    { icon: ClipboardCheck, t: 'Check What We Understood', d: 'Fix anything that is off.' },
    { icon: Sparkles, t: 'Get Your Plan', d: 'Shopping list, budget and tasks, ready to adjust.' },
  ];
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <AccountMenu compact />
      </div>
      <main className="mx-auto grid max-w-[1120px] items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1 text-sm font-semibold text-ok">
            <CheckCircle2 className="size-4" /> You finished the tour
          </p>
          <h1 className="mt-4 font-display text-[38px] font-semibold leading-[1.08] text-ink sm:text-[52px]">Ready to plan <span className="m2p-grad-text">your own event?</span></h1>
          <p className="mt-5 max-w-[32rem] text-[17px] leading-relaxed text-muted">
            Tell us about your party and Mood2Party builds the first version of your plan. You can change everything later.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="sm:whitespace-nowrap" onClick={() => go('setup')}>
              Start Planning My Event <ArrowRight className="size-5" />
            </Button>
            <Button size="lg" variant="ghost" className="sm:whitespace-nowrap" onClick={() => go('overview')}>
              <ArrowLeft className="size-5" /> Back to the Sample Party
            </Button>
          </div>
          <p className="mt-3 text-[13px] text-muted">Takes about two minutes.</p>
        </div>

        <section aria-labelledby="next-title" className="rounded-3xl border border-line bg-paper p-5 sm:p-7">
          <h2 id="next-title" className="text-sm font-semibold text-muted">What Happens Next</h2>
          <ol className="mt-4 grid gap-5">
            {steps.map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sage-soft text-forest">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-bold"><span className="text-forest">{i + 1}.</span> {t}</p>
                  <p className="mt-0.5 text-[15px] text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

type Party = {
  id: string;
  name: string;
  date: string;
  updatedAt: number;
  tasksDone: number;
  tasksTotal: number;
  detail?: EventDetail;
  current: boolean; // the plan that is open right now
  isOwner: boolean; // false for a party you co-host: removing it means leaving
};

const whenLabel = (days: number) => (days > 1 ? `in ${days} days` : days === 1 ? 'tomorrow' : days === 0 ? 'today' : days === -1 ? 'yesterday' : `${-days} days ago`);
const timeLabel = (hhmm?: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

const MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** All saved parties as cards, soonest first; past ones fold away. Edit selects several to remove. */
function YourParties() {
  const { s, events, open, go, switchEvent, deleteEvent, snapshotEvents, restoreEvents, duplicateEvent, toast } = useStore();
  const today = todayISO();
  // Being removed right now (hidden at once, even before the account confirms)
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const parties: Party[] = events
    .filter((e) => !pending.has(e.id))
    .map((e) => {
      const current = e.id === s.eventId && !s.isDemo;
      const live = current ? { name: s.event.name, date: s.event.date, detail: eventDetail(s), tasksDone: s.tasks.filter((t) => t.status === 'done').length, tasksTotal: s.tasks.length } : {};
      return { ...e, ...live, current, isOwner: e.isOwner };
    });
  if (!parties.length && !pending.size) return null;

  const upcoming = parties.filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = parties.filter((p) => p.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const nextId = upcoming[0]?.id;
  const pastOpen = showPast || editing || !upcoming.length;

  const openParty = async (p: Party, thenEdit = false) => {
    if (!p.current) {
      const ok = await switchEvent(p.id);
      if (!ok) { toast({ title: "Couldn't open that party", detail: 'Check your connection and try again.', tone: 'warn' }); return; }
    }
    go('overview');
    if (thenEdit) open({ type: 'event' });
  };

  /** Removes parties right away. Undo puts deleted ones back from a copy taken just before. */
  const removeNow = async (list: Party[]) => {
    const ids = list.map((p) => p.id);
    setPending((cur) => new Set([...cur, ...ids]));
    const owned = list.filter((p) => p.isOwner);
    const left = list.length - owned.length;
    const copies = await snapshotEvents(owned.map((p) => p.id));
    const results = await Promise.all(ids.map((id) => deleteEvent(id)));
    setPending((cur) => { const n = new Set(cur); ids.forEach((id) => n.delete(id)); return n; });
    const failed = list.filter((_, i) => !results[i]);
    if (failed.length) {
      toast({ title: `Couldn't remove ${failed.length === 1 ? failed[0].name : `${failed.length} parties`}`, detail: 'Check your connection and try again.', tone: 'warn' });
      return;
    }
    const title = list.length === 1 ? `${list[0].name} ${left ? 'left' : 'deleted'}` : [owned.length ? `${owned.length} ${owned.length === 1 ? 'party' : 'parties'} deleted` : '', left ? `${left} left` : ''].filter(Boolean).join(', ');
    const undo = copies.length ? async () => {
      await restoreEvents(copies);
      toast({ title: copies.length === 1 ? `${copies[0].event.name} is back` : `${copies.length} parties are back`, detail: left ? 'Parties you left need a new invite from their host.' : undefined, tone: 'info' });
    } : undefined;
    toast({ title, detail: left && !owned.length ? "It stays on the host's account." : undefined, tone: 'info', ...(undo ? { action: { label: 'Undo', run: () => { void undo(); } } } : {}) });
  };

  const toggle = (id: string) => setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopEditing = () => { setEditing(false); setPicked(new Set()); setConfirmBulk(false); };
  const chosen = parties.filter((p) => picked.has(p.id));
  const nLeave = chosen.filter((p) => !p.isOwner).length;
  const nDelete = chosen.length - nLeave;
  const bulkLabel = [nDelete ? `Delete ${nDelete}` : '', nLeave ? `Leave ${nLeave}` : ''].filter(Boolean).join(' · ');

  const card = (p: Party) => (
    <li key={p.id} className={cx(p.date < today && !editing && 'opacity-75')}>
      <PartyCard
        p={p}
        today={today}
        next={p.id === nextId}
        editing={editing}
        selected={picked.has(p.id)}
        onToggle={() => toggle(p.id)}
        onOpen={() => openParty(p)}
        onEditDetails={() => openParty(p, true)}
        onCopy={() => { duplicateEvent(p.id); toast({ title: `Copied ${p.name}`, detail: 'Nothing is bought, done or answered yet. Give the copy a name and date.', tone: 'success' }); }}
        onRemove={() => { void removeNow([p]); }}
      />
    </li>
  );

  return (
    <section aria-labelledby="parties-title" className="mx-auto max-w-[1120px] px-4 pt-2 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="parties-title" className="font-display text-[22px] font-semibold">
          {editing ? 'Select Parties to Remove' : <>Your Parties<span className="tnum ml-1.5 text-[15px] font-semibold text-muted">{parties.length}</span></>}
        </h2>
        {parties.length > 0 && (editing
          ? <Button size="sm" onClick={stopEditing}>Done</Button>
          : <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>)}
      </div>

      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {upcoming.map(card)}
        {!editing && (
          <li>
            <button type="button" onClick={() => go('setup')} className="flex h-full min-h-16 w-full items-center justify-center gap-2 rounded-[20px] sm:min-h-[150px] border-2 border-dashed border-line-strong bg-paper/50 px-4 font-display text-[16px] font-semibold text-forest hover:border-forest/60 hover:bg-paper">
              <Plus className="size-5" aria-hidden="true" /> New Party
            </button>
          </li>
        )}
      </ul>

      {past.length > 0 && (
        <div className="mt-4">
          {upcoming.length > 0 && (
            <button type="button" onClick={() => setShowPast((v) => !v)} disabled={editing} aria-expanded={pastOpen} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-line bg-paper/70 px-4 text-left text-[15px] font-semibold hover:bg-paper">
              <span>Past Parties<span className="tnum ml-1.5 text-muted">{past.length}</span></span>
              {!editing && <span className="flex items-center gap-1 text-[14px] text-forest">{pastOpen ? 'Hide' : 'Show'} <ChevronDown className={cx('size-4 transition-transform', pastOpen && 'rotate-180')} /></span>}
            </button>
          )}
          {pastOpen && <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{past.map(card)}</ul>}
        </div>
      )}

      {editing && (
        <div className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-paper shadow-xl" role="region" aria-label="Selected parties">
          {confirmBulk ? (
            <>
              <span className="text-[15px] font-semibold">
                {nDelete ? `Delete ${nDelete === 1 ? 'this party' : `${nDelete} parties`} with their guests, shopping and tasks` : ''}{nDelete && nLeave ? ', and ' : ''}{nLeave ? `leave ${nLeave} you co-host` : ''}?
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setConfirmBulk(false)} className="min-h-10 rounded-full bg-paper/15 px-4 text-[14px] font-semibold hover:bg-paper/25">Back</button>
                <button type="button" onClick={() => { void removeNow(chosen); stopEditing(); }} className="min-h-10 rounded-full bg-danger px-4 text-[14px] font-bold text-white hover:brightness-110">Yes, {bulkLabel}</button>
              </span>
            </>
          ) : (
            <>
              <span className="text-[15px] font-semibold">{chosen.length ? `${chosen.length} selected` : 'Tap parties to select them'}</span>
              <span className="flex gap-2">
                <button type="button" onClick={stopEditing} className="min-h-10 rounded-full bg-paper/15 px-4 text-[14px] font-semibold hover:bg-paper/25">Cancel</button>
                <button type="button" disabled={!chosen.length} onClick={() => setConfirmBulk(true)} className="min-h-10 rounded-full bg-danger px-4 text-[14px] font-bold text-white enabled:hover:brightness-110 disabled:opacity-40">{chosen.length ? bulkLabel : 'Delete'}</button>
              </span>
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** One party: a gradient top with a big date block and the name, then when, guests and how ready it is. */
function PartyCard({ p, today, next, editing, selected, onToggle, onOpen, onEditDetails, onCopy, onRemove }: {
  p: Party; today: string; next: boolean; editing: boolean; selected: boolean;
  onToggle: () => void; onOpen: () => void; onEditDetails: () => void; onCopy: () => void; onRemove: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) { setMenu(false); setConfirm(false); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); setConfirm(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const days = daysBetween(today, p.date);
  const dt = new Date(`${p.date}T12:00:00`);
  const d = p.detail;
  const ready = d ? d.itemsReady + p.tasksDone : p.tasksDone;
  const total = d ? d.itemsTotal + p.tasksTotal : p.tasksTotal;
  const pct = total ? Math.round((ready / total) * 100) : 0;
  const isPast = p.date < today;
  const alerts = d && !isPast ? [d.overdue ? `${d.overdue} overdue` : '', d.blocked ? `${d.blocked} blocked` : ''].filter(Boolean).join(' · ') : '';
  const time = d ? timeLabel(d.startTime) : '';
  const removeWord = p.isOwner ? 'Delete' : 'Leave';
  const item = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] font-medium hover:bg-sage-soft';

  return (
    <div ref={wrap} className={cx(
      // No border around the colored top (a light border there shows as a pale rim); only the white part has one
      'group relative h-full rounded-[20px] shadow-[0_6px_18px_rgb(48_80_216/0.10)] transition duration-200 ease-out',
      // Hover or keyboard focus: the card lifts a little, its shadow deepens and a brand-colored outline appears
      'hover:-translate-y-1 hover:shadow-[0_14px_32px_rgb(48_80_216/0.22)] focus-within:-translate-y-1 focus-within:shadow-[0_14px_32px_rgb(48_80_216/0.22)] motion-reduce:transform-none',
      selected ? 'ring-[3px] ring-forest' : 'hover:ring-2 hover:ring-forest/60 focus-within:ring-2 focus-within:ring-forest/60',
      menu && '-translate-y-1 ring-2 ring-forest/60 shadow-[0_14px_32px_rgb(48_80_216/0.22)]',
    )}>
      <button
        type="button"
        onClick={editing ? onToggle : onOpen}
        aria-label={editing ? `${selected ? 'Unselect' : 'Select'} ${p.name}` : `Open ${p.name}`}
        aria-pressed={editing ? selected : undefined}
        className="flex h-full w-full flex-col rounded-[20px] text-left"
      >
        <span className={cx('m2p-grad flex min-h-[88px] items-center gap-3 rounded-t-[20px] px-3.5 py-3 pr-12 transition-[filter] duration-200 group-hover:brightness-110', isPast && 'grayscale-[0.45]')}>
          <span className={cx('grid w-[54px] shrink-0 place-items-center rounded-xl py-1.5 text-center leading-none', next ? 'bg-paper text-forest' : 'bg-white/20 text-white')} role="img" aria-label={dateLabel(p.date)}>
            <span aria-hidden="true" className="text-[11px] font-bold tracking-[0.08em]">{MONTH[dt.getMonth()]}</span>
            <span aria-hidden="true" className="tnum mt-0.5 font-display text-[24px] font-bold">{dt.getDate()}</span>
          </span>
          <span className="min-w-0">
            <span className="line-clamp-3 font-display text-[16px] font-semibold leading-[1.2]" title={p.name}>{p.name}</span>
          </span>
        </span>
        <span className="block flex-1 rounded-b-[20px] border border-t-0 border-line bg-paper px-3.5 pb-3.5 pt-3">
          <span className="flex items-start justify-between gap-2">
          <span className="block text-[14px] font-semibold text-ink">{WEEKDAY_LONG[dt.getDay()]}{dt.getFullYear() !== new Date().getFullYear() ? `, ${dt.getFullYear()}` : ''}{time ? ` · ${time}` : ''}</span>
          {next && <span className="shrink-0 rounded-full bg-sage-soft px-2 py-0.5 text-[10.5px] font-bold tracking-[0.08em] text-forest">UP NEXT</span>}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted">{whenLabel(days)}{d ? ` · ${d.guests} guests` : ''}{!p.isOwner ? ' · co-host' : ''}</span>
          <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-chip" role="progressbar" aria-label={`${p.name} ready`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--m2p-grad-solid)' }} />
          </span>
          <span className="mt-1.5 flex items-center justify-between gap-2 text-[12px]">
            <span className={cx('truncate', alerts ? 'font-semibold text-danger' : 'text-muted')}>{alerts}</span>
            <span className="shrink-0 font-semibold text-ok">{isPast && pct >= 100 ? 'Done' : `${pct}% ready`}</span>
          </span>
        </span>
      </button>

      {/* Top right: a checkbox while selecting, otherwise the ⋯ menu */}
      {editing ? (
        <span aria-hidden="true" className={cx('pointer-events-none absolute right-3 top-3 grid size-7 place-items-center rounded-lg border-2', selected ? 'border-paper bg-paper text-forest' : 'border-white/90 bg-white/20')}>
          {selected && <Check className="size-4" strokeWidth={3} />}
        </span>
      ) : (
        <button type="button" onClick={() => { setMenu((m) => !m); setConfirm(false); }} aria-label={`More for ${p.name}`} aria-haspopup="menu" aria-expanded={menu} className={cx('absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-xl transition-colors', menu ? 'bg-paper text-forest hover:bg-sage-soft' : 'bg-white/20 text-white hover:bg-white/35')}>
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </button>
      )}

      {menu && !editing && (
        <div role="menu" aria-label={p.name} className="absolute right-2 top-12 z-40 w-60 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-paper p-1.5 text-ink shadow-xl">
          {confirm ? (
            <div className="p-2">
              <p className="text-[14px]">{p.isOwner ? <>Delete <b>{p.name}</b> with its guests, shopping and tasks?</> : <>Leave <b>{p.name}</b>? It stays on the host's account; you just won't see it.</>}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="danger" onClick={() => { setMenu(false); setConfirm(false); onRemove(); }}>{removeWord}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep It</Button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onOpen(); }}><ArrowRight className="size-4 text-forest" aria-hidden="true" /> Open</button>
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onEditDetails(); }}><Pencil className="size-4 text-forest" aria-hidden="true" /> Edit Details</button>
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onCopy(); }}><Copy className="size-4 text-forest" aria-hidden="true" /> Copy as New Event</button>
              <div className="my-1 border-t border-line" />
              <button type="button" role="menuitem" className={cx(item, 'text-danger hover:bg-danger-soft')} onClick={() => setConfirm(true)}>
                {p.isOwner ? <Trash2 className="size-4" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />} {removeWord} Party…
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Opened from a co-host invite link: join after signing in. */
function InviteCard() {
  const { invite, acceptInvite, dismissInvite, cloud } = useStore();
  if (!invite) return null;
  if (!cloud.available) {
    return (
      <section className="mx-auto max-w-[1120px] px-4 pb-4 sm:px-6">
        <div className="rounded-3xl border border-gold-bright/60 bg-paper p-5 text-[15px]">
          This is an invite to co-host{invite.name ? <> <b>{invite.name}</b></> : ' a party'}. Open the link in your regular browser to sign in and join.
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="invite-title" className="mx-auto max-w-[1120px] px-4 pb-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-forest/30 bg-paper p-5 sm:p-6">
        <span className="m2p-grad absolute inset-y-0 left-0 w-1.5" aria-hidden="true" />
        <p className="text-sm font-semibold text-forest">You're invited</p>
        <h2 id="invite-title" className="mt-1 font-display text-[24px] font-semibold leading-tight">Co-host {invite.name || 'a party'}</h2>
        <p className="mt-1 text-[15px] text-muted">{cloud.user ? `Join as ${cloud.user.name} to see and edit the whole plan.` : 'Sign in with Google to join. You can then see and edit the whole plan.'}</p>
        {invite.error && <p role="alert" className="mt-2 text-[14px] font-semibold text-danger">{invite.error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={acceptInvite} disabled={invite.busy}>{invite.busy ? 'Joining…' : cloud.user ? 'Join the Party' : 'Sign In and Join'} <ArrowRight className="size-4" /></Button>
          <Button variant="ghost" onClick={dismissInvite} disabled={invite.busy}>Not Now</Button>
        </div>
      </div>
    </section>
  );
}
