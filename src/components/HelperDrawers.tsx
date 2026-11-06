import { useMemo, useState } from 'react';
import { Check, Copy, Mail, MessageSquare } from 'lucide-react';
import { useStore } from '../lib/store';
import { storeShort } from '../lib/catalog';
import { copyText } from '../lib/links';
import { dateLabel, money, plural, qtyUnit } from '../lib/format';
import { Button, Drawer, Note, cx } from './ui';

const who = (p: string) => (p === 'You' ? 'you' : p);

/** Assign tasks and purchases to one person in a single place. */
export function AssignDrawer({ person }: { person: string }) {
  const { s, plan, update, close, toast, markDid } = useStore();
  const tasks = useMemo(() => s.tasks.filter((t) => t.status !== 'done').sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [s.tasks]);
  const buys = useMemo(() => plan.active.filter((l) => l.status === 'to-buy' || l.status === 'buy-more'), [plan.active]);
  const [taskSel, setTaskSel] = useState<Set<string>>(() => new Set(tasks.filter((t) => t.owner === person).map((t) => t.id)));
  const [buySel, setBuySel] = useState<Set<string>>(() => new Set(buys.filter((l) => l.item.buyer === person).map((l) => l.item.id)));
  const toggle = (set: Set<string>, id: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    fn(n);
  };

  const save = () => {
    update((p) => ({
      ...p,
      tasks: p.tasks.map((t) => {
        if (t.status === 'done') return t;
        if (taskSel.has(t.id) && t.owner !== person) { return { ...t, owner: person }; }
        // Unticked: tasks taken away from this person go back to you
        if (!taskSel.has(t.id) && t.owner === person && person !== 'You') { return { ...t, owner: 'You' }; }
        return t;
      }),
      items: p.items.map((it) => {
        const open = buys.some((l) => l.item.id === it.id);
        if (!open) return it;
        if (buySel.has(it.id) && it.buyer !== person) { return { ...it, buyer: person }; }
        if (!buySel.has(it.id) && it.buyer === person) { return { ...it, buyer: '' }; }
        return it;
      }),
    }));
    if (person !== 'You') markDid('task');
    close();
    toast({
      title: `${person === 'You' ? 'Your' : `${person}'s`} list is updated`,
      detail: `${plural(taskSel.size, 'task')} and ${plural(buySel.size, 'purchase')} assigned. Use Send list to let ${who(person)} know.`,
      tone: 'success',
    });
  };

  return (
    <Drawer
      title={`Assign to ${person === 'You' ? 'yourself' : person}`}
      subtitle="Tick what this person is responsible for. Unticking gives a task back to you, or a purchase back to No buyer yet."
      onClose={close}
      footer={
        <>
          <Button onClick={save}><Check className="size-4" /> Save Assignments</Button>
          <Button variant="ghost" onClick={close}>Cancel</Button>
        </>
      }
    >
      <section aria-labelledby="as-tasks">
        <h3 id="as-tasks" className="font-bold">Tasks <span className="tnum text-sm font-semibold text-muted">{taskSel.size} of {tasks.length}</span></h3>
        <ul className="mt-2 grid gap-1.5">
          {tasks.map((t) => (
            <li key={t.id}>
              <label className={cx('flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm', taskSel.has(t.id) ? 'border-forest/50 bg-sage-soft' : 'border-line bg-paper')}>
                <input type="checkbox" className="size-5 accent-forest" checked={taskSel.has(t.id)} onChange={() => toggle(taskSel, t.id, setTaskSel)} />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{t.title}</span>
                  <span className="block text-[13px] text-muted">Due {dateLabel(t.dueDate)}{t.owner !== person ? ` · now ${t.owner === 'You' ? 'you' : t.owner}` : ''}</span>
                </span>
              </label>
            </li>
          ))}
          {tasks.length === 0 && <li className="text-sm text-muted">No open tasks.</li>}
        </ul>
      </section>
      <section aria-labelledby="as-buys" className="mt-6">
        <h3 id="as-buys" className="font-bold">Purchases <span className="tnum text-sm font-semibold text-muted">{buySel.size} of {buys.length}</span></h3>
        <ul className="mt-2 grid gap-1.5">
          {buys.map((l) => (
            <li key={l.item.id}>
              <label className={cx('flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm', buySel.has(l.item.id) ? 'border-forest/50 bg-sage-soft' : 'border-line bg-paper')}>
                <input type="checkbox" className="size-5 accent-forest" checked={buySel.has(l.item.id)} onChange={() => toggle(buySel, l.item.id, setBuySel)} />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{l.item.name}</span>
                  <span className="tnum block text-[13px] text-muted">{qtyUnit(l.need, l.item.unit)} · {storeShort(l.opt)} · about {money(l.cost)}{l.item.buyer && l.item.buyer !== person ? ` · now ${l.item.buyer === 'You' ? 'you' : l.item.buyer}` : ''}</span>
                </span>
              </label>
            </li>
          ))}
          {buys.length === 0 && <li className="text-sm text-muted">Nothing left to buy.</li>}
        </ul>
      </section>
    </Drawer>
  );
}

