import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { helperListProblem } from '../lib/actions';
import { extractNames } from '../lib/parse';
import { Button, InfoTip, cx, inputBase } from './ui';
import type { ReactNode } from 'react';

/** Helper names as removable chips, added one at a time with the same checks as the Tasks page. */
export function HelperChips({ id, names, onChange, label = 'Organizers', hint, info: infoTip }: { id: string; names: string[]; onChange: (next: string[]) => void; label?: string; hint?: string; info?: ReactNode }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const add = () => {
    // "Me and my boyfriend Lucas" becomes Lucas: one chip per person, and the host is already "You"
    const { names: found, skippedSelf } = extractNames(name);
    if (!found.length) {
      setError(skippedSelf ? 'You are already included as the host. Add the other people helping you organize.' : 'Enter a name first.');
      return;
    }
    let list = [...names];
    const added: string[] = [];
    for (const n of found) {
      const problem = helperListProblem(list, n);
      if (problem) {
        if (found.length === 1) { setError(problem); return; }
        continue;
      }
      list = [...list, n.replace(/\s+/g, ' ')];
      added.push(n);
    }
    if (!added.length) { setError('Those people are already on the list.'); return; }
    onChange(list);
    setName('');
    setError('');
    const reworded = added.length > 1 || skippedSelf || added[0] !== name.trim();
    setInfo(reworded ? `Added ${added.join(', ')}.${skippedSelf ? ' You are already included as the host.' : ''}` : '');
  };
  return (
    <div className="grid gap-1.5">
      <span className="flex h-5 items-center gap-1"><label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>{infoTip && <InfoTip label={`About ${label.toLowerCase()}`}>{infoTip}</InfoTip>}</span>
      {names.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Organizers added">
          {names.map((n) => (
            <li key={n} className="inline-flex items-center gap-1 rounded-full border border-line bg-sage-soft py-1 pl-3 pr-1 text-[14px] font-semibold text-forest">
              {n}
              <button type="button" onClick={() => onChange(names.filter((x) => x !== n))} aria-label={`Remove ${n}`} className="grid size-7 place-items-center rounded-full hover:bg-paper">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          className={cx(inputBase, 'min-w-0 flex-1', error && 'border-danger')}
          value={name}
          maxLength={60}
          placeholder={names.length ? 'Add another name' : 'For example, Sam'}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(e) => { setName(e.target.value); if (error) setError(''); if (info) setInfo(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button variant="secondary" onClick={add}><Plus className="size-4" /> Add</Button>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[13px] font-semibold text-danger">{error}</p>
      ) : info ? (
        <p role="status" className="text-[13px] font-semibold text-ok">{info}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p>
      )}
    </div>
  );
}
