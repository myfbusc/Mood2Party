import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, ListPlus, Plus, Send, UserPlus, Users, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { dateLabel } from '../lib/format';
import { isAtRisk, isBlocked, isDueSoon, isOverdue, needsAttention, needsResource, todayISO } from '../lib/tasks';
import { Button, Card, InfoTip, PageHeader, PartyReady, Pill, Segmented, cx, inputBase } from '../components/ui';
import { addHelper, helperNameProblem, removeHelper } from '../lib/actions';
import { plural } from '../lib/format';
import type { Task } from '../lib/types';

export const TASK_STATUS_LABEL: Record<Task['status'], string> = { todo: 'To do', 'in-progress': 'In progress', blocked: 'Blocked', done: 'Done' };

function attentionLabel(t: Task, today: string) {
  if (isBlocked(t)) return { label: 'Blocked', tone: 'red' as const };
  if (isOverdue(t, today)) return { label: 'Overdue', tone: 'red' as const };
  return { label: 'Affected by a change', tone: 'gold' as const };
}

export default function Tasks() {
  const { s, update, open, toast, markDid } = useStore();
  const today = todayISO();
  const [who, setWho] = useState('all');
  const people = ['You', ...s.event.helpers];
  const owners = [...new Set([...people, ...s.tasks.map((t) => t.owner)])];
  const mine = s.tasks.filter((t) => who === 'all' || t.owner === who);

  const [sort, setSort] = useState<'deadline' | 'priority'>('deadline');
  const RANK = { high: 0, medium: 1, low: 2 } as const;
  const order = (a: Task, b: Task) => (sort === 'priority' ? RANK[a.priority] - RANK[b.priority] || a.dueDate.localeCompare(b.dueDate) : a.dueDate.localeCompare(b.dueDate) || RANK[a.priority] - RANK[b.priority]);
  const attention = mine.filter((t) => needsAttention(t, today)).sort(order);
  const headsUp = mine.filter((t) => !needsAttention(t, today) && (isAtRisk(t, today) || needsResource(t))).sort(order);
  const coming = mine.filter((t) => t.status !== 'done' && !needsAttention(t, today) && !headsUp.includes(t)).sort(order);
  const done = mine.filter((t) => t.status === 'done').sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  // Long lists stay short: the next few tasks show, completed tasks fold away until asked for
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const toggleDone = (t: Task) => {
    const nowDone = t.status !== 'done';
    update((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, status: nowDone ? 'done' : 'todo', blocker: nowDone ? null : x.blocker, affectedBy: nowDone ? null : x.affectedBy } : x)) }));
    toast({ title: nowDone ? 'Task completed' : 'Task reopened', detail: t.title, tone: nowDone ? 'success' : 'info' });
  };

  // Everyone who can own a task, plus the current owner if they are no longer on the helper list
  const ownerChoices = (current: string) => (people.includes(current) ? people : [...people, current]);

  const reassign = (task: Task, owner: string) => {
    if (owner === task.owner) return;
    update((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === task.id ? { ...x, owner } : x)) }));
    if (owner !== 'You') markDid('task');
    const hidden = who !== 'all' && who !== owner;
    toast({
      title: `Reassigned to ${owner === 'You' ? 'you' : owner}`,
      detail: hidden ? `${task.title}. Choose "Everyone" or ${owner} above to see it.` : task.title,
      tone: 'success',
    });
  };

  const sections = [
    { key: 'attention', title: 'Needs Attention', tasks: attention, empty: 'Nothing is late or blocked.', preview: Infinity },
    { key: 'heads', title: 'Heads Up', tasks: headsUp, empty: '', preview: Infinity },
    { key: 'coming', title: 'Coming Up', tasks: coming, empty: 'No open tasks are coming up.', preview: 5 },
    { key: 'done', title: 'Completed', tasks: done, empty: 'No tasks are complete yet.', preview: Infinity },
  ];
  // Folded sections, remembered in this browser (Completed starts folded)
  const FOLD_KEY = 'mood2party:task-sections-folded';
  const [folded, setFoldedState] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) ?? '["done"]'); } catch { return ['done']; } });
  const toggleFold = (k: string) => setFoldedState((cur) => {
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(next)); } catch { /* remembered for this visit */ }
    return next;
  });

  const dueSoon = mine.filter((t) => isDueSoon(t, today)).length;
  const late = mine.filter((t) => isBlocked(t) || isOverdue(t, today)).length;
  const summary = [late ? `${late} late or blocked` : '', dueSoon ? `${dueSoon} due in 2 weeks` : '', `${done.length} done`].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader title="Tasks and Organizers" sub={<span data-tour="task-summary">{summary}</span>}>
        <Button onClick={() => open({ type: 'task' })}><Plus className="size-4" /> Add Task</Button>
      </PageHeader>

      {s.tasks.length > 0 && s.tasks.every((t) => t.status === 'done') && (
        <PartyReady className="mt-4">Every task is done. Party ready!</PartyReady>
      )}

      <HelpersPanel onShow={setWho} />

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented size="sm" label="Show tasks for" value={who} onChange={setWho} options={[{ value: 'all', label: 'Everyone' }, ...owners.map((o) => ({ value: o, label: o }))]} />
        <span className="flex items-center gap-2 sm:ml-auto">
          <span className="text-[13px] font-semibold text-muted">Sort</span>
          <Segmented size="sm" label="Sort tasks by" value={sort} onChange={setSort} options={[{ value: 'deadline', label: 'Deadline' }, { value: 'priority', label: 'Priority' }]} />
        </span>
      </div>

      <div className="mt-6 grid gap-6">
        {sections.filter((sec) => sec.key !== 'heads' || sec.tasks.length > 0).map((sec) => (
          <section key={sec.key} aria-labelledby={`sec-${sec.key}`} className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <h2 id={`sec-${sec.key}`} className="flex items-center gap-1 font-display text-lg font-semibold">
                <button type="button" onClick={() => toggleFold(sec.key)} aria-expanded={!folded.includes(sec.key)} className="flex items-center gap-1.5 rounded-lg text-left hover:opacity-80">
                  {sec.title}
                  <span className="tnum text-sm font-semibold text-muted">{sec.tasks.length}</span>
                  <ChevronDown className={cx('size-4 text-muted transition-transform', folded.includes(sec.key) && '-rotate-90')} aria-hidden="true" />
                </button>
                {sec.key === 'heads' && <InfoTip label="What Heads up means">Tasks that haven't started and are due within 3 days, or that need something (a car, cash, an extra hand). Sort these out early so nothing slips.</InfoTip>}
              </h2>
            </div>
            {folded.includes(sec.key) ? null : sec.tasks.length === 0 ? (
              <p className="px-1 text-sm text-muted">{sec.empty}</p>
            ) : (
              <Card className="overflow-hidden"><ul className="divide-y divide-line">
                {(expanded[sec.key] || sec.tasks.length <= sec.preview + 1 ? sec.tasks : sec.tasks.slice(0, sec.preview)).map((t) => {
                  const att = sec.key === 'attention' ? attentionLabel(t, today) : null;
                  const heads = sec.key === 'heads' ? (isAtRisk(t, today) ? { label: 'Due soon', tone: 'gold' as const } : { label: 'Needs something', tone: 'gold' as const }) : null;
                  const overdue = isOverdue(t, today);
                  const extra = (att && (t.blocker || t.affectedBy)) || (needsResource(t) ? `Needs: ${t.needs}` : '');
                  return (
                    <li key={t.id} className="group grid grid-cols-[20px_minmax(0,1fr)_36px] items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors hover:bg-cream sm:flex sm:px-4">
                      <label className="relative grid shrink-0 cursor-pointer place-items-center before:absolute before:-inset-2.5 before:content-[''] size-5">
                        <input type="checkbox" className="size-5 cursor-pointer accent-forest" checked={t.status === 'done'} onChange={() => toggleDone(t)} aria-label={`Mark ${t.title} as ${t.status === 'done' ? 'not done' : 'done'}`} />
                      </label>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <button type="button" onClick={() => open({ type: 'task', id: t.id })} className={cx('-my-1.5 min-w-0 py-1.5 text-left font-semibold hover:underline', t.status === 'done' && 'text-muted line-through decoration-1')}>
                            {t.title}
                          </button>
                          {t.priority === 'high' && t.status !== 'done' && <Pill tone="coral">High</Pill>}
                          {att ? <Pill tone={att.tone}>{att.label}</Pill> : heads ? <Pill tone={heads.tone}>{heads.label}</Pill> : t.status === 'in-progress' || t.status === 'blocked' ? <Pill tone="sage">{TASK_STATUS_LABEL[t.status]}</Pill> : null}
                        </p>
                        <p className="mt-0.5 text-[13px] text-muted">
                          <span className={cx(overdue && 'font-semibold text-danger')}>Due {dateLabel(t.dueDate)}</span>
                          {extra && <span className={att ? 'text-attn-ink' : 'text-warn-ink'}> · {extra}</span>}
                        </p>
                      </div>
                      <select
                        id={`owner-${t.id}`}
                        aria-label={`Assigned to, owner of ${t.title}`}
                        value={t.owner}
                        onChange={(e) => reassign(t, e.target.value)}
                        className="col-start-2 row-start-2 h-9 w-36 shrink-0 cursor-pointer justify-self-start rounded-lg border border-line-strong bg-paper py-1 pl-2.5 pr-7 text-[13px] font-semibold text-ink hover:border-forest/60"
                      >
                        {ownerChoices(t.owner).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <button type="button" onClick={() => open({ type: 'task', id: t.id })} aria-label={`Edit ${t.title}`} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line-strong text-muted hover:border-forest/60 hover:text-forest">
                        <Pencil className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul></Card>
            )}
            {!folded.includes(sec.key) && sec.tasks.length > sec.preview + 1 && (
              <Button variant="quiet" size="sm" className="mt-2 w-full" onClick={() => toggleSection(sec.key)} aria-expanded={!!expanded[sec.key]}>
                {expanded[sec.key] ? 'Show Fewer' : `Show All ${sec.tasks.length} Tasks`}
              </Button>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

const HELPERS_KEY = 'mood2party:helpers-collapsed';

/** Add, review and remove the people who share the work. Can be minimized to one line. */
function HelpersPanel({ onShow }: { onShow: (who: string) => void }) {
  const { s, plan, update, toast, open } = useStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(HELPERS_KEY) !== '0'; // starts minimized until someone opens it
    } catch {
      return true;
    }
  });
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    setConfirming(null);
    try {
      localStorage.setItem(HELPERS_KEY, v ? '1' : '0');
    } catch {
      /* the choice still applies for this visit */
    }
  };
  const people = ['You', ...s.event.helpers];

  const stats = (person: string) => ({
    open: s.tasks.filter((t) => t.status !== 'done' && t.owner === person).length,
    blocked: s.tasks.filter((t) => isBlocked(t) && t.owner === person).length,
    buys: plan.active.filter((l) => (l.status === 'to-buy' || l.status === 'buy-more') && l.item.buyer === person).length,
  });

  const add = () => {
    const problem = helperNameProblem(s, name);
    if (problem) {
      setError(problem);
      return;
    }
    const clean = name.trim();
    update((p) => addHelper(p, clean));
    setName('');
    setError('');
    toast({ title: `${clean} added as an organizer`, detail: 'You can now give them tasks and purchases.', tone: 'success' });
  };

  const remove = (person: string) => {
    const r = removeHelper(s, person);
    update(() => r.state);
    setConfirming(null);
    onShow('all');
    const parts = [
      r.tasksMoved ? `${plural(r.tasksMoved, 'open task')} moved to you.` : '',
      r.itemsCleared ? `${plural(r.itemsCleared, 'purchase')} now ${r.itemsCleared === 1 ? 'needs' : 'need'} a buyer.` : '',
    ].filter(Boolean);
    toast({ title: `${person} removed`, detail: parts.join(' ') || 'They had nothing assigned.', tone: 'info' });
  };

  // Minimized: one line with who is helping and anything blocked
  if (collapsed) {
    const blocked = people.reduce((n, person) => n + stats(person).blocked, 0);
    return (
      <Card as="section" aria-labelledby="helpers-title" className="mt-6 flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Users className="size-5 shrink-0 text-forest" aria-hidden="true" />
          <p className="min-w-0 text-[15px]">
            <b id="helpers-title">Organizers</b> <span className="tnum text-muted">· {s.event.helpers.length}</span>
            <span className="text-muted"> · {s.event.helpers.length ? s.event.helpers.join(', ') : 'none yet'}</span>
            {blocked > 0 && <Pill tone="red" className="ml-2 align-middle">{blocked} blocked</Pill>}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCollapsed(false)} aria-expanded="false" aria-controls="helpers-body" className="self-start sm:self-auto">
          <ChevronDown className="size-4" /> Show
        </Button>
      </Card>
    );
  }

  return (
    <Card as="section" aria-labelledby="helpers-title" className="mt-6 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="helpers-title" className="flex items-center gap-1 font-display text-lg font-semibold">Organizers <span className="tnum ml-1 text-sm font-semibold text-muted">{s.event.helpers.length}</span>
            <InfoTip label="About organizers">The people helping you plan and buy, not every guest (guests go in Guests and RSVPs). Assigning something doesn't message anyone. Tap Send List to text or email a person everything they're responsible for. To see one person's tasks, pick their name above the task list.</InfoTip>
          </h2>
        </div>
        <Button variant="quiet" size="sm" onClick={() => setCollapsed(true)} aria-expanded="true" aria-controls="helpers-body" className="text-muted">
          <ChevronUp className="size-4" /> Hide
        </Button>
      </div>
      <div id="helpers-body">

      <ul className="mt-3 divide-y divide-line">
        {people.map((person) => {
          const st = stats(person);
          const isYou = person === 'You';
          if (confirming === person) {
            return (
              <li key={person} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-[15px]">
                  Remove <b>{person}</b>?{' '}
                  <span className="text-muted">
                    {st.open || st.buys
                      ? [st.open ? `${plural(st.open, 'open task')} will move to you` : '', st.buys ? `${plural(st.buys, 'purchase')} will need a new buyer` : ''].filter(Boolean).join(' and ') + '.'
                      : 'They have nothing assigned.'}
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="danger" onClick={() => remove(person)}>Remove</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
                </div>
              </li>
            );
          }
          return (
            <li key={person} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className={cx('grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold', isYou ? 'm2p-grad' : 'bg-sage-soft text-forest')} aria-hidden="true">
                {isYou ? 'Y' : person.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-[9rem] flex-1">
                <p className="font-semibold">{isYou ? 'You (host)' : person}</p>
                <p className="text-[13px] text-muted">
                  {plural(st.open, 'open task')} · {st.buys} to buy
                  {st.blocked > 0 && <span className="font-semibold text-danger"> · {st.blocked} blocked</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 max-sm:pl-12">
                <Button size="sm" variant="secondary" onClick={() => open({ type: 'assign', person })} aria-label={`Assign tasks and purchases to ${isYou ? 'you' : person}`}><ListPlus className="size-4" /> Assign</Button>
                {isYou
                  ? <span className="invisible inline-flex" aria-hidden="true"><Button size="sm" variant="secondary" tabIndex={-1}><Send className="size-4" /> Send List</Button></span>
                  : <Button size="sm" variant="secondary" onClick={() => open({ type: 'send', person })} aria-label={`Send ${person} their list`}><Send className="size-4" /> Send List</Button>}
                {isYou ? <span className="size-10 max-sm:hidden" aria-hidden="true" /> : (
                  <button type="button" onClick={() => setConfirming(person)} aria-label={`Remove ${person}`} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form className="mt-3 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); add(); }} noValidate>
        <label htmlFor="new-helper" className="text-sm font-semibold">Add an organizer</label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="new-helper"
            className={cx(inputBase, 'min-w-0 flex-1', error && 'border-danger')}
            placeholder="Sam"
            value={name}
            maxLength={40}
            aria-invalid={!!error}
            aria-describedby={error ? 'new-helper-error' : undefined}
            onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
          />
          <Button type="submit"><UserPlus className="size-4" /> Add Organizer</Button>
        </div>
        {error && <p id="new-helper-error" className="mt-1.5 text-[13px] text-danger">{error}</p>}
      </form>
      </div>
    </Card>
  );
}
