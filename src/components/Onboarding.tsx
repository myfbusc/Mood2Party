import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, ChevronUp, GitCompareArrows, ListChecks, PartyPopper, Play, ShoppingBasket, Users, X } from 'lucide-react';
import { useStore, type Page } from '../lib/store';
import { simulateRsvpReplies } from '../lib/demo';
import { ensureKidsItems } from '../lib/actions';
import { Button, Progress, cx } from './ui';
import type { OnboardingAction } from '../lib/types';

// ─── 1. Welcome intro: three short slides, shown once ───────────────

const SLIDES = [
  { icon: Users, title: 'Start with Who Might Come', body: 'You rarely know the exact number. Mood2Party suggests one from your RSVPs, and you can always type your own.' },
  { icon: ShoppingBasket, title: 'Get a Plan Sized to That Number', body: 'Food, drinks, supplies, cost and tasks are worked out for you. You can change any of it.' },
  { icon: GitCompareArrows, title: 'See What a Change Affects', body: 'When RSVPs or details change, you see exactly what to buy, what is still enough, and who needs to know.' },
];

export function IntroModal() {
  const { update, startTour } = useStore();
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const finish = useCallback(() => update((p) => ({ ...p, onboarding: { ...p.onboarding, introSeen: true } })), [update]);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finish]);
  const slide = SLIDES[i];
  const Icon = slide.icon;
  const last = i === SLIDES.length - 1;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="m2p-fade absolute inset-0 bg-shade/50" aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="intro-title" className="m2p-drawer relative w-full max-w-[480px] rounded-3xl bg-paper p-6 shadow-2xl outline-none sm:p-8">
        <button type="button" onClick={finish} aria-label="Skip introduction" className="absolute right-3 top-3 grid size-11 place-items-center rounded-xl text-muted hover:bg-cream">
          <X className="size-5" />
        </button>
        <p className="text-[15px] font-semibold text-forest">Welcome to Mood2Party</p>
        <div className="mt-5 grid size-14 place-items-center rounded-2xl bg-sage-soft text-forest">
          <Icon className="size-7" />
        </div>
        <h2 id="intro-title" className="mt-5 font-display text-[28px] font-semibold leading-tight">{slide.title}</h2>
        <p className="mt-3 text-[18px] leading-relaxed text-ink/80">{slide.body}</p>
        {last && (
          <p className="mt-4 rounded-xl bg-gold-soft px-3 py-2.5 text-[16px] text-warn-ink">The tour takes about a minute and uses a sample party, so you can see a finished plan before making your own.</p>
        )}
        <div className="mt-6 flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, k) => (
            <span key={k} className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-6 m2p-grad' : 'w-1.5 bg-line-strong')} />
          ))}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {i > 0 ? (
            <Button variant="ghost" onClick={() => setI(i - 1)}><ArrowLeft className="size-4" /> Back</Button>
          ) : (
            <Button variant="ghost" onClick={finish}>Skip</Button>
          )}
          {last ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={finish}>Skip the Tour</Button>
              <Button onClick={startTour}>Show Me Around <ArrowRight className="size-4" /></Button>
            </div>
          ) : (
            <Button onClick={() => setI(i + 1)}>Next <ArrowRight className="size-4" /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 2. Guided tour: spotlight one thing at a time ─────────────────

interface Step {
  page: Page;
  target: string; // data-tour value; the first visible match is used
  title: string;
  body: string;
}

const PAGE_NAME: Partial<Record<Page, string>> = {
  welcome: 'Homepage', setup: 'Create an Event', overview: 'Overview', guests: 'Guests and RSVPs', plan: 'Plan and Shop', budget: 'Budget', tasks: 'Tasks and Organizers', wrapup: 'After the Event',
};

// The full flow, used from the homepage and in the sample party:
// homepage → describe your event → check details → your plan → back to the homepage.
const FLOW: Step[] = [
  { page: 'welcome', target: 'home-create', title: 'Every Plan Starts Here', body: 'Create an event starts your own plan. For this tour we will walk through a sample party, so you can see each step filled in.' },
  { page: 'setup', target: 'setup-describe', title: 'Describe Your Event', body: 'Write it the way you would text a friend. Mood2Party picks out the guest count, date, food, budget and helpers.' },
  { page: 'setup', target: 'setup-continue', title: 'Check What We Understood', body: 'Next you see what was picked up and anything that was guessed. Fix what is off, then Mood2Party builds your plan.' },
  { page: 'overview', target: 'attention', title: 'Your Next Steps', body: "This is a finished plan for Maya's graduation party. Start here: urgent problems in red come first, then things to do, then what is already done." },
  { page: 'overview', target: 'summary', title: 'Your Plan by Area', body: 'Guests, budget, shopping and tasks each have their own card, with a link to the full page.' },
  { page: 'guests', target: 'scenarios', title: 'One Number to Plan For', body: 'One number drives the plan: minimum, expected, maximum or your own. Quantities and budget follow it.' },
  { page: 'plan', target: 'first-item', title: 'Your Shopping List', body: 'Amounts are worked out for you. Tick an item once it is bought, tap “I have it” if you already own it, or tap the name to change the amount or store.' },
  { page: 'budget', target: 'budget-summary', title: 'Stay on Budget', body: 'See what the plan costs, what is already spent and what is left. If you go over, this page suggests ways to save.' },
  { page: 'tasks', target: 'task-summary', title: 'Share the Work', body: 'Give tasks to organizers, see what is due soon and what is blocked, so you are not tracking everything alone.' },
  { page: 'wrapup', target: 'wrapup', title: 'After the Party', body: 'Enter how many people came and what ran out or was left over. Your next plan uses this to get the amounts closer.' },
  { page: 'welcome', target: '', title: 'Now Plan Your Own Event', body: 'That is the whole flow. You are back on the homepage, ready to start your own plan. The sample party stays available if you want another look.' },
];

// Replaying the tour inside the person's own plan (from Help)
const APP: Step[] = [
  { page: 'overview', target: 'attention', title: 'Your Next Steps', body: 'Start here: urgent problems in red come first, then things to do, then what is already done.' },
  { page: 'overview', target: 'summary', title: 'Your Plan by Area', body: 'Guests, budget, shopping and tasks each have their own card, with a link to the full page.' },
  { page: 'guests', target: 'scenarios', title: 'One Number to Plan For', body: 'Pick minimum, expected, maximum or your own number. The rest of the plan follows it.' },
  { page: 'plan', target: 'first-item', title: 'Your Shopping List', body: 'Tick an item once it is bought, tap “I have it” if you already own it, or tap the name to change the amount or store.' },
  { page: 'budget', target: 'budget-summary', title: 'Stay on Budget', body: 'What the plan costs, what is spent and what is left, with ways to save if you go over.' },
  { page: 'tasks', target: 'task-summary', title: 'Share the Work', body: 'Give tasks to organizers and see what is due soon or blocked.' },
  { page: 'wrapup', target: 'wrapup', title: 'After the Party', body: 'Record how many came and what ran out or was left over, so your next plan is more accurate.' },
  { page: 'overview', target: 'nav', title: 'Everything Else Lives Here', body: 'Guests, shopping, budget, tasks and the after-party review. Use Help to replay this tour anytime.' },
];

const stepsFor = (demo: boolean) => (demo ? FLOW : APP);

function findTarget(name: string): HTMLElement | null {
  if (!name) return null;
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour~="${name}"]`)];
  return all.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

export function Tour() {
  const { s: app, tour, setTour, page, go, update } = useStore();
  const steps = stepsFor(app.isDemo);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = tour !== null ? steps[tour] ?? null : null;

  // Skipping: stop the tour; if it was still on the homepage or setup, return to the homepage.
  const end = useCallback(() => {
    setTour(null);
    update((p) => ({ ...p, onboarding: { ...p.onboarding, tourDone: true, introSeen: true } }));
    if (page === 'setup') go('welcome');
  }, [setTour, update, page, go]);

  // Finishing the tour (not skipping it) leads to the homepage for demo users,
  // and to their own plan's overview for people who already created an event.
  const finish = useCallback(() => {
    setTour(null);
    update((p) => ({ ...p, onboarding: { ...p.onboarding, tourDone: true, introSeen: true, tourCompleted: true } }));
    go(app.isDemo ? 'welcome' : 'overview');
  }, [setTour, update, go, app.isDemo]);

  // Extra room at the bottom so short pages can scroll their highlighted item above the tour card
  useLayoutEffect(() => {
    if (tour === null) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = '60vh';
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [tour]);

  // Move to the right page for this step
  useEffect(() => {
    if (step && page !== step.page) go(step.page);
  }, [step, page, go]);

  // Find and measure the target once the page has rendered
  useLayoutEffect(() => {
    if (!step || page !== step.page) return;
    let raf = 0;
    let tries = 0;
    const measure = () => {
      const el = findTarget(step.target);
      if (!el) {
        if (tries++ < 20) raf = requestAnimationFrame(measure);
        else setRect(null);
        return;
      }
      setRect(el.getBoundingClientRect());
    };
    const el = findTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const reserve = window.innerWidth < 640 ? 300 : 220; // room for the tour card
      const fits = r.top >= 70 && r.bottom <= window.innerHeight - reserve;
      if (!fits) {
        const target = window.innerWidth < 640 ? 90 : Math.max(90, (window.innerHeight - reserve - r.height) / 2);
        window.scrollBy({ top: r.top - target });
      }
    }
    raf = requestAnimationFrame(measure);
    const onMove = () => {
      setVw(window.innerWidth);
      const t = findTarget(step.target);
      setRect(t ? t.getBoundingClientRect() : null);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [step, page]);

  useEffect(() => {
    if (tour === null) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end();
      if (e.key === 'ArrowRight') setTour(tour < steps.length - 1 ? tour + 1 : tour);
      if (e.key === 'ArrowLeft' && tour > 0) setTour(tour - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tour, setTour, end, steps.length]);

  if (tour === null || !step) return null;
  const last = tour === steps.length - 1;
  const pad = 8;
  const mobile = vw < 640;
  const hole = rect
    ? {
        top: Math.max(4, rect.top - pad),
        left: Math.max(4, rect.left - pad),
        width: Math.min(rect.width + pad * 2, window.innerWidth - 8),
        height: Math.min(rect.height + pad * 2, window.innerHeight - 8),
      }
    : null;

  // Card placement: phones get a bottom sheet; desktop sits beside or below the target
  let cardStyle: React.CSSProperties = {};
  if (!mobile && hole) {
    const cardW = 410;
    const below = hole.top + hole.height + 12;
    const spaceBelow = window.innerHeight - below;
    const spaceRight = window.innerWidth - (hole.left + hole.width) - 16;
    if (spaceRight > cardW + 16 && hole.height > 160) {
      cardStyle = { left: hole.left + hole.width + 16, top: Math.min(Math.max(16, hole.top), window.innerHeight - 310), width: cardW };
    } else if (spaceBelow > 290) {
      cardStyle = { left: Math.min(Math.max(16, hole.left), window.innerWidth - cardW - 16), top: below, width: cardW };
    } else {
      cardStyle = { left: Math.min(Math.max(16, hole.left), window.innerWidth - cardW - 16), top: Math.max(16, hole.top - 300), width: cardW };
    }
  }

  // The menu item for the section being shown is highlighted too, so a change of section is visible
  const navEl = typeof document !== 'undefined' ? (document.querySelector(`[data-nav="${step.page}"]`) as HTMLElement | null) : null;
  const navRect = navEl && navEl.offsetParent !== null ? navEl.getBoundingClientRect() : null;
  const navHole = navRect && navRect.width > 0 && !(rect && navRect.top >= rect.top && navRect.bottom <= rect.bottom && navRect.left >= rect.left && navRect.right <= rect.right)
    ? { top: navRect.top - 4, left: navRect.left - 4, width: navRect.width + 8, height: navRect.height + 8 }
    : null;
  const pageName = PAGE_NAME[step.page];

  return (
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      {/* Dimmed backdrop with cut-outs around the highlighted content and its menu item */}
      <svg aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full">
        <defs>
          <mask id="m2p-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx="16" fill="black" />}
            {navHole && <rect x={navHole.left} y={navHole.top} width={navHole.width} height={navHole.height} rx="14" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="var(--color-shade)" fillOpacity="0.55" mask="url(#m2p-tour-mask)" />
      </svg>
      {hole && <div aria-hidden="true" className="pointer-events-none fixed rounded-2xl ring-2 ring-coral-bright transition-all duration-200" style={hole} />}
      {navHole && (
        <div aria-hidden="true" className="pointer-events-none fixed rounded-[14px] ring-[3px] ring-coral-bright transition-all duration-200" style={navHole}>
          <span className="absolute -top-2.5 right-3 -translate-y-1/2 whitespace-nowrap rounded-full bg-coral-bright px-2 py-0.5 text-[11px] font-bold text-on-coral shadow">You are here</span>
        </div>
      )}
      <div className="fixed inset-0" aria-hidden="true" />
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={cx(
          'fixed rounded-2xl bg-paper p-5 shadow-2xl outline-none',
          mobile ? 'inset-x-3 bottom-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]' : !hole && 'left-1/2 top-1/2 w-[410px] -translate-x-1/2 -translate-y-1/2',
        )}
        style={mobile ? undefined : cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-semibold text-forest">
            Tour · {tour + 1} of {steps.length}
            {pageName && <span className="ml-2 rounded-full bg-sage-soft px-2 py-0.5 text-[12px] font-bold text-forest">{pageName}</span>}
          </p>
          <button type="button" onClick={end} className="-mr-2 -mt-2 grid size-10 place-items-center rounded-xl text-muted hover:bg-cream" aria-label="End tour">
            <X className="size-4" />
          </button>
        </div>
        <h2 id="tour-title" className="mt-1 font-display text-[24px] font-semibold leading-tight">{step.title}</h2>
        <p className="mt-2 text-[18px] leading-relaxed text-ink/80">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          {tour > 0 ? (
            <Button variant="ghost" onClick={() => setTour(tour - 1)}><ArrowLeft className="size-4" /> Back</Button>
          ) : (
            <Button variant="ghost" onClick={end}>Skip Tour</Button>
          )}
          <Button onClick={() => (last ? finish() : setTour(tour + 1))}>
            {last ? (app.isDemo ? <>Start planning <ArrowRight className="size-4" /></> : <>Done <Check className="size-4" /></>) : <>Next <ArrowRight className="size-4" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 3. Getting-started checklist (Overview) ───────────────────────


interface Item {
  key: OnboardingAction;
  label: string;
  hint: string;
  cta: string;
}

export function GettingStarted() {
  const { s, update, go, open, toast, changePending, startTour } = useStore();
  const [showAll, setShowAll] = useState(false);
  if (s.onboarding.checklistHidden) return null;
  const did = s.onboarding.did;

  const items: Item[] = [
    { key: 'guests', label: 'See who might come', hint: 'Add guests and track who replied.', cta: 'Open Guests' },
    { key: 'basis', label: 'Check how many to plan for', hint: 'Pick minimum, expected or maximum, or type your own number.', cta: 'Check' },
    { key: 'shopping', label: 'Look over your shopping list', hint: 'Amounts are already worked out for you.', cta: 'Open List' },
    { key: 'buyer', label: 'Ask someone to buy an item', hint: 'Open an item and pick who buys it.', cta: 'Assign' },
    { key: 'task', label: 'Give a task to an organizer', hint: 'Open any task and choose an owner.', cta: 'Open Tasks' },
  ];
  const done = items.filter((x) => did[x.key]).length;
  const next = items.find((x) => !did[x.key]);
  const hide = () => update((p) => ({ ...p, onboarding: { ...p.onboarding, checklistHidden: true } }));
  const setCollapsed = (v: boolean) => update((p) => ({ ...p, onboarding: { ...p.onboarding, checklistCollapsed: v } }));

  const act = (k: OnboardingAction) => {
    switch (k) {
      case 'guests':
      case 'basis':
        return go('guests');
      case 'shopping':
        return go('plan');
      case 'buyer': {
        const first = s.items.find((x) => !x.removed && !x.buyer) ?? s.items.find((x) => !x.removed);
        go('plan');
        if (first) setTimeout(() => open({ type: 'item', id: first.id }), 50);
        return;
      }
      case 'change':
        if (changePending) return open({ type: 'impact' });
        if (s.isDemo) {
          update((p) => ensureKidsItems({ ...p, guests: simulateRsvpReplies(p.guests) }));
          toast({ title: 'New RSVP replies arrived', detail: 'Three groups confirmed and a new group of 5 was added.', tone: 'info' });
          setTimeout(() => open({ type: 'impact' }), 350);
          return;
        }
        return go('guests');
      case 'task':
        return go('tasks');
      default:
        return;
    }
  };

  if (done === items.length) {
    return (
      <section data-tour="checklist" className="mb-6 flex flex-col gap-3 rounded-2xl border border-sage bg-ok-soft p-4 sm:flex-row sm:items-center">
        <PartyPopper className="size-6 shrink-0 text-forest" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-forest">
          <p className="font-bold">You are all set</p>
          <p className="text-sm">{s.isDemo ? 'You have tried every part of the demo. Ready to plan your own event?' : 'You have tried every part of Mood2Party. Replay the tour from Help anytime.'}</p>
        </div>
        {s.isDemo ? (
          <Button size="sm" onClick={() => go('welcome')} className="shrink-0">Start My Own Event <ArrowRight className="size-4" /></Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={hide} className="shrink-0 bg-paper">Close</Button>
        )}
      </section>
    );
  }

  // Minimized: one line with progress and the next step, so it stays within reach
  if (s.onboarding.checklistCollapsed) {
    return (
      <section data-tour="checklist" aria-label="Getting started (minimized)" className="mb-6 flex flex-col gap-2 rounded-2xl border border-forest/25 bg-paper px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ListChecks className="size-5 shrink-0 text-forest" aria-hidden="true" />
          <p className="min-w-0 text-[15px]">
            <b>Getting Started</b> <span className="tnum text-muted">· {done} of {items.length} done</span>
            {next && <span className="text-muted"> · Next: {next.label.toLowerCase()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 sm:w-24 sm:flex-none"><Progress label="Getting started progress" value={done} max={items.length} /></div>
          <Button variant="secondary" size="sm" onClick={() => setCollapsed(false)} aria-expanded="false">
            <ChevronDown className="size-4" /> Show
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section data-tour="checklist" aria-labelledby="gs-title" className="mb-6 rounded-2xl border border-forest/25 bg-paper p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="gs-title" className="flex items-center gap-2 font-display text-xl font-semibold"><ListChecks className="size-5 text-forest" /> Getting Started</h2>
        <div className="flex items-center gap-1">
          {!s.onboarding.tourDone && <Button variant="quiet" size="sm" onClick={startTour}><Play className="size-4" /> Take the Tour</Button>}
          <Button variant="quiet" size="sm" onClick={() => setCollapsed(true)} className="text-muted" aria-expanded="true">
            <ChevronUp className="size-4" /> Hide
          </Button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex-1"><Progress label="Getting started progress" value={done} max={items.length} /></div>
        <span className="tnum text-sm font-semibold text-muted">{done} of {items.length}</span>
      </div>
      <ol className="mt-3 grid gap-1">
        {items.map((x) => {
          const isDone = !!did[x.key];
          const isNext = next?.key === x.key;
          if (!showAll && !isNext) return null; // only the next step until "Show all steps"
          return (
            <li key={x.key}>
              <div className={cx('flex items-center gap-3 rounded-xl px-2 py-2', isNext && 'bg-sage-soft')}>
                <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border-2', isDone ? 'border-transparent m2p-grad' : 'border-line-strong')} aria-hidden="true">
                  {isDone && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx('text-[15px] font-semibold', isDone && 'text-muted line-through decoration-1')}>
                    {x.label}<span className="sr-only">{isDone ? ' (done)' : ''}</span>
                  </p>
                  {isNext && <p className="text-[13px] text-muted">{x.hint}</p>}
                </div>
                {!isDone && (
                  <Button size="sm" variant={isNext ? 'primary' : 'ghost'} onClick={() => act(x.key)} className="shrink-0" aria-label={`${x.cta}: ${x.label}`}>
                    {x.cta} <ChevronRight className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <Button variant="quiet" size="sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
          {showAll ? <><ChevronUp className="size-4" /> Show only the next step</> : <><ChevronDown className="size-4" /> Show all {items.length} steps</>}
        </Button>
      </div>
    </section>
  );
}
