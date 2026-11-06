import { useState, type ReactNode } from 'react';
import {
  House, Info, CircleHelp, Moon, ClipboardCheck, LayoutDashboard, Menu, PartyPopper, Pencil, RotateCcw, ShoppingBasket,
  Sparkles, Users, Wallet, X,
} from 'lucide-react';
import { useStore, type Page } from '../lib/store';
import { money, plural } from '../lib/format';
import { needsAttention, todayISO } from '../lib/tasks';
import { computeImpact } from '../lib/plan';
import { Button, cx } from './ui';
import { EventTicket } from './EventTicket';
import { AccountMenu } from './AccountMenu';

const NAV: { page: Page; label: string; icon: typeof Users }[] = [
  { page: 'overview', label: 'Overview', icon: LayoutDashboard },
  { page: 'guests', label: 'Guests and RSVPs', icon: Users },
  { page: 'plan', label: 'Plan and Shop', icon: ShoppingBasket },
  { page: 'budget', label: 'Budget', icon: Wallet },
  { page: 'tasks', label: 'Tasks and Organizers', icon: ClipboardCheck },
  { page: 'wrapup', label: 'After the Event', icon: Sparkles },
];

/** The logo is also a little easter egg: clicking it switches between the default and "Midnight and sunshine" themes. */
export function Logo() {
  const { theme, toggleTheme } = useStore();
  const midnight = theme === 'midnight';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group flex items-center gap-2 rounded-lg text-left transition-[filter,opacity] duration-150 hover:opacity-90 hover:brightness-110"
      aria-label="Mood2Party"
      aria-pressed={midnight}
      title={midnight ? 'Lights back on' : 'Party after dark?'}
    >
      <span className="grid size-11 place-items-center m2p-grad rounded-2xl transition-transform duration-200 group-hover:-rotate-12 group-active:scale-90">
        {midnight ? <Moon className="size-6" /> : <PartyPopper className="size-6" />}
      </span>
      <span className="m2p-grad-text font-display text-[28px] font-semibold leading-none">Mood2Party</span>
    </button>
  );
}

/** Back to the homepage (the logo itself is the theme easter egg). */
function HomeLink({ onPick }: { onPick?: () => void }) {
  const { go } = useStore();
  return (
    <button
      type="button"
      onClick={() => { onPick?.(); go('welcome'); }}
      aria-label="Back to homepage"
      className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-line-strong bg-paper px-4 text-[14px] font-semibold text-ink transition-colors hover:border-forest/60 hover:bg-nav-hover"
    >
      <House className="size-4" aria-hidden="true" /> Homepage
    </button>
  );
}

function useBadges() {
  const { s, att, plan } = useStore();
  const today = todayISO();
  return {
    guests: att.followUps,
    plan: plan.counts.buyMore,
    tasks: s.tasks.filter((t) => needsAttention(t, today)).length,
    budget: plan.remaining < 0 ? 1 : 0,
  } as Partial<Record<Page, number>>;
}

