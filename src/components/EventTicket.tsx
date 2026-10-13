import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Calendar, ChevronsUpDown, CircleCheck, Clock, Copy, Pencil, Plus, Ticket, UserPlus, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { dateLabel, timeLabel } from '../lib/format';
import { daysBetween, todayISO } from '../lib/tasks';
import { Button, cx } from './ui';

/** Countdown ring: days left in the middle, the ring fills as shopping and tasks get done. */
function CountdownRing({ days, pct }: { days: number; pct: number }) {
  const gid = useId().replace(/:/g, '');
  const r = 27;
  const c = 2 * Math.PI * r;
  const label = days > 0 ? 'days to go' : days === 0 ? 'today' : 'days ago';
  return (
    <svg width="76" height="76" viewBox="0 0 72 72" role="img" aria-label={`${days === 0 ? 'Party day' : `${Math.abs(days)} ${label}`}, ${pct}% ready`} className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--m2p-ring-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--m2p-ring-b)' }} />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-line)" strokeWidth="7" />
      {pct > 0 && (
        <circle cx="36" cy="36" r={r} fill="none" stroke={`url(#${gid})`} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 36 36)" className="transition-[stroke-dasharray] duration-500" />
      )}
      <text x="36" y="37" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="600" fontSize={Math.abs(days) > 99 ? 16 : 19} fill="var(--color-ink)">{Math.abs(days)}</text>
      <text x="36" y="49" textAnchor="middle" fontSize="8.5" fontWeight="500" fill="var(--color-muted)">{label}</text>
    </svg>
  );
}

/** The event card as a party ticket. The event name switches events; the ring counts down and shows progress. */
export function EventTicket({ onPick }: { onPick?: () => void }) {
  const { s, head, plan, open, go, events, switchEvent, toast, cloud } = useStore();
  const meta = cloud.metas.find((m) => m.id === s.eventId);
  const coCount = meta ? meta.members.length - 1 : 0;
  const [menu, setMenu] = useState(false);
  const [tear, setTear] = useState(92);
  const wrap = useRef<HTMLDivElement>(null);
  const ticket = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);

  // The notches sit exactly on the tear line, wherever a long event name puts it
  useLayoutEffect(() => {
    const t = ticket.current, h = top.current;
    if (!t || !h) return;
    const set = () => {
      if (!h.offsetHeight) return; // hidden copy (sidebar on phones, menu on desktop)
      t.style.setProperty('--tear', `${h.offsetHeight + 2}px`);
      setTear(h.offsetHeight + 2);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(h);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const days = daysBetween(todayISO(), s.event.date);
  const doneTasks = s.tasks.filter((t) => t.status === 'done').length;
  const readyItems = plan.counts.purchased + plan.counts.owned;
  const total = s.tasks.length + plan.counts.active;
  const pct = total ? Math.round(((doneTasks + readyItems) / total) * 100) : 0;
  const others = events.filter((e) => e.id !== s.eventId);
  const pick = (fn: () => void) => { setMenu(false); onPick?.(); fn(); };
  const item = 'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] hover:bg-sage-soft';

  return (
    <div ref={wrap} className="relative">
      <div className="m2p-ticket-wrap">
        <div ref={ticket} className="m2p-ticket text-ink">
          <div ref={top} className="m2p-grad px-3 pb-3.5 pt-2.5">
            <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] font-bold tracking-[0.08em] opacity-90">
              <span>{s.isDemo ? 'SAMPLE PARTY' : 'NOW PLANNING'}</span>
              <Ticket className="size-3.5" aria-hidden="true" />
            </div>
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={`${s.event.name}. Switch event`}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/40 bg-white/15 px-2.5 py-1.5 text-left transition-colors hover:bg-white/25"
            >
              <span className="font-display text-[18px] font-semibold leading-tight">{s.event.name}</span>
              <ChevronsUpDown className="size-[18px] shrink-0" aria-hidden="true" />
            </button>
          </div>
          <div className="m2p-perf" aria-hidden="true" />
          <div className="flex items-center gap-3 px-3.5 pb-1 pt-2.5">
            <CountdownRing days={days} pct={pct} />
            <div className="min-w-0 text-[12.5px] leading-[1.7] text-muted">
              <p className="flex items-center gap-1.5"><Calendar className="size-3.5 shrink-0 text-forest" aria-hidden="true" />{dateLabel(s.event.date)}</p>
              <p className="flex items-center gap-1.5"><Clock className="size-3.5 shrink-0 text-forest" aria-hidden="true" />{timeLabel(s.event.startTime)} · {s.event.durationHrs} hrs</p>
              <p className="flex items-center gap-1.5"><Users className="size-3.5 shrink-0 text-forest" aria-hidden="true" />{head.total} guests</p>
              <p className="flex items-center gap-1.5 font-semibold text-ok"><CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />{pct}% ready</p>
            </div>
          </div>
          <div className="px-3.5 pb-3.5 pt-2.5">
            <Button variant="secondary" size="sm" className="w-full" onClick={() => pick(() => open({ type: 'event' }))}>
              <Pencil className="size-4" /> Edit Event Details
            </Button>
            {cloud.available && !s.isDemo && (
              <Button variant="quiet" size="sm" className="mt-1 w-full" onClick={() => pick(() => open({ type: 'cohosts' }))}>
                <UserPlus className="size-4" /> {coCount > 0 ? `Co-hosts · ${coCount}` : 'Invite a Co-host'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {menu && (
        <div role="menu" aria-label="Your Events" style={{ top: tear - 6 }} className="absolute inset-x-1.5 z-40 rounded-2xl border border-line bg-paper p-1.5 text-ink shadow-xl">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold tracking-[0.08em] text-muted">YOUR EVENTS</p>
          <div role="menuitem" aria-current="true" className={cx(item, 'cursor-default bg-sage-soft')}>
            <CircleCheck className="size-4 shrink-0 text-forest" aria-hidden="true" />
            <span className="min-w-0"><b className="font-semibold">{s.event.name}</b><span className="block text-[12px] text-muted">{s.isDemo ? 'Sample party · open now' : `${dateLabel(s.event.date)} · open now`}</span></span>
          </div>
          {others.slice(0, 5).map((e) => (
            <button key={e.id} type="button" role="menuitem" className={item} onClick={() => pick(async () => { const ok = await switchEvent(e.id); toast(ok ? { title: `Switched to ${e.name}`, tone: 'success' } : { title: `Could not open ${e.name}`, tone: 'warn' }); })}>
              <span className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0"><b className="font-semibold">{e.name}</b><span className="block text-[12px] text-muted">{dateLabel(e.date)}</span></span>
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" className={cx(item, 'font-semibold text-forest')} onClick={() => pick(() => go('setup'))}>
            <Plus className="size-4 shrink-0" aria-hidden="true" /> New event
          </button>
          <button type="button" role="menuitem" className={cx(item, 'font-semibold text-forest')} onClick={() => pick(() => open({ type: 'events' }))}>
            <Copy className="size-4 shrink-0" aria-hidden="true" /> {others.length > 5 ? `All ${events.length} events` : 'Copy, delete or manage'}
          </button>
        </div>
      )}
    </div>
  );
}
