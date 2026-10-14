import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronsUpDown, CircleCheck, Copy, Pencil, Plus, UserPlus } from 'lucide-react';
import { useStore } from '../lib/store';
import { dateLabel } from '../lib/format';
import { daysBetween, todayISO } from '../lib/tasks';
import { cx } from './ui';

/** The party card in the sidebar: the name switches events; a bar shows how ready the party is. */
export function EventTicket({ onPick }: { onPick?: () => void }) {
  const { s, plan, open, go, events, switchEvent, toast, cloud } = useStore();
  const meta = cloud.metas.find((m) => m.id === s.eventId);
  const coCount = meta ? meta.members.length - 1 : 0;
  const [menu, setMenu] = useState(false);
  const [tear, setTear] = useState(92);
  const wrap = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);

  // The menu opens just under the name bar, whatever its height
  useLayoutEffect(() => {
    const h = top.current;
    if (!h) return;
    const set = () => { if (h.offsetHeight) setTear(h.offsetHeight + 4); };
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
  const when = days > 1 ? `in ${days} days` : days === 1 ? 'tomorrow' : days === 0 ? 'today' : days === -1 ? 'yesterday' : `${-days} days ago`;
  const iconBtn = 'grid size-9 shrink-0 place-items-center rounded-xl border border-line-strong bg-paper text-forest transition-colors hover:border-forest/60 hover:bg-sage-soft';
  const item = 'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] hover:bg-sage-soft';

  return (
    <div ref={wrap} className="relative">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper text-ink shadow-[0_6px_18px_rgb(48_80_216/0.10)]">
        <div ref={top} className="m2p-grad">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`${s.event.name}. Switch event`}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-[filter] hover:brightness-110"
          >
            <span className="min-w-0 flex-1">
              {s.isDemo && <span className="block text-[10px] font-bold tracking-[0.08em] opacity-90">SAMPLE PARTY</span>}
              <span className="block font-display text-[17px] font-semibold leading-tight">{s.event.name}</span>
            </span>
            <ChevronsUpDown className="size-[18px] shrink-0" aria-hidden="true" />
          </button>
        </div>
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{dateLabel(s.event.date)}</p>
            <p className="truncate text-[12px] text-muted">{when}</p>
          </div>
          <button type="button" onClick={() => pick(() => open({ type: 'event' }))} aria-label="Edit Event Details" title="Edit event details" className={iconBtn}>
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          {cloud.available && !s.isDemo && (
            <button type="button" onClick={() => pick(() => open({ type: 'cohosts' }))} aria-label={coCount > 0 ? `Co-hosts · ${coCount}` : 'Invite a Co-host'} title={coCount > 0 ? `Co-hosts (${coCount})` : 'Invite a co-host'} className={cx(iconBtn, 'relative')}>
              <UserPlus className="size-4" aria-hidden="true" />
              {coCount > 0 && <span className="m2p-grad absolute -right-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full text-[10px] font-bold">{coCount}</span>}
            </button>
          )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-chip" role="progressbar" aria-label="Party ready" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: 'var(--m2p-grad-solid)' }} />
            </div>
            <span className="shrink-0 text-[11.5px] font-semibold text-ok">{pct}% ready</span>
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