/** A ready-to-send message with one person's tasks and purchases. Mood2Party never sends it by itself. */
export function SendDrawer({ person }: { person: string }) {
  const { s, plan, close, toast } = useStore();
  const tasks = s.tasks.filter((t) => t.status !== 'done' && t.owner === person).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const buys = plan.active.filter((l) => (l.status === 'to-buy' || l.status === 'buy-more') && l.item.buyer === person);
  const first = person.split(/\s+/)[0];
  const initial = [
    `Hi ${first}! Here's your part for ${s.event.name} (${dateLabel(s.event.date)}):`,
    ...(tasks.length ? ['', 'Tasks:', ...tasks.map((t) => `- ${t.title} (by ${dateLabel(t.dueDate)})${t.needs ? ` · needs: ${t.needs}` : ''}`)] : []),
    ...(buys.length ? ['', 'To buy:', ...buys.map((l) => `- ${l.item.name}: ${l.status === 'buy-more' ? l.morePkgs : l.pkgs} × ${l.opt.packLabel} at ${storeShort(l.opt)} (about ${money(l.status === 'buy-more' ? l.morePkgs * l.opt.packPrice : l.cost)})`)] : []),
    '',
    "Let me know if anything is blocking you or if you need something (a car, cash, a hand). Thanks!",
  ].join('\n');
  const [text, setText] = useState(initial);
  const empty = !tasks.length && !buys.length;
  const subject = `Your part for ${s.event.name}`;

  return (
    <Drawer
      title={`Send ${first} their list`}
      subtitle="Mood2Party doesn't message anyone for you. Copy this, or open it in your text or email app, and send it yourself."
      onClose={close}
      footer={<Button variant="ghost" onClick={close}>Close</Button>}
    >
      {empty ? (
        <Note>{person} has nothing assigned yet. Use <b>Assign</b> to give them tasks or purchases first.</Note>
      ) : (
        <>
          <label htmlFor="send-text" className="text-sm font-semibold">Message (you can edit it)</label>
          <textarea id="send-text" rows={Math.min(18, text.split('\n').length + 2)} className="mt-1.5 w-full rounded-xl border border-line-strong bg-paper p-3 text-[14px] leading-relaxed text-ink focus:border-forest" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button
              className="col-span-2 justify-center sm:col-span-1"
              onClick={async () => {
                const ok = await copyText(text);
                toast(ok ? { title: 'Message copied', detail: `Paste it into a text, a chat or an email to ${first}.`, tone: 'success' } : { title: 'Copying is blocked here', detail: 'Select the message and copy it instead.', tone: 'warn' });
              }}
            >
              <Copy className="size-4" /> Copy
            </Button>
            <a href={`sms:?&body=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 font-display text-sm font-semibold text-ink hover:bg-cream">
              <MessageSquare className="size-4" aria-hidden="true" /> Text It
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 font-display text-sm font-semibold text-ink hover:bg-cream">
              <Mail className="size-4" aria-hidden="true" /> Email It
            </a>
          </div>
          <p className="mt-4 text-[13px] text-muted">
            {first} sees exactly what's in this message. You can always see everyone's responsibilities on the Tasks page: pick their name under "Show tasks for".
          </p>
        </>
      )}
    </Drawer>
  );
}
