import { CheckCircle2, MessageCircle, RefreshCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useStore } from '../lib/store';
import { learningsFromWrapUp, weightsFromLearnings } from '../lib/actions';
import { blankState } from '../lib/demo';
import { plural } from '../lib/format';
import { Button, Card, Field, InfoTip, Note, PageHeader, SectionHead, cx, inputBase, inputCls } from '../components/ui';
import type { Outcome, WrapUp as W } from '../lib/types';

const OUTCOMES: { v: Outcome; label: string }[] = [
  { v: 'ran-out', label: 'Ran out' },
  { v: 'right', label: 'About right' },
  { v: 'leftover', label: 'Lots left' },
];

export default function WrapUp() {
  const { s, att, head, plan, update, replace, go, toast } = useStore();
  const w = s.wrapUp;
  const setW = (patch: Partial<W>) => update((p) => ({ ...p, wrapUp: { ...p.wrapUp, ...patch } }));
  const consumables = plan.active.filter((l) => (l.item.category === 'food' || l.item.category === 'tableware') && l.item.rule.kind !== 'fixed' && l.item.source === 'plan');
  const answered = Object.keys(w.outcomes).length;

  const save = () => {
    const learnings = learningsFromWrapUp(s);
    update((p) => ({ ...p, learnings, wrapUp: { ...p.wrapUp, saved: true } }));
    toast({ title: 'Saved for next time', detail: 'Your next plan will start from what happened at this event.', tone: 'success' });
  };

  const nextPlanChanges = Object.entries(s.learnings.itemFactors)
    .filter(([, f]) => f !== 1)
    .map(([id, f]) => {
      const name = s.items.find((x) => x.id === id)?.name ?? id;
      return `${name}: ${f > 1 ? `${Math.round((f - 1) * 100)}% more` : `${Math.round((1 - f) * 100)}% less`}`;
    });
  const nextWeights = weightsFromLearnings(s.learnings);

  return (
    <>
      <PageHeader title="After the Event" sub={<span className="inline-flex items-center gap-1">Helps your next plan <InfoTip label="Why fill this in">Tell us how many came and which amounts ran out or were left over. Your next plan starts from what actually happened.</InfoTip></span>} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <div data-tour="wrapup">
          <Card className="p-5">
            <h2 className="font-display text-xl font-semibold">How Many People Came?</h2>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <Field label="Actual attendance" htmlFor="actual">
                <input id="actual" type="number" min={0} className={cx(inputBase, 'w-36')} value={w.actualAttendance ?? ''} placeholder={String(att.expected.total)} onChange={(e) => setW({ actualAttendance: e.target.value === '' ? null : Math.max(0, Number(e.target.value)), saved: false })} />
              </Field>
              <p className="pb-2 text-sm text-muted">
                You expected {att.expected.total} and planned for {head.total}.
                {w.actualAttendance !== null && (
                  <> Turnout was <b className="text-ink">{Math.round((w.actualAttendance / Math.max(1, att.expected.total)) * 100)}%</b> of expected.</>
                )}
              </p>
            </div>
          </Card>
          </div>

          <section aria-labelledby="amounts">
            <SectionHead id="amounts" title="How Did the Amounts Work Out?" count={consumables.length} />
            <Card>
              <ul className="divide-y divide-line">
                {consumables.map((l) => (
                  <li key={l.item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{l.item.name}</p>
                      <p className="tnum text-[13px] text-muted">Planned {l.need} {l.item.unit}</p>
                    </div>
                    <div role="radiogroup" aria-label={`How did ${l.item.name} work out?`} className="flex gap-1">
                      {OUTCOMES.map((o) => {
                        const on = w.outcomes[l.item.id] === o.v;
                        return (
                          <button
                            key={o.v}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setW({ outcomes: { ...w.outcomes, [l.item.id]: o.v }, saved: false })}
                            className={cx(
                              'min-h-10 rounded-lg border px-3 text-[13px] font-semibold',
                              on ? (o.v === 'right' ? 'border-transparent m2p-grad' : 'border-coral bg-coral text-on-coral') : 'border-line bg-paper text-muted hover:text-ink',
                            )}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <Card className="p-5">
            <Field label="Anything to remember for next time?" htmlFor="wrap-notes">
              <textarea id="wrap-notes" rows={3} className={cx(inputCls, 'py-2')} value={w.notes} placeholder="For example, the taco line was slow; set up two serving stations." onChange={(e) => setW({ notes: e.target.value, saved: false })} />
            </Field>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={w.actualAttendance === null && answered === 0}>Save What We Learned</Button>
              <span className="text-sm text-muted">{plural(answered, 'item')} rated</span>
            </div>
          </Card>
        </div>

        <aside className="grid content-start gap-6">
          <Card className="p-5">
            <h2 className="font-display text-xl font-semibold">Next Time</h2>
            {s.learnings.history.length === 0 && nextPlanChanges.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Save your results to see what changes.</p>
            ) : (
              <ul className="mt-3 grid gap-2 text-[15px]">
                {s.learnings.turnoutRatio !== null && (
                  <li>Expect {Math.round(nextWeights.maybe * 100)}% of guests who are not sure yet to come, based on turnout of {Math.round(s.learnings.turnoutRatio * 100)}% of expected.</li>
                )}
                {nextPlanChanges.map((c) => <li key={c}>Plan {c}</li>)}
              </ul>
            )}
            {w.saved && (
              <>
                <Note tone="green" className="mt-4" icon={<CheckCircle2 className="size-4" />}>Saved. These adjustments apply to your next event.</Note>
                <Button variant="secondary" className="mt-4 w-full" onClick={() => { replace(blankState(s.learnings)); go('setup'); }}>
                  <RefreshCcw className="size-4" /> Plan Another Event
                </Button>
              </>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-start gap-2 font-bold"><MessageCircle className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />Did the attendance range help you decide how many people to plan for?</h2>
            <div className="mt-3 flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)} type="button" aria-pressed={w.feedbackHelped === v}
                  onClick={() => setW({ feedbackHelped: v })}
                  className={cx('flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold', w.feedbackHelped === v ? 'border-transparent m2p-grad' : 'border-line bg-paper text-ink hover:bg-cream')}
                >
                  {v ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />} {v ? 'Yes' : 'Not really'}
                </button>
              ))}
            </div>
            {w.feedbackHelped !== null && (
              <div className="mt-3">
                <label htmlFor="fb" className="text-sm font-semibold">What would have made it clearer? (optional)</label>
                <textarea id="fb" rows={3} className={cx(inputCls, 'mt-1.5 py-2')} value={w.feedbackComment} onChange={(e) => setW({ feedbackComment: e.target.value })} />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
