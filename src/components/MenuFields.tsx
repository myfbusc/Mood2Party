import { Plus, Sparkles } from 'lucide-react';
import { DRINK_SUGGESTIONS, FOOD_SUGGESTIONS, parseMenu, splitList } from '../lib/menuText';
import { Field, InfoTip, inputCls } from './ui';

/** Food and drinks in your own words, with tap-to-add suggestions. */
export function MenuFields({ idPrefix, food, drinks, onFood, onDrinks, aiNote }: {
  idPrefix: string; food: string; drinks: string; onFood: (v: string) => void; onDrinks: (v: string) => void; aiNote?: boolean;
}) {
  const add = (text: string, word: string, set: (v: string) => void) => {
    const has = splitList(text).some((x) => x.toLowerCase() === word.toLowerCase());
    if (has) return;
    const w = /^[A-Z]+$/.test(word) ? word : word.toLowerCase();
    set(text.trim() ? `${text.trim().replace(/,\s*$/, '')}, ${w}` : word);
  };
  const chips = (text: string, words: string[], set: (v: string) => void, label: string) => (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={label}>
      {words.filter((w) => !splitList(text).some((x) => x.toLowerCase() === w.toLowerCase())).map((w) => (
        <li key={w}>
          <button type="button" onClick={() => add(text, w, set)} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line bg-paper px-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-forest/60 hover:bg-sage-soft hover:text-forest">
            <Plus className="size-3.5" aria-hidden="true" /> {w}
          </button>
        </li>
      ))}
    </ul>
  );
  const custom = parseMenu(food, drinks).custom;
  return (
    <>
      <Field label="Food" htmlFor={`${idPrefix}-food`} info="Type what you'll serve, separated by commas. Known styles like taco bar or BBQ use built-in amounts; anything else becomes its own shopping item and task.">
        <input id={`${idPrefix}-food`} className={inputCls} value={food} onChange={(e) => onFood(e.target.value)} placeholder="Taco bar, pupusas, cupcakes" />
        {chips(food, FOOD_SUGGESTIONS, onFood, 'Food suggestions')}
      </Field>
      <Field label="Drinks" htmlFor={`${idPrefix}-drinks`}>
        <input id={`${idPrefix}-drinks`} className={inputCls} value={drinks} onChange={(e) => onDrinks(e.target.value)} placeholder="Water, lemonade, beer" />
        {chips(drinks, DRINK_SUGGESTIONS, onDrinks, 'Drink suggestions')}
      </Field>
      {custom.length > 0 && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted">
          <Sparkles className="size-4 shrink-0 text-forest" aria-hidden="true" /> New on your list: <b className="text-ink">{custom.map((c) => c.label).join(', ')}</b>
          <InfoTip label="About new items">{aiNote ? 'AI will suggest amounts and prices. You can change them anytime in Plan and Shop.' : 'Amounts are estimated. Add prices in Plan and Shop.'}</InfoTip>
        </p>
      )}
    </>
  );
}
