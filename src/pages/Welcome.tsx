import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, Hand, History, MessageSquareText, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { eventDetail, useStore, type EventDetail } from '../lib/store';
import { demoState } from '../lib/demo';
import { Logo } from '../components/Shell';
import { AccountMenu } from '../components/AccountMenu';
import { HeroArt } from '../components/HeroArt';
import { Button, Pill, Progress, cx } from '../components/ui';
import { dateLabel, money } from '../lib/format';
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
  sample?: boolean;
};

const whenLabel = (days: number) => (days > 1 ? `in ${days} days` : days === 1 ? 'tomorrow' : days === 0 ? 'today' : days === -1 ? 'yesterday' : `${-days} days ago`);
const timeLabel = (hhmm?: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

/** All saved parties: the next one up front, the rest as small cards. */
function YourParties() {
  const { s, events, open, go, switchEvent, toast } = useStore();
  const today = todayISO();
  const own: Party[] = events.map((e) => ({ ...e, current: e.id === s.eventId && !s.isDemo }));
  // The open plan always shows its latest numbers
  const withLive = own.map((p) => (p.current ? { ...p, name: s.event.name, date: s.event.date, detail: eventDetail(s), tasksDone: s.tasks.filter((t) => t.status === 'done').length, tasksTotal: s.tasks.length } : p));
  // Only the person's own parties: the sample party is not listed here
  const parties: Party[] = withLive;
  if (!parties.length) return null;

  const upcoming = parties.filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = parties.filter((p) => p.date < today);
  const featured = upcoming[0] ?? [...parties].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const recent = [...parties].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const resume = recent && recent.id !== featured.id && Date.now() - recent.updatedAt < 14 * 864e5 ? recent : null;
  const others = upcoming.filter((p) => p.id !== featured.id);
  const pastOthers = past.filter((p) => p.id !== featured.id).sort((a, b) => b.date.localeCompare(a.date));
  // Upcoming parties first; with none, the most recent past ones (faded)
  const shown = others.length ? others.slice(0, 3) : pastOthers.slice(0, 3);
  const hidden = others.length + pastOthers.length - shown.length;

  const openParty = async (p: Party) => {
    if (p.current) { go('overview'); return; }
    const ok = await switchEvent(p.id);
    if (!ok) toast({ title: "Couldn't open that party", detail: 'Check your connection and try again.', tone: 'warn' });
  };

  return (
    <section aria-labelledby="parties-title" className="mx-auto max-w-[1120px] px-4 pt-2 sm:px-6">
      <h2 id="parties-title" className="sr-only">Your Parties</h2>
      <FeaturedParty p={featured} today={today} onOpen={() => openParty(featured)} resume={resume} onResume={() => resume && openParty(resume)} />

      {(shown.length > 0 || hidden > 0) && (
        <>
          <div className="mt-5 flex items-end justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">
              {others.length ? 'Your Other Parties' : 'Your Past Parties'}
              <span className="tnum ml-1.5 text-sm font-semibold text-muted">{others.length || pastOthers.length}</span>
            </h3>
            {(hidden > 0 || past.length > 0) && (
              <button type="button" onClick={() => open({ type: 'events' })} className="text-sm font-semibold text-forest underline underline-offset-2">
                See All ({parties.length})
              </button>
            )}
          </div>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((p) => (
              <li key={p.id} className={cx(p.date < today && 'opacity-70')}><MiniParty p={p} today={today} onOpen={() => openParty(p)} /></li>
            ))}
            {!featured.sample && (
              <li>
                <button type="button" onClick={() => go('setup')} className="flex h-full min-h-[76px] w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-strong bg-paper/50 px-4 font-display text-[15px] font-semibold text-forest hover:border-forest/60 hover:bg-paper">
                  <Plus className="size-5" aria-hidden="true" /> New Party
                </button>
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

function FeaturedParty({ p, today, onOpen, resume, onResume }: { p: Party; today: string; onOpen: () => void; resume: Party | null; onResume: () => void }) {
  const days = daysBetween(today, p.date);
  const d = p.detail;
  const alerts = d ? d.overdue + d.blocked : 0;
  const stats = [
    { label: 'Tasks done', value: `${p.tasksDone} of ${p.tasksTotal}`, n: p.tasksDone, max: p.tasksTotal },
    ...(d ? [{ label: 'Items ready', value: `${d.itemsReady} of ${d.itemsTotal}`, n: d.itemsReady, max: d.itemsTotal }] : []),
  ];
  return (
    <div className="rounded-3xl border border-forest/30 bg-paper p-5 sm:p-6">
      <p className="text-sm font-semibold text-forest">{p.sample ? 'Your sample party' : days >= 0 ? 'Coming up next' : 'Your most recent party'}</p>
      <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <Pill tone={days >= 0 && days <= 7 ? 'coral' : 'sage'}>{whenLabel(days)}</Pill>
            {alerts > 0 && <Pill tone="red">{[d!.overdue ? `${d!.overdue} overdue` : '', d!.blocked ? `${d!.blocked} blocked` : ''].filter(Boolean).join(' · ')}</Pill>}
          </p>
          <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight sm:text-[30px]">{p.name}</h2>
          <p className="mt-1 text-[15px] text-muted">
            <CalendarDays className="mr-1.5 inline size-4 align-[-2px]" aria-hidden="true" />
            {dateLabel(p.date)}{d && timeLabel(d.startTime) ? ` · ${timeLabel(d.startTime)}` : ''}{d ? ` · ${d.guests} guests` : ''}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-4 lg:w-[400px]">
          {stats.map((x) => (
            <div key={x.label} className="min-w-0">
              <dt className="text-[13px] text-muted">{x.label}</dt>
              <dd className="tnum font-bold">{x.value}</dd>
              <div className="mt-1.5"><Progress label={x.label} value={x.n} max={x.max} /></div>
            </div>
          ))}
          {d && (
            <div className="min-w-0">
              <dt className="text-[13px] text-muted">{d.leftToSpend >= 0 ? 'Budget left' : 'Over budget'}</dt>
              <dd className={cx('tnum font-bold', d.leftToSpend < 0 ? 'text-danger' : 'text-ok')}>{money(Math.abs(d.leftToSpend), false)}</dd>
            </div>
          )}
        </dl>
        <Button size="lg" onClick={onOpen} className="shrink-0 lg:whitespace-nowrap">
          {p.sample ? 'Open the Sample Party' : 'Continue Planning'} <ArrowRight className="size-5" />
        </Button>
      </div>
      {resume && (
        <button type="button" onClick={onResume} className="mt-4 flex w-full items-center gap-2 border-t border-line pt-3 text-left text-[14px] text-muted hover:text-ink">
          <History className="size-4 shrink-0 text-forest" aria-hidden="true" />
          <span className="min-w-0 flex-1">Pick up where you left off: <b className="text-ink">{resume.name}</b></span>
          <ArrowRight className="size-4 shrink-0 text-forest" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function MiniParty({ p, today, onOpen }: { p: Party; today: string; onOpen: () => void }) {
  const days = daysBetween(today, p.date);
  const d = p.detail;
  const ready = d ? d.itemsReady + p.tasksDone : p.tasksDone;
  const total = d ? d.itemsTotal + p.tasksTotal : p.tasksTotal;
  const pct = total ? Math.round((ready / total) * 100) : 0;
  const alerts = d ? d.overdue + d.blocked : 0;
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${p.name}`} className="flex h-full min-h-[76px] w-full items-center gap-3 rounded-3xl border border-line bg-paper px-4 py-3 text-left transition-colors hover:border-forest/50">
      <span className="grid size-12 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-forest) ${pct}%, var(--color-chip) 0)` }} title={`${pct}% ready`}>
        <span className="tnum grid size-[38px] place-items-center rounded-full bg-paper text-[11px] font-bold">{pct}%</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[16px] font-semibold">{p.name}</span>
        <span className="block truncate text-[13px] text-muted">{dateLabel(p.date)} · {whenLabel(days)}</span>
        {alerts > 0 && <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">{[d!.overdue ? `${d!.overdue} overdue` : '', d!.blocked ? `${d!.blocked} blocked` : ''].filter(Boolean).join(' · ')}</span>}
      </span>
    </button>
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
