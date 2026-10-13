import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, ChevronDown, Info, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { extractNames, parseDescription, SAMPLE_DESCRIPTION, emptyDraft, type Draft } from '../lib/parse';
import { planFromDraft } from '../lib/actions';
import { FOOD_FORMAT_LABEL } from '../lib/catalog';
import { aiErrorCopy, aiName, aiNeedsSignIn, getSample } from '../lib/ai';
import { Logo } from '../components/Shell';
import { HelperChips } from '../components/HelperChips';
import { MenuFields } from '../components/MenuFields';
import { aiFillMenuItems, applyPatches } from '../lib/menuAi';
import { stateHeadcount } from '../lib/attendance';
import { plural } from '../lib/format';
import type { AppState } from '../lib/types';
import { parseMenu } from '../lib/menuText';
import { Button, Card, Field, InfoTip, Note, Segmented, SettingToggle, cx, inputBase, inputCls } from '../components/ui';
import type { Alcohol, FoodFormat, SoftDrink } from '../lib/types';

type Step = 'describe' | 'review';

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
      const out = await sample.json<Partial<Draft> & { assumptions?: string[] }>(
        `You help a DIY host set up an event plan. Read their description closely and pull out everything you can, including what is implied.
Today is ${new Date().toISOString().slice(0, 10)}.
Rules:
- Work out the occasion from any hint: holidays (Halloween, Friendsgiving, New Year's Eve, Diwali...), life events (birthdays with the age, graduations, showers, retirements, going-away...), and themed parties ("ugly sweater party", "murder mystery dinner"). Never answer "general party" or "Party" if the text names or hints at any occasion.
- If someone is being celebrated, note who ("Maya's graduation", "for my son Leo" gives Leo).
- name: suggest a short, clear event name the host would use, in Title Case, built from who it is for and the occasion, e.g. "Leo's 7th Birthday Party", "Halloween Costume Party", "Ana's Surprise 40th". Not a sentence.
- If no date is given but the occasion has a usual date (Halloween Oct 31, New Year's Eve Dec 31, Fourth of July, Thanksgiving...), use the next one: the day itself if it is a Friday or Saturday or the party must be on the day, otherwise the Saturday before. Otherwise use ${base.draft.date}.
- If no time is given, pick a sensible start for the occasion (brunch 11:00, kids' party 14:00, dinner 18:30, Halloween 19:00, New Year's Eve 20:00).
- If no theme is given, suggest one that fits the occasion.
- If only kids are counted ("15 kids and their parents"), estimate the total guests including adults.
Reply with only a JSON object with these keys:
name, type (the occasion in a few words, e.g. "Halloween party", "7th birthday party"), honoree (who it is for, or ""), date (YYYY-MM-DD, a future date), startTime (HH:MM 24h), durationHrs (number),
venue, setting ("indoors" or "outdoors"), foodFormat (one of "buffet","taco-bar","bbq","appetizers","potluck"),
dietary, theme, budget (number, USD), guestMin, guestExpected, guestMax (numbers), children (number of kids expected, 0 if none),
helpers (array of the organizing team's first names only, never the host; e.g. "me and my boyfriend Lucas" gives ["Lucas"]; use "Helper 1" etc. if only a count is given),
extraFood (array of other food styles also served, from "buffet","taco-bar","bbq","appetizers","potluck", not repeating foodFormat),
alcohol (one of "none","beer-wine","full-bar","byob"), softDrinks (array from "soda","water","juice","coffee-tea"),
preferences (short comma-separated list of activities and wishes, e.g. "costume contest, pumpkin carving, music"; "" if none),
foodText (every food mentioned, as a short comma-separated list in plain words, e.g. "taco bar, pupusas, cupcakes"; "" if none),
drinksText (every drink mentioned, comma-separated, e.g. "water, lemonade, beer"; "" if none),
found (array of short "Label: value" notes for what the description actually said, e.g. "Occasion: Halloween party", "For: Leo", "Guests: about 30", "Extras: costume contest"),
assumptions (array of short plain-language sentences for each thing you had to guess or suggest, including the suggested name, date, time and theme when they were not stated).

Description:
"""${text.slice(0, 4000)}"""`,
        { modelTier: 'quick' },
      );
      const d: Draft = { ...base.draft };
      const said = (v: unknown) => typeof v === 'string' && v.trim() && !/^(?:general )?party$/i.test(v.trim());
      const num = (v: unknown, fb: number) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : fb);
      const str = (v: unknown, fb: string) => (typeof v === 'string' && v.trim() ? v.trim() : fb);
      if (said(out.name)) d.name = String(out.name).trim().slice(0, 80);
      if (said(out.type)) d.type = String(out.type).trim().slice(0, 60);
      d.date = /^\d{4}-\d{2}-\d{2}$/.test(String(out.date)) && String(out.date) >= new Date().toISOString().slice(0, 10) ? String(out.date) : d.date;
      d.startTime = /^\d{2}:\d{2}$/.test(String(out.startTime)) ? String(out.startTime) : d.startTime;
      d.durationHrs = num(out.durationHrs, d.durationHrs) || d.durationHrs;
      d.venue = str(out.venue, d.venue);
      d.setting = out.setting === 'outdoors' || out.setting === 'indoors' ? out.setting : d.setting;
      d.foodFormat = (Object.keys(FOOD_FORMAT_LABEL) as FoodFormat[]).includes(out.foodFormat as FoodFormat) ? (out.foodFormat as FoodFormat) : d.foodFormat;
      d.dietary = str(out.dietary, d.dietary);
      d.theme = str(out.theme, d.theme);
      d.budget = num(out.budget, d.budget) || d.budget;
      d.guestMin = Math.round(num(out.guestMin, d.guestMin));
      d.guestExpected = Math.round(num(out.guestExpected, d.guestExpected));
      d.guestMax = Math.round(num(out.guestMax, d.guestMax));
      d.children = Math.round(num((out as { children?: unknown }).children, d.children));
      if (Array.isArray(out.helpers)) d.helpers = [...new Set(out.helpers.flatMap((h) => extractNames(String(h)).names))].slice(0, 10);
      const FOODS = Object.keys(FOOD_FORMAT_LABEL) as FoodFormat[];
      if (Array.isArray(out.extraFood)) d.extraFood = out.extraFood.filter((f): f is FoodFormat => FOODS.includes(f as FoodFormat) && f !== d.foodFormat);
      if (['none', 'beer-wine', 'full-bar', 'byob'].includes(String(out.alcohol))) d.alcohol = out.alcohol as Alcohol;
      if (Array.isArray(out.softDrinks)) d.softDrinks = out.softDrinks.filter((x): x is SoftDrink => ['soda', 'water', 'juice', 'coffee-tea'].includes(String(x)));
      d.preferences = str(out.preferences, d.preferences);
      if (typeof out.foodText === 'string') d.foodText = out.foodText.trim().slice(0, 300);
      if (typeof out.drinksText === 'string') d.drinksText = out.drinksText.trim().slice(0, 300);
      { const m = parseMenu(d.foodText, d.drinksText); if (d.foodText) { d.foodFormat = m.foodFormat; d.extraFood = m.extraFood; } if (d.drinksText) { d.alcohol = m.alcohol; d.softDrinks = m.softDrinks; } }
      setDraft(d);
      // Only show Claude's own notes. The built-in reader's notes can contradict what Claude found (e.g. "no date").
      const aiNotes = Array.isArray(out.assumptions) ? out.assumptions.map(String).filter(Boolean).slice(0, 8) : [];
      const dateFromClaude = /^\d{4}-\d{2}-\d{2}$/.test(String(out.date)) && String(out.date) >= new Date().toISOString().slice(0, 10);
      if (!dateFromClaude && !aiNotes.some((n) => /date/i.test(n))) aiNotes.push(base.assumptions.find((n) => /date/i.test(n)) ?? 'No date was found, so a placeholder date is used.');
      setAssumptions(aiNotes.length ? aiNotes : [`${aiName() === 'Claude' ? 'Claude' : 'The AI'} read your description. Check the details below.`]);
      const aiFound = Array.isArray((out as { found?: unknown }).found) ? ((out as { found: unknown[] }).found).map(String).filter(Boolean).slice(0, 12) : [];
      setFound(aiFound);
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
    const next = planFromDraft(s, draft);
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
          {['Describe Your Event', 'Check the Details', 'Get Your Plan'].map((label, i) => {
            const idx = step === 'describe' ? 0 : 1;
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
              <Button size="lg" onClick={needsSignIn ? signInThenGenerate : generate} disabled={problems.length > 0 || waitingForSignIn}>
                {waitingForSignIn ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />} {needsSignIn ? 'Sign In and Generate My Plan' : 'Generate My Plan'}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setStep('describe')}>Back</Button>
            </div>
            {needsSignIn && <p className="mt-2 text-[13px] text-muted">Your plan is saved to your Google account, so it's there on any device and you can invite co-hosts.</p>}
          </>
        )}
      </main>
    </div>
  );
}

