import type { ReactNode } from 'react';
import {
  AlertTriangle, CalendarClock, ChevronRight, CircleAlert, ClipboardCheck, Info, MailQuestion, ShoppingBasket, ShoppingCart, UserX, Users, Wallet,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { dateLabel, money, plural, timeLabel } from '../lib/format';
import { daysBetween, isBlocked, isOverdue, needsAttention, todayISO } from '../lib/tasks';
import { GettingStarted } from '../components/Onboarding';
import { AddToCalendar } from '../components/AddToCalendar';
import { Button, Card, PageHeader, Pill, Progress, SectionHead, cx } from '../components/ui';

type Tier = 'urgent' | 'todo' | 'info';
interface Step { tier: Tier; icon: ReactNode; text: ReactNode; action: string; onClick: () => void }

const TIER = {
  urgent: { label: 'Urgent', pill: 'red' as const, icon: 'text-danger' },
  todo: { label: 'To do', pill: 'sage' as const, icon: 'text-forest' },
  info: { label: 'For your info', pill: 'gray' as const, icon: 'text-muted' },
};

/** A section card: one area of the plan with its own numbers and a way into its page. */
function Area({ icon, title, onOpen, open, children }: { icon: ReactNode; title: string; onOpen: () => void; open: string; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[19px] font-semibold"><span className="text-forest">{icon}</span>{title}</h2>
        <Button variant="quiet" size="sm" onClick={onOpen}>{open} <ChevronRight className="size-4" /></Button>
      </div>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

export default function Overview() {
  const { s, att, head, plan, go, open, changePending } = useStore();
  const today = todayISO();
  const tasksDone = s.tasks.filter((t) => t.status === 'done').length;
  const blocked = s.tasks.filter(isBlocked);
  const overdue = s.tasks.filter((t) => isOverdue(t, today) && !isBlocked(t));
  const affected = s.tasks.filter((t) => t.status !== 'done' && t.affectedBy);
  const unassigned = plan.active.filter((l) => (l.status === 'to-buy' || l.status === 'buy-more') && !l.item.buyer);
  const readyItems = plan.counts.purchased + plan.counts.owned;
  const deadlineDays = daysBetween(today, s.event.rsvpDeadline);



  // Next steps, most urgent first. Red only for real problems (over budget, overdue, blocked).
  const steps: Step[] = [];
  if (plan.remaining < 0) steps.push({ tier: 'urgent', icon: <Wallet className="size-4" />, text: <>The plan is {money(-plan.remaining)} over your {money(s.event.budget, false)} budget.</>, action: 'See Ways to Save', onClick: () => go('budget') });
  if (overdue.length) steps.push({ tier: 'urgent', icon: <CalendarClock className="size-4" />, text: <>{plural(overdue.length, 'task is', 'tasks are')} overdue: {overdue.slice(0, 2).map((t) => t.title).join('; ')}.</>, action: 'Open Tasks', onClick: () => go('tasks') });
  if (blocked.length) steps.push({ tier: 'urgent', icon: <CircleAlert className="size-4" />, text: <>{plural(blocked.length, 'task is', 'tasks are')} blocked: {blocked.slice(0, 2).map((t) => t.title).join('; ')}.</>, action: 'Open Tasks', onClick: () => go('tasks') });
  if (changePending) steps.push({ tier: 'todo', icon: <Info className="size-4" />, text: <>Your planning count changed from {s.baseline?.headcount.total} to {head.total}. Quantities and cost were recalculated.</>, action: 'Review Changes', onClick: () => open({ type: 'impact' }) });
  if (plan.counts.buyMore > 0) steps.push({ tier: 'todo', icon: <ShoppingCart className="size-4" />, text: <>{plural(plan.counts.buyMore, 'item you already bought needs', 'items you already bought need')} more packages.</>, action: 'Open List', onClick: () => go('plan') });
  if (unassigned.length) steps.push({ tier: 'todo', icon: <UserX className="size-4" />, text: <>{plural(unassigned.length, 'purchase has', 'purchases have')} no buyer yet.</>, action: 'Assign', onClick: () => go('plan') });
  if (att.followUps > 0) steps.push({ tier: 'todo', icon: <MailQuestion className="size-4" />, text: <>{plural(att.followUps, 'group has', 'groups have')} not confirmed. RSVP deadline {deadlineDays >= 0 ? `in ${plural(deadlineDays, 'day')}` : `passed ${plural(-deadlineDays, 'day')} ago`}.</>, action: 'Follow Up', onClick: () => go('guests') });
  if (affected.length) steps.push({ tier: 'todo', icon: <AlertTriangle className="size-4" />, text: <>{plural(affected.length, 'task was', 'tasks were')} affected by a change. Check they still fit.</>, action: 'Open Tasks', onClick: () => go('tasks') });

  const upcoming = s.tasks.filter((t) => t.status !== 'done' && !needsAttention(t, today)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 2);

  return (
    <>
      <PageHeader
        title={s.event.name}
        sub={<>{dateLabel(s.event.date, { weekday: 'long', month: 'long', day: 'numeric' })} · {timeLabel(s.event.startTime)} · {s.event.durationHrs} hours · {s.event.venue}</>}
      >
        <AddToCalendar />
      </PageHeader>


      <GettingStarted />


      <section data-tour="attention" aria-labelledby="next-steps">
        <SectionHead id="next-steps" title="Your Next Steps" count={steps.length} />
        <Card>
          <ul className="divide-y divide-line">
            {steps.map((a, i) => (
              <li key={i} className={cx('flex flex-col gap-2 p-4 sm:flex-row sm:items-center', a.tier === 'urgent' && 'bg-danger-soft/40')}>
                <span className="flex min-w-0 flex-1 items-start gap-2.5 text-[15px]">
                  <span className={cx('mt-0.5 shrink-0', TIER[a.tier].icon)}>{a.icon}</span>
                  <span className="min-w-0">
                    <Pill tone={TIER[a.tier].pill} className="mr-2 align-[1px]">{TIER[a.tier].label}</Pill>
                    {a.text}
                  </span>
                </span>
                <Button variant={a.tier === 'urgent' ? 'secondary' : 'ghost'} size="sm" onClick={a.onClick} className="shrink-0 self-start sm:self-auto">
                  {a.action} <ChevronRight className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section data-tour="summary" aria-label="Plan areas" className="mt-8 grid gap-4 lg:grid-cols-2">
        <Area icon={<Users className="size-5" />} title="Guests" open="Guests and RSVPs" onOpen={() => go('guests')}>
          <p className="tnum text-2xl font-bold tracking-tight">{head.total} <span className="text-base font-semibold text-muted">people</span></p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone="green">{att.byStatus.confirmed.groups} confirmed</Pill>
            <Pill tone="gray">{att.followUps} not sure yet</Pill>
            <Pill tone="gray">{att.byStatus.declined.groups} can't come</Pill>
          </div>
        </Area>

        <Area icon={<Wallet className="size-5" />} title="Budget" open="Budget" onOpen={() => go('budget')}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            <div><dt className="text-muted">Projected cost</dt><dd className={cx('tnum text-lg font-bold', plan.remaining < 0 && 'text-danger')}>{money(plan.grandTotal)}</dd></div>
            <div><dt className="text-muted">Remaining budget</dt><dd className={cx('tnum text-lg font-bold', plan.leftToSpend < 0 ? 'text-danger' : 'text-ok')}>{money(plan.leftToSpend)}</dd></div>
          </dl>
          <div className="mt-3"><Progress label="Projected cost compared with budget" value={plan.grandTotal} max={s.event.budget} tone={plan.remaining < 0 ? 'coral' : 'forest'} /></div>
          <p className={cx('mt-2 text-[13px]', plan.remaining < 0 ? 'font-semibold text-danger' : 'text-muted')}>
            {plan.remaining >= 0 ? `On track for your ${money(s.event.budget, false)} budget` : `Projected ${money(-plan.remaining)} over your ${money(s.event.budget, false)} budget`}
          </p>
        </Area>

        <Area icon={<ShoppingBasket className="size-5" />} title="Shopping" open="Plan and Shop" onOpen={() => go('plan')}>
          <p className="tnum text-2xl font-bold tracking-tight">{readyItems} <span className="text-base font-semibold text-muted">of {plan.counts.active} items ready</span></p>
          <div className="mt-2"><Progress label="Items ready" value={readyItems} max={plan.counts.active} /></div>
          <p className="mt-2 text-[13px] text-muted"><b className="text-ink">{plan.counts.toBuy + plan.counts.buyMore}</b> still to buy · <b className="text-ink">{unassigned.length}</b> without a buyer</p>
        </Area>

        <Area icon={<ClipboardCheck className="size-5" />} title="Tasks" open="Tasks and Organizers" onOpen={() => go('tasks')}>
          <p className="tnum text-2xl font-bold tracking-tight">{tasksDone} <span className="text-base font-semibold text-muted">of {s.tasks.length} done</span></p>
          <div className="mt-2"><Progress label="Tasks done" value={tasksDone} max={s.tasks.length} /></div>
          {(blocked.length > 0 || overdue.length > 0) && (
            <p className="mt-2 text-[13px] font-semibold text-danger">{[overdue.length ? `${overdue.length} overdue` : '', blocked.length ? `${blocked.length} blocked` : ''].filter(Boolean).join(' · ')}</p>
          )}
          {upcoming.length > 0 && (
            <div className="mt-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-muted">Coming Up</p>
              <ul className="mt-1 divide-y divide-line">
                {upcoming.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => open({ type: 'task', id: t.id })} className="flex w-full flex-wrap items-center justify-between gap-x-2 py-2 text-left hover:text-forest">
                      <span className="font-semibold">{t.title}</span>
                      <span className="text-[13px] text-muted">{t.owner} · due {dateLabel(t.dueDate)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Area>
      </section>
    </>
  );
}
