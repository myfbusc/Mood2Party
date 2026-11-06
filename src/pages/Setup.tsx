import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Info, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { completeDraft, extractNames, parseDescription, SAMPLE_DESCRIPTION, emptyDraft, type Draft, type Field as PlanField } from '../lib/parse';
import { planFromDraft } from '../lib/actions';
import { aiErrorCopy, aiName, aiNeedsSignIn, getSample } from '../lib/ai';
import { Logo } from '../components/Shell';
import { HelperChips } from '../components/HelperChips';
import { MenuFields } from '../components/MenuFields';
import { aiFillMenuItems, applyPatches } from '../lib/menuAi';
import { stateHeadcount } from '../lib/attendance';
import { plural } from '../lib/format';
import type { AppState, Category } from '../lib/types';
import type { ReactNode } from 'react';
import { parseMenu } from '../lib/menuText';
import { fitToBudget, SpendLevels, useSpendCosts, type Spend } from '../components/SpendLevels';
import { money } from '../lib/format';
import { Button, Card, Field, InfoTip, Note, Segmented, SettingToggle, cx, inputBase, inputCls } from '../components/ui';

type Step = 'describe' | 'review' | 'spend';

export default function Setup() {
  const { s, replace, update, go, toast, cloud } = useStore();
  const [step, setStep] = useState<Step>('describe');
  const [mode, setMode] = useState<'text' | 'form'>('text');
  const [text, setText] = useState(SAMPLE_DESCRIPTION);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [aiReady, setAiReady] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [aiSignIn, setAiSignIn] = useState(false);
  const [spend, setSpend] = useState<Spend>({});

  // Check again after signing in or out: on the public site the AI needs a Google sign-in
  useEffect(() => {
    let live = true;
    getSample().then((x) => live && setAiReady(!!x));
    aiNeedsSignIn().then((v) => live && setAiSignIn(v));
    return () => {
      live = false;
    };
  }, [cloud.user]);

  const readLocally = () => {
    const r = parseDescription(text);
    setDraft(r.draft);
    setAssumptions(r.assumptions);
    setFound(r.found);
    setStep('review');
    window.scrollTo({ top: 0 });
  };

  const readWithClaude = async () => {
    const sample = await getSample();
    if (!sample) return readLocally();
    setAiBusy(true);
    setAiNote('');
    const base = parseDescription(text);
    try {
      const out = await sample.json<Partial<Draft> & { assumptions?: string[]; stated?: string[]; found?: string[] }>(
        `You help a DIY host set up an event plan. Read their description closely and pull out only what it says or clearly implies. Never invent details: anything the description does not give is filled in afterwards with defaults that fit the kind of party.
Today is ${new Date().toISOString().slice(0, 10)}.
Rules:
- Work out the occasion from any hint: holidays (Halloween, Friendsgiving, New Year's Eve, Diwali...), life events (birthdays with the age, graduations, showers, retirements, celebrations of life, going-away...), and themed parties ("ugly sweater party", "murder mystery dinner"). Keep the host's own kind of gathering ("Christmas brunch", "book club dinner", "10th birthday pool party"). Never answer "Party" if the text names or hints at any occasion.
- If someone is being celebrated, note who ("Maya's graduation", "for my son Leo" gives Leo, "Jake and Mia's engagement").
- name: a short, clear event name in Title Case from who it is for and the occasion, e.g. "Leo's 7th Birthday Party", "Halloween Costume Party". Not a sentence.
- Dates can be relative or loose: "the day before Halloween" (Oct 30), "the weekend before Christmas" (the Saturday before), "next Friday", "in two weeks", "Saturday the 21st", "mid-December" (a Saturday mid-month), "the first weekend of March". Work out the exact future calendar date.
- Times without am/pm: "at 7" for a party is 7 PM; "at 10" for a brunch is 10 AM. "From 4 to 7" gives a start and a length. "Until midnight" gives the length.
- Guests: "a few friends" is about 5, "a dozen" 12, "10 couples" 20, "50+" about 55-60, "up to 40" about 35 (max 40), a range gives min and max. "15 kids and their parents" is about 30 with 15 kids. "Adults only" means 0 kids.
- venue: the place in the host's own words, keeping details ("Pool on the rooftop of my apartment", "Nobu, Malibu"). Rooftops, pools, parks, beaches, yards, patios and terraces are "outdoors".
- dietary: only needs actually mentioned (vegetarian, vegan, gluten-free, nut allergy, halal, kosher...).
Reply with only a JSON object with these keys. Use null for any value the description does not give:
stated (array of the parts the description actually gave, from: "type","date","time","duration","guests","kids","budget","setting","venue","food","drinks","theme","dietary","helpers"),
name, type (the occasion in a few words, e.g. "Halloween party", "7th birthday party"), honoree (who it is for, or ""), date (YYYY-MM-DD), startTime (HH:MM 24h), durationHrs (number),
venue, setting ("indoors" or "outdoors"), dietary, theme, budget (number, USD total; a per-person amount times the guests), guestMin, guestExpected, guestMax (numbers), children (number of kids expected),
helpers (array of the organizing team's first names only, never the host; e.g. "me and my boyfriend Lucas" gives ["Lucas"]; "Helper 1" etc. if only a count is given),
preferences (short comma-separated list of activities and wishes, e.g. "costume contest, pumpkin carving"; "" if none),
foodText (every food mentioned, short comma-separated plain words, e.g. "taco bar, pupusas, cupcakes"; "" if none),
drinksText (every drink mentioned, comma-separated, e.g. "water, lemonade, beer"; "" if none),
found (array of short "Label: value" notes for what the description said, e.g. "Occasion: Halloween party", "For: Leo", "Guests: about 30", "Date: Friday, October 30 (the day before Halloween)"),
assumptions (array of short plain sentences only for things you had to interpret, e.g. "10 couples counted as 20 guests." Do not mention missing details; those are handled separately).

Description:
"""${text.slice(0, 4000)}"""`,
        { modelTier: 'quick' },
      );
      const FIELDS: PlanField[] = ['type', 'date', 'time', 'duration', 'guests', 'kids', 'budget', 'setting', 'venue', 'food', 'drinks', 'theme', 'dietary', 'helpers'];
      const baseStated = new Set<PlanField>(base.stated);
      const aiStated = new Set<PlanField>((Array.isArray(out.stated) ? out.stated : []).map(String).filter((f): f is PlanField => (FIELDS as string[]).includes(f)));
      const stated = new Set<PlanField>([...baseStated, ...aiStated]);
      const d: Draft = { ...base.draft };
      const said = (v: unknown) => typeof v === 'string' && v.trim() && !/^(?:general )?party$/i.test(v.trim());
      const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : null);
      const str = (v: unknown) => (typeof v === 'string' && v.trim() && !/^(?:null|none|n\/a|unknown|tbd)$/i.test(v.trim()) ? v.trim() : null);
      const ai = (f: PlanField) => aiStated.has(f);
      if (said(out.name)) d.name = String(out.name).trim().slice(0, 80);
      if (said(out.type)) { d.type = String(out.type).trim().slice(0, 60); stated.add('type'); }
      // The built-in reader is exact about dates, times, places and numbers it finds in the text, so those win
      const today = new Date().toISOString().slice(0, 10);
      if (ai('date') && !baseStated.has('date') && /^\d{4}-\d{2}-\d{2}$/.test(String(out.date)) && String(out.date) >= today) d.date = String(out.date);
      else if (!baseStated.has('date')) stated.delete('date');
      if (ai('time') && !baseStated.has('time') && /^\d{2}:\d{2}$/.test(String(out.startTime))) d.startTime = String(out.startTime);
      else if (!baseStated.has('time')) stated.delete('time');
      if (ai('duration') && !baseStated.has('duration') && num(out.durationHrs)) d.durationHrs = num(out.durationHrs)!;
      else if (!baseStated.has('duration')) stated.delete('duration');
      if (ai('guests') && num(out.guestExpected)) {
        const exp = Math.round(num(out.guestExpected)!);
        if (!baseStated.has('guests') || Math.abs(exp - base.draft.guestExpected) > Math.max(3, base.draft.guestExpected * 0.3)) {
          d.guestExpected = exp;
          d.guestMin = Math.round(num(out.guestMin) ?? exp * 0.8);
          d.guestMax = Math.round(num(out.guestMax) ?? exp * 1.2);
        }
      } else if (!baseStated.has('guests')) stated.delete('guests');
      if (ai('kids') && num((out as { children?: unknown }).children) !== null && !baseStated.has('kids')) d.children = Math.round(num((out as { children?: unknown }).children)!);
      else if (!baseStated.has('kids')) stated.delete('kids');
      d.children = Math.min(d.children, d.guestExpected || d.children);
      if (ai('budget') && num(out.budget) && !baseStated.has('budget')) d.budget = Math.round(num(out.budget)!);
      else if (!baseStated.has('budget')) stated.delete('budget');
      if (ai('venue') && str(out.venue)) {
        const v = str(out.venue)!;
        if (!baseStated.has('venue') || (!/^(?:home|my place|house)$/i.test(v) && v.length >= base.draft.venue.length / 2)) d.venue = v.slice(0, 120);
      } else if (!baseStated.has('venue')) stated.delete('venue');
      if (!baseStated.has('setting') && ai('setting') && (out.setting === 'outdoors' || out.setting === 'indoors')) d.setting = out.setting;
      else if (!baseStated.has('setting')) stated.delete('setting');
      if (ai('theme') && str(out.theme)) d.theme = str(out.theme)!;
      else if (!baseStated.has('theme')) stated.delete('theme');
      if (ai('dietary') && str(out.dietary)) d.dietary = str(out.dietary)!;
      if (ai('helpers') && Array.isArray(out.helpers)) {
        const names = [...new Set(out.helpers.flatMap((h) => extractNames(String(h)).names))].slice(0, 10);
        if (names.length >= d.helpers.length) d.helpers = names;
      }
      if (str(out.preferences)) d.preferences = str(out.preferences)!;
      if (ai('food') && str(out.foodText)) d.foodText = str(out.foodText)!.slice(0, 300);
      else if (!baseStated.has('food')) stated.delete('food');
      if (ai('drinks') && str(out.drinksText)) d.drinksText = str(out.drinksText)!.slice(0, 300);
      else if (!baseStated.has('drinks')) stated.delete('drinks');
      // Everything not stated gets the same defaults the built-in reader uses, fitted to the occasion the AI found
      const age = Number(d.type.match(/(\d{1,3})(?:st|nd|rd|th)\s+birthday/i)?.[1] ?? base.ctx.age ?? NaN);
      const birthday = base.ctx.birthday || /birthday/i.test(d.type);
      const ctx = { ...base.ctx, birthday, age: isNaN(age) ? null : age, kidsParty: base.ctx.kidsParty || (birthday && !isNaN(age) && age <= 12) || /\bkids'?\b|children'?s/i.test(d.type) };
      const done = completeDraft(d, stated, ctx);
      const final = done.draft;
      { const m = parseMenu(final.foodText, final.drinksText); if (final.foodText) { final.foodFormat = m.foodFormat; final.extraFood = m.extraFood; } if (final.drinksText) { final.alcohol = m.alcohol; final.softDrinks = m.softDrinks; } }
      final.venueCapacity = Math.max(final.venueCapacity, final.guestMax + 10);
      setDraft(final);
      // Notes: how the AI read things, then what was filled in and why
      const aiNotes = (Array.isArray(out.assumptions) ? out.assumptions.map(String).filter(Boolean) : [])
        .filter((n) => !/\b(?:no|not|wasn'?t|didn'?t|missing|unspecified|assumed|default)\b/i.test(n)).slice(0, 4);
      const nameNote = final.name && final.name !== 'Party' ? `Suggested the name "${final.name}". Change it below.` : 'Give your event a name below.';
      const dateNote = !stated.has('date') ? base.assumptions.filter((n) => /date/i.test(n)) : [];
      const helperNote = final.helpers.length ? [] : base.assumptions.filter((n) => /organizers/i.test(n));
      setAssumptions([nameNote, ...aiNotes, ...dateNote, ...done.notes, ...helperNote]);
      let aiFound = Array.isArray(out.found) ? out.found.map(String).filter(Boolean).slice(0, 12) : [];
      // Show the date and place that are used, in the same words as the form below
      const baseDate = base.found.find((f) => /^Date:/.test(f));
      aiFound = aiFound.filter((f) => !(baseDate && /^Date:/i.test(f)) && !(stated.has('venue') && /^(?:Place|Location|Venue):/i.test(f)));
      if (baseDate) aiFound.push(baseDate);
      if (stated.has('venue')) aiFound.push(`Place: ${final.venue}`);
      setFound(aiFound.length ? aiFound : base.found);
      setStep('review');
      window.scrollTo({ top: 0 });
    } catch (e) {
      const c = aiErrorCopy(e);
      if (c.hide) setAiReady(false);
      if (c.text) setAiNote(c.text);
      if (c.hide) readLocally();
    } finally {
      setAiBusy(false);
    }
  };

  const fromForm = () => {
    setAssumptions(['You filled in the details yourself, so nothing was guessed.']);
    setFound([]);
    setStep('review');
  };

  const problems: string[] = [];
  if (draft.guestExpected <= 0) problems.push('Enter how many guests you expect.');
  if (draft.children > draft.guestExpected) problems.push('Children are part of the guest count, so they can\'t be more than the number of guests.');
  if (!draft.budget || draft.budget <= 0) problems.push('Enter a budget above $0.');
  if (!draft.date) problems.push('Choose a date.');

  // Your own dishes and drinks: let AI suggest amounts and prices when it is available
  const fillMenuWithAi = (state: AppState) => {
    aiFillMenuItems(state, stateHeadcount(state))
      .then((p) => {
        if (!p) return;
        update((cur) => applyPatches(cur, p));
        toast({ title: `${aiName() === 'Claude' ? 'Claude' : 'AI'} added amounts and prices`, detail: `${plural(Object.keys(p).length, 'item')} from your menu. Check them in Plan and Shop.`, tone: 'info' });
      })
      .catch(() => { /* items keep their estimates; prices can be added by hand */ });
  };

  // On the real site a plan is saved to a Google account, so signing in comes first
  const needsSignIn = cloud.available && !cloud.user;
  const [waitingForSignIn, setWaitingForSignIn] = useState(false);
  const signInThenGenerate = async () => {
    setWaitingForSignIn(true);
    if (!(await cloud.signIn())) setWaitingForSignIn(false);
  };
  // Generate once the account's parties are known, so the new one is saved straight to the account
  useEffect(() => {
    if (waitingForSignIn && cloud.user && cloud.metasLoaded) {
      setWaitingForSignIn(false);
      generate();
    }
  });

  const generate = () => {
    if (problems.length) return;
    const next = planFromDraft(s, draft, spend);
    replace(next);
    go('overview');
    fillMenuWithAi(next);
    toast({ title: 'Your plan is ready', detail: `${next.items.length} items and ${next.tasks.length} tasks, planned for ${draft.guestExpected} expected guests.`, tone: 'success' });
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[880px] items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Button variant="quiet" size="sm" onClick={() => go(s.started && !s.isDemo ? 'overview' : 'welcome')}>
          <ArrowLeft className="size-4" /> {s.started && !s.isDemo ? 'Back to my plan' : 'Back'}
        </Button>
      </div>

      <main className="mx-auto max-w-[880px] px-4 pb-24 sm:px-6">
        <ol className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Setup steps">
          {['Describe Your Event', 'Check the Details', 'Choose Your Spending', 'Get Your Plan'].map((label, i) => {
            const idx = step === 'describe' ? 0 : step === 'review' ? 1 : 2;
            return (
              <li key={label} aria-current={i === idx ? 'step' : undefined} className={cx('rounded-full px-3 py-1 font-semibold', i <= idx ? 'm2p-grad' : 'bg-paper text-muted border border-line')}>
                {i + 1}. {label}
              </li>
            );
          })}
        </ol>

        {s.started && !s.isDemo && (
          <p className="mb-6 text-[13px] text-muted">
            <b className="text-ink">{s.event.name}</b> stays saved in Your Events.{' '}
            <button type="button" className="font-semibold text-forest underline" onClick={() => go('overview')}>Go back to it</button>
          </p>
        )}

        {step === 'describe' && (
          <>
            <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">Tell Us About Your Event</h1>
            <p className="mt-1 text-muted">Write it the way you would text a friend.</p>
            <Card className="mt-6 p-5">
              <Segmented label="How to enter details" value={mode} onChange={setMode} options={[{ value: 'text', label: 'Describe it' }, { value: 'form', label: 'Fill a form' }]} />
              {mode === 'text' ? (
                <div className="mt-5 grid gap-3">
                  <span className="flex items-center gap-1"><label htmlFor="desc" className="text-sm font-semibold">Your event</label><InfoTip label="What to write">Mention the occasion, guest count, date, place, food and drinks, budget and who is helping. No need to list every item; you can add shopping items later.</InfoTip></span>
                  <textarea id="desc" data-tour="setup-describe" rows={6} value={text} onChange={(e) => setText(e.target.value)} className={cx(inputCls, 'py-3 leading-relaxed')} />
                  {aiNote && <Note tone="gold" icon={<Info className="size-4" />}>{aiNote}</Note>}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button data-tour="setup-continue" onClick={aiReady ? readWithClaude : readLocally} disabled={!text.trim() || aiBusy}>
                      {aiBusy ? <Loader2 className="size-4 animate-spin" /> : aiReady ? <Sparkles className="size-4" /> : <Wand2 className="size-4" />}
                      {aiBusy ? `${aiName() === 'Claude' ? 'Claude' : 'The AI'} is reading…` : 'Continue'}
                    </Button>
                    {aiReady && !aiBusy && (
                      <button type="button" onClick={readLocally} disabled={!text.trim()} className="self-center text-[13px] font-semibold text-muted underline underline-offset-2 hover:text-ink">
                        Skip AI and read it quickly
                      </button>
                    )}
                  </div>
                  {!aiReady && aiSignIn && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                      <Sparkles className="size-4 text-forest" aria-hidden="true" />
                      Want AI to read your description?
                      <button type="button" className="font-semibold text-forest underline" onClick={() => cloud.signIn()}>Sign in with Google</button>
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-5">
                  <DraftForm draft={draft} onChange={setDraft} />
                  <Button className="mt-5" onClick={fromForm}>Continue</Button>
                </div>
              )}
            </Card>
          </>
        )}

        {step === 'review' && (
          <>
            <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">Check the Details</h1>

            {(assumptions.length > 0 || found.length > 0) && <FilledIn found={found} items={assumptions} />}

            <Card className="mt-4 p-5">
              <DraftForm draft={draft} onChange={setDraft} />
            </Card>

            {problems.length > 0 && (
              <Note tone="coral" className="mt-4" icon={<Info className="size-4" />}>
                <ul className="grid gap-1">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </Note>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={() => { setStep('spend'); window.scrollTo({ top: 0 }); }} disabled={problems.length > 0}>
                Next: Choose Your Spending <ArrowRight className="size-5" />
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setStep('describe')}>Back</Button>
            </div>
          </>
        )}

        {step === 'spend' && (
          <SpendStep draft={draft} spend={spend} onChange={(c, t) => setSpend((p) => ({ ...p, [c]: t }))} onSet={setSpend}>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={needsSignIn ? signInThenGenerate : generate} disabled={problems.length > 0 || waitingForSignIn}>
                {waitingForSignIn ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />} {needsSignIn ? 'Sign In and Generate My Plan' : 'Generate My Plan'}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => { setStep('review'); window.scrollTo({ top: 0 }); }}>Back</Button>
            </div>
            {needsSignIn && <p className="mt-2 text-[13px] text-muted">Your plan is saved to your Google account, so it's there on any device and you can invite co-hosts.</p>}
          </SpendStep>
        )}
      </main>
    </div>
  );
}

/** Step 3: how nice each kind of thing should be, with what it costs for this party. */
function SpendStep({ draft, spend, onChange, onSet, children }: { draft: Draft; spend: Spend; onChange: (c: Category, level: number) => void; onSet: (sp: Spend) => void; children: ReactNode }) {
  const { s, toast } = useStore();
  const preview = useMemo(() => planFromDraft(s, draft), [s, draft]);
  const head = useMemo(() => stateHeadcount(preview), [preview]);
  const { total } = useSpendCosts(preview, head, spend);
  const left = draft.budget - total;
  return (
    <>
      <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">Choose Your Spending</h1>
      <p className="mt-1 text-muted">Save on some things and spend more on others. Slide toward $ for basic or $$$ for nicer.</p>
      <Card className="mt-6 p-5">
        <SpendLevels state={preview} head={head} value={spend} onChange={onChange} />
      </Card>
      <div className={cx('mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border px-4 py-3', left >= 0 ? 'border-line bg-paper' : 'border-danger/40 bg-danger-soft')} role="status">
        <span className="font-semibold text-ink">Estimated total for {plural(head.total, 'guest')}: {money(total, false)}</span>
        <span className={cx('text-[14px] font-semibold', left >= 0 ? 'text-ok' : 'text-danger')}>
          {left >= 0 ? `${money(left, false)} left of your ${money(draft.budget, false)} budget` : `${money(-left, false)} over your ${money(draft.budget, false)} budget`}
        </span>
        {left < 0 && (
          <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={() => {
            const r = fitToBudget(preview, head, spend, draft.budget);
            onSet(r.spend);
            toast(r.fits
              ? { title: 'Levels lowered to fit your budget', detail: `Estimated total ${money(r.total, false)} of ${money(draft.budget, false)}.`, tone: 'success' }
              : { title: 'Still over budget at the basic level', detail: `The lowest estimate is ${money(r.total, false)}. Try fewer guests, a bigger budget, or skip optional items later on the Budget page.`, tone: 'warn' });
          }}>Fit My Budget</Button>
        )}
      </div>
      <p className="mt-2 text-[13px] text-muted">You can change these anytime on the Budget page, or for a single item in Plan and Shop.</p>
      {children}
    </>
  );
}

export function DraftForm({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const [kidsOpen, setKidsOpen] = useState(false);
  const num = (v: string) => (v === '' ? 0 : Math.max(0, Number(v)));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <Field label="Event name" htmlFor="d-name" info="Give your party a name, like “Maya’s Graduation Party.” Mood2Party uses it to understand the kind of party and its style.">
        <input id="d-name" className={inputCls} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Maya's Graduation Party" />
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 [&>*]:min-w-0">
        <Field label="Date" htmlFor="d-date" className="col-span-2"><input id="d-date" type="date" className={inputCls} value={draft.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Start time" htmlFor="d-time"><input id="d-time" type="time" className={inputCls} value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
        <Field label="Hours" htmlFor="d-dur"><input id="d-dur" type="number" min={1} max={24} className={inputCls} value={draft.durationHrs || ''} onChange={(e) => set('durationHrs', num(e.target.value))} /></Field>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label="Guests" htmlFor="d-exp" info="Your best guess. You can change it anytime on Guests and RSVPs, and it updates as people reply." hint={kidsOpen || draft.children > 0
          ? <span className="flex items-center gap-2"><label htmlFor="d-kids">Kids (included above)</label><input id="d-kids" type="number" min={0} className={cx(inputBase, 'min-h-9 w-20')} value={draft.children} onChange={(e) => set('children', Math.round(num(e.target.value)))} /></span>
          : <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => setKidsOpen(true)}>Any kids coming?</button>}>
          <input id="d-exp" type="number" min={0} className={inputCls} value={draft.guestExpected || ''} onChange={(e) => { const n = num(e.target.value); onChange({ ...draft, guestExpected: n, guestMin: Math.round(n * 0.8), guestMax: Math.round(n * 1.2) }); }} />
        </Field>
        <Field label="Budget ($)" htmlFor="d-budget"><input id="d-budget" type="number" min={0} step={50} className={inputCls} value={draft.budget || ''} onChange={(e) => set('budget', num(e.target.value))} /></Field>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Field label="Location" htmlFor="d-venue"><input id="d-venue" className={inputCls} value={draft.venue} onChange={(e) => set('venue', e.target.value)} placeholder="My house" /></Field>
        <SettingToggle id="d-setting" value={draft.setting} onChange={(v) => set('setting', v)} />
      </div>

      <MenuFields
        idPrefix="d"
        food={draft.foodText}
        drinks={draft.drinksText}
        onFood={(v) => { const m = parseMenu(v, draft.drinksText); onChange({ ...draft, foodText: v, foodFormat: m.foodFormat, extraFood: m.extraFood }); }}
        onDrinks={(v) => { const m = parseMenu(draft.foodText, v); onChange({ ...draft, drinksText: v, alcohol: m.alcohol, softDrinks: m.softDrinks }); }}
      />

      <HelperChips id="d-helpers" names={draft.helpers.map((h) => h.trim()).filter(Boolean)} onChange={(h) => set('helpers', h)} info="The people helping you plan and buy, not every guest. Add one name at a time; you're already included as the host." />

      <details className="group rounded-2xl border border-dashed border-line-strong">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-forest">
          More details (optional): theme, dietary needs, anything else
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
          <Field label="Theme or colors" htmlFor="d-theme"><input id="d-theme" className={inputCls} value={draft.theme} onChange={(e) => set('theme', e.target.value)} /></Field>
          <Field label="Dietary needs" htmlFor="d-diet"><input id="d-diet" className={inputCls} value={draft.dietary} onChange={(e) => set('dietary', e.target.value)} placeholder="Vegetarian, nut allergy" /></Field>
          <Field label="Anything else to remember" htmlFor="d-prefs" info="Preferences, must-haves or things to avoid. Shown on your Overview." className="sm:col-span-2">
            <textarea id="d-prefs" rows={2} className={cx(inputCls, 'py-2.5')} value={draft.preferences} onChange={(e) => set('preferences', e.target.value)} placeholder="Grandma needs a seat in the shade; no glitter" />
          </Field>
        </div>
      </details>
    </div>
  );
}

/** What was picked up from the description, and what AI or the defaults filled in. Can be folded away. */
function FilledIn({ found, items }: { found: string[]; items: string[] }) {
  const [open, setOpen] = useState(true);
  const title = items.length ? `We Filled In ${plural(items.length, 'Thing', 'Things')} for You` : "Here's What We Picked Up";
  return (
    <section aria-labelledby="filled-in-title" className="mt-4 overflow-hidden rounded-2xl border border-forest/30 bg-sage-soft/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="filled-in-list"
        className="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-sage-soft"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-paper text-forest" aria-hidden="true"><Sparkles className="size-4" /></span>
        <span id="filled-in-title" className="min-w-0 flex-1 font-semibold text-ink">{title}</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-forest">
          {open ? 'Hide' : 'Show'}
          <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div id="filled-in-list" className="grid gap-3 border-t border-forest/20 px-4 pb-4 pt-3">
          {found.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-muted">From your description</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {found.map((f) => (
                  <li key={f} className="rounded-full border border-forest/20 bg-paper px-2.5 py-1 text-[13px] text-ink">{f}</li>
                ))}
              </ul>
            </div>
          )}
          {items.length > 0 && (
            <div>
              {found.length > 0 && <p className="text-[13px] font-semibold text-muted">We guessed or suggested</p>}
              <ul className="mt-1.5 grid gap-1.5 text-[14px] text-ink">
                {items.map((a) => (
                  <li key={a} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" /><span>{a}</span></li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[13px] text-muted">Change anything below that isn't right.</p>
        </div>
      )}
    </section>
  );
}
