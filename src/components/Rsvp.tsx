import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock, Loader2, MapPin, PartyPopper } from 'lucide-react';
import { getBackend, type RsvpPage, type RsvpReply } from '../lib/cloud';
import { dateLabel, timeLabel } from '../lib/format';
import { Button, Field, Segmented, cx, inputCls } from './ui';

export type RsvpAnswer = Omit<RsvpReply, 'at'>;
const EMPTY: RsvpAnswer = { name: '', status: 'yes', adults: 1, kids: 0, dietary: '', allergies: '', note: '' };

const endTime = (start: string, hrs: number) => {
  const [h, m] = start.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const total = (h * 60 + (m || 0) + Math.round(hrs * 60)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** The party details at the top of the RSVP page. */
export function RsvpDetails({ page }: { page: RsvpPage }) {
  return (
    <div>
      <p className="text-sm font-semibold text-forest">{page.hostName ? `${page.hostName} invited you to` : "You're invited to"}</p>
      <h1 className="mt-1 font-display text-[30px] font-semibold leading-tight sm:text-[36px]">{page.name}</h1>
      <ul className="mt-3 grid gap-1.5 text-[15px] text-muted">
        <li className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0 text-forest" aria-hidden="true" />{dateLabel(page.date)}</li>
        {page.startTime && <li className="flex items-center gap-2"><Clock className="size-4 shrink-0 text-forest" aria-hidden="true" />{timeLabel(page.startTime)}{page.durationHrs ? ` to ${timeLabel(endTime(page.startTime, page.durationHrs))}` : ''}</li>}
        {page.venue && <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-forest" aria-hidden="true" />{page.venue}</li>}
      </ul>
      {page.deadline && <p className="mt-3 inline-block rounded-full bg-sage-soft px-3 py-1 text-[13px] font-semibold text-forest">Please reply by {dateLabel(page.deadline)}</p>}
    </div>
  );
}

/** The reply form, used on the guest page and in the host's preview. */
export function RsvpForm({ initial, onSubmit, submitLabel = 'Send My Reply' }: { initial?: RsvpAnswer; onSubmit: (a: RsvpAnswer) => Promise<void>; submitLabel?: string }) {
  const [a, setA] = useState<RsvpAnswer>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof RsvpAnswer>(k: K, v: RsvpAnswer[K]) => setA((p) => ({ ...p, [k]: v }));
  const num = (v: string) => Math.max(0, Math.min(30, Math.round(Number(v) || 0)));
  const coming = a.status !== 'no';
  const send = async () => {
    if (!a.name.trim()) { setError('Enter your name so the host knows who replied.'); return; }
    if (coming && a.adults + a.kids < 1) { setError('Enter how many people are coming.'); return; }
    setError('');
    setBusy(true);
    try {
      await onSubmit({ ...a, name: a.name.trim(), adults: coming ? Math.max(1, a.adults) : 0, kids: coming ? a.kids : 0 });
    } catch {
      setError("Your reply didn't go through. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); send(); }} noValidate>
      <Field label="Your name" htmlFor="rv-name">
        <input id="rv-name" className={inputCls} value={a.name} onChange={(e) => set('name', e.target.value)} placeholder="Sam Rivera, or The Rivera family" autoComplete="name" maxLength={80} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Can you come?</p>
        <Segmented label="Can you come?" value={a.status} onChange={(v) => set('status', v)} options={[{ value: 'yes', label: "Yes, I'll be there" }, { value: 'maybe', label: 'Not sure yet' }, { value: 'no', label: "Can't make it" }]} />
      </div>
      {coming && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adults (including you)" htmlFor="rv-adults"><input id="rv-adults" type="number" min={0} max={30} inputMode="numeric" className={inputCls} value={a.adults} onChange={(e) => set('adults', num(e.target.value))} /></Field>
            <Field label="Kids" htmlFor="rv-kids"><input id="rv-kids" type="number" min={0} max={30} inputMode="numeric" className={inputCls} value={a.kids} onChange={(e) => set('kids', num(e.target.value))} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Dietary needs (optional)" htmlFor="rv-diet"><input id="rv-diet" className={inputCls} value={a.dietary} onChange={(e) => set('dietary', e.target.value)} placeholder="Vegetarian, halal…" maxLength={200} /></Field>
            <Field label="Allergies (optional)" htmlFor="rv-allergy"><input id="rv-allergy" className={inputCls} value={a.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Peanuts, shellfish…" maxLength={200} /></Field>
          </div>
        </>
      )}
      <Field label="Note to the host (optional)" htmlFor="rv-note">
        <textarea id="rv-note" rows={2} className={cx(inputCls, 'py-2')} value={a.note} onChange={(e) => set('note', e.target.value)} placeholder={coming ? 'Bringing dessert!' : 'Have a great time!'} maxLength={300} />
      </Field>
      {error && <p role="alert" className="text-[14px] font-semibold text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={busy}>{busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} {submitLabel}</Button>
    </form>
  );
}

/** The page a guest opens from the RSVP link: no account, no app around it. */
export function RsvpPageView({ code }: { code: string }) {
  const backend = getBackend();
  const KEY = `m2p:rsvp:${code}`;
  const [page, setPage] = useState<RsvpPage | null | 'loading' | 'error'>('loading');
  const [mine, setMine] = useState<{ id: string; answer: RsvpAnswer } | null>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  });
  const [editing, setEditing] = useState(!mine);

  useEffect(() => {
    if (!backend) { setPage('error'); return; }
    backend.loadRsvpPage(code).then((p) => setPage(p ?? null)).catch(() => setPage('error'));
  }, [backend, code]);

  const submit = async (answer: RsvpAnswer) => {
    if (!backend || !page || typeof page === 'string') return;
    const id = mine?.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    await backend.submitRsvp(page.eventId, code, id, { ...answer, at: Date.now() });
    const saved = { id, answer };
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* the reply is sent either way */ }
    setMine(saved);
    setEditing(false);
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[640px] items-center gap-2 px-4 py-5 sm:px-6">
        <span className="grid size-9 place-items-center rounded-xl m2p-grad" aria-hidden="true"><PartyPopper className="size-5" /></span>
        <span className="m2p-grad-text font-display text-[22px] font-semibold">Mood2Party</span>
      </div>
      <main className="mx-auto max-w-[640px] px-4 pb-16 sm:px-6">
        {page === 'loading' ? (
          <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" /> Loading the invitation…</p>
        ) : page === 'error' ? (
          <div className="rounded-3xl border border-line bg-paper p-6"><h1 className="font-display text-2xl font-semibold">Couldn't load this invitation</h1><p className="mt-2 text-muted">Check your connection and reload the page.</p></div>
        ) : page === null ? (
          <div className="rounded-3xl border border-line bg-paper p-6"><h1 className="font-display text-2xl font-semibold">This RSVP link isn't active anymore</h1><p className="mt-2 text-muted">Ask the host to send you a new one.</p></div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-line bg-paper">
            <div className="m2p-grad h-2" aria-hidden="true" />
            <div className="p-5 sm:p-7">
              <RsvpDetails page={page} />
              <div className="mt-6 border-t border-line pt-6">
                {editing || !mine ? (
                  <RsvpForm initial={mine?.answer} onSubmit={submit} submitLabel={mine ? 'Update My Reply' : 'Send My Reply'} />
                ) : (
                  <div role="status">
                    <p className="flex items-center gap-2 font-display text-[22px] font-semibold"><Check className="size-6 text-ok" aria-hidden="true" /> {/^the\s/i.test(mine.answer.name) ? 'Thanks for replying!' : `Thanks, ${mine.answer.name.split(/\s+/)[0]}!`}</p>
                    <p className="mt-1 text-[15px] text-muted">
                      {mine.answer.status === 'yes' ? `You're coming${mine.answer.adults + mine.answer.kids > 1 ? `, ${mine.answer.adults + mine.answer.kids} of you` : ''}.` : mine.answer.status === 'maybe' ? "You're not sure yet." : "You can't make it."}{' '}
                      {page.hostName || 'The host'} can see your reply.
                    </p>
                    <Button variant="secondary" className="mt-4" onClick={() => setEditing(true)}>Change My Reply</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <p className="mt-6 text-center text-[13px] text-muted">No account needed. Your reply goes only to the hosts of this party.</p>
      </main>
    </div>
  );
}
