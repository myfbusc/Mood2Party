import { useEffect, useState } from 'react';
import { Camera, Check, Loader2, Plus, RotateCcw, ChevronDown, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { CATEGORIES, CATEGORY_LABEL, RETAILERS, RETAILER_IDS } from '../lib/catalog';
import { ensureKidsItems, keepCountOnFirstGuest, removeHelper, saveEventDetails } from '../lib/actions';
import { blankState } from '../lib/demo';
import { money, plural, qtyUnit } from '../lib/format';
import { todayISO, uid } from '../lib/tasks';
import { aiErrorCopy, aiName, getSample } from '../lib/ai';
import { STATUS_LABEL, STATUS_OPTIONS, shownStatus } from '../pages/Guests';
import { TASK_STATUS_LABEL } from '../pages/Tasks';
import { MenuFields } from './MenuFields';
import { menuTextFromEvent } from '../lib/menuText';
import { aiFillMenuItems, applyPatches } from '../lib/menuAi';
import { stateHeadcount } from '../lib/attendance';
import { Button, Drawer, Field, Note, SettingToggle, cx, inputCls, NumberInput } from './ui';
import { HelperChips } from './HelperChips';
import type { Category, EventInfo, GuestGroup, PlanItem, Priority, RSVPStatus, RetailerId, Task } from '../lib/types';

// ─── Edit event details ────────────────────────────────────────────

export function EventDrawer() {
  const { s, update, close, toast } = useStore();
  const [e, setE] = useState<EventInfo>(s.event);
  const [helpers, setHelpers] = useState<string[]>(s.event.helpers);
  const initialMenu = menuTextFromEvent(s.event);
  const [menu, setMenu] = useState(initialMenu);
  const menuEdited = menu.food !== initialMenu.food || menu.drinks !== initialMenu.drinks;
  const set = <K extends keyof EventInfo>(k: K, v: EventInfo[K]) => setE((p) => ({ ...p, [k]: v }));

  const save = () => {
    const next = { ...e, helpers, ...(menuEdited ? { foodText: menu.food.trim(), drinksText: menu.drinks.trim() } : {}) };
    const r = saveEventDetails(s, next);
    // Anyone taken off the helper list hands their open tasks back to you, same as removing them on the Tasks page
    let state = r.state;
    for (const gone of s.event.helpers.filter((h) => !next.helpers.includes(h))) state = removeHelper(state, gone).state;
    update(() => state);
    close();
    if (menuEdited) {
      aiFillMenuItems(state, stateHeadcount(state))
        .then((p) => { if (p) { update((cur) => applyPatches(cur, p)); toast({ title: `${aiName() === 'Claude' ? 'Claude' : 'AI'} added amounts and prices`, detail: `${plural(Object.keys(p).length, 'new menu item')}. Check them in Plan and Shop.`, tone: 'info' }); } })
        .catch(() => { /* estimates stay; prices can be added by hand */ });
    }
    if (!r.changed.length && !r.itemNotes.length && next.helpers.join() === s.event.helpers.join() && next.name === s.event.name && next.dietary === s.event.dietary && next.rsvpDeadline === s.event.rsvpDeadline) {
      toast({ title: 'No changes to save', tone: 'info' });
      return;
    }
    const parts = [
      r.changed.length ? `Changed: ${r.changed.join(', ').toLowerCase()}.` : '',
      r.shiftedDays ? `Due dates moved ${Math.abs(r.shiftedDays)} days ${r.shiftedDays > 0 ? 'later' : 'earlier'}.` : '',
      r.flagged ? `${plural(r.flagged, 'task')} marked "affected by a change".` : '',
      ...r.itemNotes.map((n) => `${n}.`),
    ].filter(Boolean);
    toast({ title: 'Event details saved', detail: parts.join(' ') || 'Your plan is up to date.', tone: 'success' });
  };

  return (
    <Drawer
      title="Edit Event Details"
      onClose={close}
      footer={<><Button onClick={save}><Check className="size-4" /> Save Changes</Button><Button variant="ghost" onClick={close}>Cancel</Button></>}
    >
      <div className="grid gap-4">
        <Field label="Event name" htmlFor="e-name"><input id="e-name" className={inputCls} value={e.name} onChange={(x) => set('name', x.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="e-date"><input id="e-date" type="date" className={inputCls} value={e.date} onChange={(x) => set('date', x.target.value)} /></Field>
          <Field label="Start time" htmlFor="e-time"><input id="e-time" type="time" className={inputCls} value={e.startTime} onChange={(x) => set('startTime', x.target.value)} /></Field>
          <Field label="Hours" htmlFor="e-dur"><NumberInput id="e-dur" min={1} className={inputCls} value={e.durationHrs} onValue={(n) => set('durationHrs', n)} /></Field>
          <Field label="RSVP deadline" htmlFor="e-rsvp"><input id="e-rsvp" type="date" className={inputCls} value={e.rsvpDeadline} onChange={(x) => set('rsvpDeadline', x.target.value)} /></Field>
          <Field label="Budget ($)" htmlFor="e-budget"><NumberInput id="e-budget" step={50} className={inputCls} value={e.budget} onValue={(n) => set('budget', n)} /></Field>
          <SettingToggle id="e-set" value={e.setting} onChange={(v) => set('setting', v)} />
        </div>
        <Field label="Location" htmlFor="e-venue"><input id="e-venue" className={inputCls} value={e.venue} onChange={(x) => set('venue', x.target.value)} /></Field>
        <MenuFields idPrefix="e" food={menu.food} drinks={menu.drinks} onFood={(v) => setMenu((m) => ({ ...m, food: v }))} onDrinks={(v) => setMenu((m) => ({ ...m, drinks: v }))} />
        <HelperChips id="e-helpers" names={helpers} onChange={setHelpers} info="The people helping you plan and buy. Removing someone moves their open tasks to you." />
        <details className="group rounded-2xl border border-dashed border-line-strong">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-forest">
            More details: theme, dietary needs, anything else
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid gap-4 border-t border-line p-4">
            <Field label="Theme or colors" htmlFor="e-theme"><input id="e-theme" className={inputCls} value={e.theme} onChange={(x) => set('theme', x.target.value)} /></Field>
            <Field label="Dietary needs" htmlFor="e-diet"><input id="e-diet" className={inputCls} value={e.dietary} onChange={(x) => set('dietary', x.target.value)} /></Field>
            <Field label="Anything else to remember" htmlFor="e-prefs" info="Preferences, must-haves or things to avoid. Shown on your Overview.">
              <textarea id="e-prefs" rows={2} className={cx(inputCls, 'py-2.5')} value={e.preferences ?? ''} onChange={(x) => set('preferences', x.target.value)} />
            </Field>
          </div>
        </details>
      </div>
    </Drawer>
  );
}

// ─── Guest group ───────────────────────────────────────────────────

export function GuestDrawer({ id }: { id?: string }) {
  const { s, update, close, toast } = useStore();
  const existing = s.guests.find((g) => g.id === id);
  const [g, setG] = useState<GuestGroup>(existing ? { ...existing, status: shownStatus(existing.status) } : { id: uid('guest'), name: '', adults: 1, children: 0, status: 'confirmed', note: '' });
  const set = <K extends keyof GuestGroup>(k: K, v: GuestGroup[K]) => setG((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!g.name.trim()) return;
    const clean = { ...g, name: g.name.trim(), plusOnes: g.plusOnes || undefined, dietary: g.dietary?.trim() || undefined, allergies: g.allergies?.trim() || undefined };
    update((p) => keepCountOnFirstGuest(p, ensureKidsItems({ ...p, guests: existing ? p.guests.map((x) => (x.id === g.id ? clean : x)) : [clean, ...p.guests] })));
    close();
    toast({ title: existing ? 'Guest group updated' : 'Guest group added', detail: `${clean.name}: ${clean.adults + clean.children + (clean.plusOnes ?? 0)} people, ${STATUS_LABEL[clean.status].toLowerCase()}.`, tone: 'success' });
  };
  return (
    <Drawer
      title={existing ? 'Edit Guest Group' : 'Add Guest Group'}
      onClose={close}
      footer={
        <>
          <Button onClick={save} disabled={!g.name.trim()}><Check className="size-4" /> Save</Button>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          {existing && (
            <Button variant="danger" className="ml-auto" onClick={() => { const i = s.guests.findIndex((x) => x.id === existing.id); update((p) => ({ ...p, guests: p.guests.filter((x) => x.id !== existing.id) })); close(); toast({ title: `${existing.name} removed`, tone: 'info', action: { label: 'Undo', run: () => update((p) => (p.guests.some((x) => x.id === existing.id) ? p : { ...p, guests: [...p.guests.slice(0, i), existing, ...p.guests.slice(i)] })) } }); }}>
              <Trash2 className="size-4" /> <span className="max-sm:sr-only">Delete</span>
            </Button>
          )}
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Name or household" htmlFor="g-name"><input id="g-name" className={inputCls} value={g.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Adults" htmlFor="g-a"><NumberInput id="g-a" className={inputCls} value={g.adults} onValue={(n) => set('adults', Math.round(n))} /></Field>
          <Field label="Children" htmlFor="g-c"><NumberInput id="g-c" className={inputCls} value={g.children} onValue={(n) => set('children', Math.round(n))} /></Field>
          <Field label="Plus-ones" htmlFor="g-p"><NumberInput id="g-p" className={inputCls} value={g.plusOnes ?? 0} onValue={(n) => set('plusOnes', Math.round(n))} /></Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">RSVP Status</legend>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((k: RSVPStatus) => (
              <label key={k} className={cx('flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-1.5 text-center text-[13px] font-semibold', g.status === k ? 'border-forest bg-sage-soft text-forest' : 'border-line bg-paper hover:border-forest/50')}>
                <input type="radio" name="g-status" value={k} checked={g.status === k} onChange={() => set('status', k)} className="sr-only" /> {STATUS_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dietary needs" htmlFor="g-diet"><input id="g-diet" className={inputCls} value={g.dietary ?? ''} onChange={(e) => set('dietary', e.target.value)} placeholder="Vegetarian, halal…" /></Field>
          <Field label="Allergies" htmlFor="g-allergy"><input id="g-allergy" className={inputCls} value={g.allergies ?? ''} onChange={(e) => set('allergies', e.target.value)} placeholder="Peanuts, shellfish…" /></Field>
        </div>
        <Field label="Note" htmlFor="g-note"><input id="g-note" className={inputCls} value={g.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="Bringing dessert, needs parking…" /></Field>
      </form>
    </Drawer>
  );
}

// ─── Task ──────────────────────────────────────────────────────────

export function TaskDrawer({ id }: { id?: string }) {
  const { s, update, close, toast, markDid } = useStore();
  const existing = s.tasks.find((t) => t.id === id);
  const [t, setT] = useState<Task>(existing ?? { id: uid('task'), title: '', category: 'General', owner: 'You', dueDate: todayISO(), status: 'todo', priority: 'medium', blocker: null, affectedBy: null });
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setT((p) => ({ ...p, [k]: v }));
  const people = [...new Set(['You', ...s.event.helpers, t.owner])];
  const save = () => {
    if (!t.title.trim()) return;
    const clean: Task = { ...t, title: t.title.trim(), needs: t.needs?.trim() || undefined, blocker: t.blocker?.trim() ? t.blocker.trim() : null, status: t.blocker?.trim() && t.status === 'todo' ? 'blocked' : t.status };
    update((p) => ({ ...p, tasks: existing ? p.tasks.map((x) => (x.id === t.id ? clean : x)) : [...p.tasks, clean] }));
    if (clean.owner !== 'You') markDid('task');
    close();
    toast({ title: existing ? 'Task updated' : 'Task added', detail: clean.title, tone: 'success' });
  };
  return (
    <Drawer
      title={existing ? 'Task Details' : 'Add a Task'}
      onClose={close}
      footer={
        <>
          <Button onClick={save} disabled={!t.title.trim()}><Check className="size-4" /> Save Changes</Button>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          {existing && (
            <Button variant="danger" className="ml-auto" onClick={() => { const i = s.tasks.findIndex((x) => x.id === existing.id); update((p) => ({ ...p, tasks: p.tasks.filter((x) => x.id !== existing.id) })); close(); toast({ title: 'Task deleted', detail: existing.title, tone: 'info', action: { label: 'Undo', run: () => update((p) => (p.tasks.some((x) => x.id === existing.id) ? p : { ...p, tasks: [...p.tasks.slice(0, i), existing, ...p.tasks.slice(i)] })) } }); }}>
              <Trash2 className="size-4" /> <span className="max-sm:sr-only">Delete</span>
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Task" htmlFor="t-title"><input id="t-title" className={inputCls} value={t.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned to" htmlFor="t-owner">
            <select id="t-owner" className={inputCls} value={t.owner} onChange={(e) => set('owner', e.target.value)}>
              {people.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Due date" htmlFor="t-due"><input id="t-due" type="date" className={inputCls} value={t.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
          <Field label="Status" htmlFor="t-status">
            <select id="t-status" className={inputCls} value={t.status} onChange={(e) => set('status', e.target.value as Task['status'])}>
              {(Object.keys(TASK_STATUS_LABEL) as Task['status'][]).map((k) => <option key={k} value={k}>{TASK_STATUS_LABEL[k]}</option>)}
            </select>
          </Field>
          <Field label="Priority" htmlFor="t-pri">
            <select id="t-pri" className={inputCls} value={t.priority} onChange={(e) => set('priority', e.target.value as Task['priority'])}>
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </Field>
        </div>
        <Field label="What is blocking it?" htmlFor="t-block" hint="Leave empty if nothing is in the way. It shows under Needs attention.">
          <textarea id="t-block" rows={2} className={cx(inputCls, 'py-2')} value={t.blocker ?? ''} onChange={(e) => set('blocker', e.target.value || null)} placeholder="Waiting on…" />
        </Field>
        <Field label="Does it need anything?" htmlFor="t-needs" hint="A car, cash, a ladder, an extra pair of hands. Shows as a heads-up so someone can help in time.">
          <input id="t-needs" className={inputCls} value={t.needs ?? ''} onChange={(e) => set('needs', e.target.value)} placeholder="Needs a car to pick it up" />
        </Field>
        <p className="text-[13px] text-muted">Assigning doesn't message anyone. Use <b>Send List</b> under Organizers on the Tasks and Organizers page to text or email each person their tasks and purchases.</p>
        {t.affectedBy && (
          <Note tone="gold">
            <p className="font-semibold">Affected by a change</p>
            <p className="mt-0.5">{t.affectedBy}</p>
            <Button size="sm" variant="secondary" className="mt-2 bg-paper" onClick={() => set('affectedBy', null)}>Mark as Reviewed</Button>
          </Note>
        )}
      </div>
    </Drawer>
  );
}

// ─── Inspiration photo → items (Claude, optional) ──────────────────

interface Suggestion { name: string; category: Category; qty: number; unit: string; packQty: number; packPrice: number; retailer: RetailerId; priority: Priority; why: string }

export function InspireDrawer() {
  const { s, head, plan, update, close, toast } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<(Suggestion & { on: boolean })[]>([]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const analyze = async () => {
    const sample = await getSample();
    if (!sample || !file) return;
    setBusy(true);
    setErr('');
    try {
      const out = await sample.json<Suggestion[]>(
        `A DIY host uploaded an inspiration photo for their event. Suggest up to 6 practical items to buy that would recreate the look, sized for ${head.total} guests.
Event: ${s.event.type}, theme "${s.event.theme}", ${s.event.setting}. Budget left: ${money(Math.max(0, plan.remaining), false)}.
Items already in the plan (do not repeat): ${s.items.filter((x) => !x.removed).map((x) => x.name).join(', ')}.
Reply with only a JSON array of objects: {"name": string, "category": "decorations"|"tableware"|"supplies"|"food", "qty": number, "unit": string, "packQty": number, "packPrice": number (realistic USD estimate), "retailer": "amazon"|"target"|"costco"|"instacart", "priority": "essential"|"optional", "why": string (one short sentence)}.`,
        { images: file, modelTier: 'default' },
      );
      const clean = (Array.isArray(out) ? out : []).slice(0, 6).map((x) => ({
        name: String(x.name ?? 'Item').slice(0, 60),
        category: (CATEGORIES as string[]).includes(x.category) ? x.category : 'decorations',
        qty: Math.max(1, Math.round(Number(x.qty) || 1)),
        unit: String(x.unit ?? 'items').slice(0, 20),
        packQty: Math.max(1, Math.round(Number(x.packQty) || 1)),
        packPrice: Math.max(0, Math.round((Number(x.packPrice) || 0) * 100) / 100),
        retailer: (RETAILER_IDS as string[]).includes(x.retailer) ? x.retailer : 'amazon',
        priority: x.priority === 'optional' ? 'optional' : 'essential',
        why: String(x.why ?? '').slice(0, 160),
        on: true,
      })) as (Suggestion & { on: boolean })[];
      setItems(clean);
      if (!clean.length) setErr(`${aiName() === 'Claude' ? 'Claude' : 'The AI'} did not suggest any items for this photo. Try another one.`);
    } catch (e) {
      setErr(aiErrorCopy(e).text);
    } finally {
      setBusy(false);
    }
  };

  const chosen = items.filter((x) => x.on);
  const cost = chosen.reduce((a, x) => a + Math.ceil(x.qty / x.packQty) * x.packPrice, 0);
  const add = () => {
    const newItems: PlanItem[] = chosen.map((x) => ({
      id: uid('photo'), name: x.name, category: x.category, priority: x.priority, unit: x.unit,
      rule: { kind: 'fixed', qty: x.qty }, ruleText: `Suggested from your inspiration photo: ${x.why || 'matches the look'}`,
      options: [{ retailer: x.retailer, product: x.name, packQty: x.packQty, packLabel: x.packQty === 1 ? '1 item' : `${x.packQty}-pack`, packPrice: x.packPrice }],
      retailer: x.retailer, qtyOverride: null, overrideAtRec: null, ownedQty: 0, removed: false, purchasedPkgs: 0, buyer: '',
      source: 'inspiration', priceNote: 'AI price estimate; check before buying.',
    }));
    update((p) => ({ ...p, items: [...p.items, ...newItems] }));
    close();
    toast({ title: `${plural(newItems.length, 'item')} added from your photo`, detail: `About ${money(cost)} added to the estimate.`, tone: 'success' });
  };

  return (
    <Drawer
      title="Turn a Photo Into a Shopping List"
      subtitle={`Upload a party photo you like. ${aiName() === 'Claude' ? 'Claude' : 'The AI'} suggests items, amounts and prices you can edit.`}
      onClose={close}
      footer={items.length ? <><Button onClick={add} disabled={!chosen.length}><Plus className="size-4" /> Add {chosen.length} to plan · {money(cost)}</Button><Button variant="ghost" onClick={close}>Cancel</Button></> : undefined}
    >
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-paper p-5 text-center hover:border-forest">
        {preview ? <img src={preview} alt="Your inspiration" className="max-h-56 rounded-xl object-contain" /> : <Camera className="size-8 text-forest" />}
        <span className="text-sm font-semibold text-forest">{file ? 'Choose a different photo' : 'Choose a photo'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setItems([]); }} />
      </label>
      {file && !items.length && (
        <Button className="mt-4" onClick={analyze} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} {busy ? 'Looking at your photo… this can take a minute' : 'Suggest items'}
        </Button>
      )}
      {err && <Note tone="coral" className="mt-4">{err}</Note>}
      {items.length > 0 && (
        <ul className="mt-5 grid gap-2">
          {items.map((x, i) => (
            <li key={i}>
              <label className="flex cursor-pointer gap-3 rounded-xl border border-line bg-paper p-3">
                <input type="checkbox" className="mt-1 size-5 accent-forest" checked={x.on} onChange={() => setItems((all) => all.map((y, j) => (j === i ? { ...y, on: !y.on } : y)))} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{x.name}</span>
                  <span className="tnum block text-[13px] text-muted">{qtyUnit(x.qty, x.unit)} · {Math.ceil(x.qty / x.packQty)} × {money(x.packPrice)} at {RETAILERS[x.retailer].short} · {CATEGORY_LABEL[x.category]}</span>
                  {x.why && <span className="block text-[13px]">{x.why}</span>}
                </span>
              </label>
            </li>
          ))}
          <p className="text-[13px] text-muted">Prices are AI estimates. You can edit each item after adding it.</p>
        </ul>
      )}
    </Drawer>
  );
}

// ─── Reset / start over (in-page confirmation; no browser dialogs) ─

export function ResetDrawer() {
  const { s, replace, go, close, events, deleteEvent, clearAllEvents } = useStore();
  const [alsoEvents, setAlsoEvents] = useState(false);
  const others = events.filter((e) => e.id !== s.eventId).length;
  const restart = () => {
    if (s.isDemo) {
      // Resetting the demo brings onboarding back for the next test participant.
      if (alsoEvents) clearAllEvents();
      replace(blankState(alsoEvents ? undefined : s.learnings));
    } else if (s.eventId) {
      // Deleting your own plan keeps onboarding as it was (no welcome or tour again) and keeps your other events.
      deleteEvent(s.eventId);
    } else {
      replace({ ...blankState(s.learnings), onboarding: { ...s.onboarding, tourCompleted: false } });
    }
    close();
    go('welcome');
  };
  return (
    <Drawer
      title={s.isDemo ? 'Reset the demo?' : 'Start over?'}
      onClose={close}
      footer={
        <>
          <Button variant={s.isDemo ? 'primary' : 'danger'} onClick={restart}>
            <RotateCcw className="size-4" /> {s.isDemo ? 'Reset and go to the homepage' : 'Delete this plan'}
          </Button>
          <Button variant="ghost" onClick={close}>Cancel</Button>
        </>
      }
    >
      <p className="text-[15px]">
        {s.isDemo
          ? 'This clears the sample party and every change made to it, then starts again from the homepage with the welcome and tour. Use it between usability-test sessions.'
          : `This deletes the guest list, plan, tasks and budget for ${s.event.name} from this browser. ${others ? `Your other ${plural(others, 'event')} stay saved. ` : ''}What you learned from past events is kept.`}
      </p>
      {s.isDemo && events.length > 0 && (
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
          <input type="checkbox" className="size-5" checked={alsoEvents} onChange={(e) => setAlsoEvents(e.target.checked)} />
          <span>Also delete the {plural(events.length, 'saved event')} made in this browser (for a clean test session)</span>
        </label>
      )}
    </Drawer>
  );
}