function NavList({ onPick }: { onPick?: () => void }) {
  const { page, go } = useStore();
  const badges = useBadges();
  return (
    <nav aria-label="Main">
      <ul className="grid gap-1">
        {NAV.map(({ page: p, label, icon: Icon }) => {
          const active = page === p;
          const b = badges[p] ?? 0;
          return (
            <li key={p}>
              <button
                type="button"
                data-nav={p}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  go(p);
                  onPick?.();
                }}
                className={cx(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold transition duration-150',
                  active ? 'm2p-grad hover:brightness-110' : 'text-ink hover:bg-nav-hover',
                )}
              >
                <Icon className={cx('size-[18px] shrink-0', !active && 'text-forest')} />
                <span className="flex-1">{label}</span>
                {b > 0 && (
                  <span
                    className={cx('tnum rounded-full px-2 py-0.5 text-xs font-bold', active ? 'bg-white/25 text-current' : p === 'budget' ? 'bg-danger-soft text-danger' : 'bg-coral-soft text-coral')}
                    aria-label={p === 'budget' ? 'over budget' : `${b} need attention`}
                  >
                    {p === 'budget' ? '!' : b}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function EventCard({ onPick }: { onPick?: () => void }) {
  return <EventTicket onPick={onPick} />;
}

/** Only the pages where a new headcount really changes things (amounts and cost) show this; Overview lists it under next steps. */
const CHANGE_PAGES = ['plan', 'budget'];

export function ChangeBanner() {
  const { s, head, changePending, open, page } = useStore();
  if (!changePending || !s.baseline || !CHANGE_PAGES.includes(page)) return null;
  const impact = computeImpact(s, s.baseline.headcount, head);
  const buyMore = impact.rows.filter((r) => r.kind === 'buy-more').length;
  const updated = impact.rows.filter((r) => r.before.need !== r.after.need && !r.item.removed).length;
  // Small changes (no amounts moved, cost within $1) don't need a banner
  if (!updated && !buyMore && Math.abs(impact.delta) < 1) return null;
  const up = head.total > s.baseline.headcount.total;
  return (
    <div role="status" className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4 sm:flex-row sm:items-center">
      <Info className="size-5 shrink-0 text-forest" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[15px] text-ink">
        <p className="font-bold">
          Your planning count {up ? 'went up' : 'went down'} from {s.baseline.headcount.total} to {head.total} guests.
        </p>
        <p className="text-sm text-muted">
          {plural(updated, 'quantity', 'quantities')} changed, {plural(buyMore, 'item needs', 'items need')} more packages,
          {' '}and the estimate is {impact.delta >= 0 ? `${money(impact.delta)} higher` : `${money(-impact.delta)} lower`}.
        </p>
      </div>
      <Button variant="secondary" onClick={() => open({ type: 'impact' })} className="shrink-0">
        Review What Changed
      </Button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { s, open, startTour, go } = useStore();
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-line bg-sidebar lg:block">
        <div className="sticky top-0 flex h-screen flex-col gap-5 overflow-y-auto p-5">
          <div className="grid gap-3">
            <Logo />
            <HomeLink />
          </div>
          <EventCard />
          <div data-tour="nav"><NavList /></div>
          <div className="mt-auto grid gap-2 pt-4 text-[13px] text-muted">
            <AccountMenu />
            {s.isDemo && <p className="rounded-xl bg-gold-soft px-3 py-2 text-warn-ink">You are viewing a demo event. Changes stay in this browser.</p>}
            <button type="button" onClick={startTour} className="flex min-h-10 items-center gap-2 rounded-lg px-2 font-semibold text-muted hover:bg-nav-hover hover:text-ink">
              <CircleHelp className="size-4" /> Replay the Tour
            </button>
            <button type="button" onClick={() => open({ type: 'reset' })} className="flex min-h-10 items-center gap-2 rounded-lg px-2 font-semibold text-muted hover:bg-nav-hover hover:text-ink">
              <RotateCcw className="size-4" /> {s.isDemo ? 'Reset Sample' : 'Start Over'}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-cream/80 px-4 py-2.5 backdrop-blur lg:hidden" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <Logo />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go('welcome')} className="grid size-11 place-items-center rounded-xl text-forest hover:bg-paper" aria-label="Go to the homepage">
            <House className="size-5" />
          </button>
          <button type="button" onClick={() => open({ type: 'event' })} className="grid size-11 place-items-center rounded-xl text-forest hover:bg-paper" aria-label="Edit Event Details">
            <Pencil className="size-5" />
          </button>
          <button type="button" data-tour="nav" onClick={() => setMenu(true)} className="grid size-11 place-items-center rounded-xl text-forest hover:bg-paper" aria-label="Open menu" aria-expanded={menu}>
            <Menu className="size-6" />
          </button>
        </div>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="m2p-fade absolute inset-0 bg-shade/40" onClick={() => setMenu(false)} />
          <div className="m2p-drawer absolute inset-x-0 top-0 max-h-[92vh] overflow-y-auto rounded-b-3xl bg-cream p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setMenu(false)} className="grid size-11 place-items-center rounded-xl hover:bg-paper" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-4">
              <HomeLink onPick={() => setMenu(false)} />
              <EventCard onPick={() => setMenu(false)} />
              <AccountMenu onPick={() => setMenu(false)} />
              <NavList onPick={() => setMenu(false)} />
              <button type="button" onClick={() => { setMenu(false); startTour(); }} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-nav-hover hover:text-ink">
                <CircleHelp className="size-4" /> Replay the Tour
              </button>
              <button type="button" onClick={() => { setMenu(false); open({ type: 'reset' }); }} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-nav-hover hover:text-ink">
                <RotateCcw className="size-4" /> {s.isDemo ? 'Reset Sample' : 'Start Over'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full min-w-0 max-w-[1120px] px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <ChangeBanner />
        {children}
      </main>
    </div>
  );
}