export function DraftForm({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const [kidsOpen, setKidsOpen] = useState(false);
  const num = (v: string) => (v === '' ? 0 : Math.max(0, Number(v)));
  return (
    <div className="grid gap-4">
      <Field label="Event name" htmlFor="d-name" info="Give your party a name, like “Maya’s Graduation Party.” Mood2Party uses it to understand the kind of party and its style.">
        <input id="d-name" className={inputCls} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Maya's Graduation Party" />
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Date" htmlFor="d-date" className="col-span-2"><input id="d-date" type="date" className={inputCls} value={draft.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Start time" htmlFor="d-time"><input id="d-time" type="time" className={inputCls} value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
        <Field label="Hours" htmlFor="d-dur"><input id="d-dur" type="number" min={1} max={24} className={inputCls} value={draft.durationHrs || ''} onChange={(e) => set('durationHrs', num(e.target.value))} /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guests" htmlFor="d-exp" info="Your best guess. You can change it anytime on Guests and RSVPs, and it updates as people reply." hint={kidsOpen || draft.children > 0
          ? <span className="flex items-center gap-2"><label htmlFor="d-kids">Kids (included above)</label><input id="d-kids" type="number" min={0} className={cx(inputBase, 'min-h-9 w-20')} value={draft.children} onChange={(e) => set('children', Math.round(num(e.target.value)))} /></span>
          : <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => setKidsOpen(true)}>Any kids coming?</button>}>
          <input id="d-exp" type="number" min={0} className={inputCls} value={draft.guestExpected || ''} onChange={(e) => { const n = num(e.target.value); onChange({ ...draft, guestExpected: n, guestMin: Math.round(n * 0.8), guestMax: Math.round(n * 1.2) }); }} />
        </Field>
        <Field label="Budget ($)" htmlFor="d-budget"><input id="d-budget" type="number" min={0} step={50} className={inputCls} value={draft.budget || ''} onChange={(e) => set('budget', num(e.target.value))} /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
