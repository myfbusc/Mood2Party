import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check, CircleHelp, Sparkles, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet' | 'coral';
export function Button({
  variant = 'primary', size = 'md', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<BtnVariant, string> = {
    primary: 'm2p-grad border border-transparent hover:brightness-110',
    secondary: 'bg-paper text-forest border border-forest/70 hover:bg-sage-soft',
    ghost: 'bg-transparent text-ink border border-line-strong hover:bg-chip hover:border-forest/40',
    quiet: 'bg-transparent text-forest border border-transparent hover:bg-sage-soft',
    danger: 'bg-paper text-danger border border-danger/40 hover:bg-danger-soft',
    coral: 'bg-coral text-on-coral border border-coral hover:brightness-95',
  };
  const sz = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-11 px-4 text-[15px]', lg: 'min-h-12 px-6 text-base' }[size];
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold tracking-[0.01em] transition duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        v[variant], sz, className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article'; id?: string; 'aria-label'?: string; 'aria-labelledby'?: string }) {
  return (
    <As className={cx('rounded-3xl border border-line bg-paper', className)} {...rest}>
      {children}
    </As>
  );
}

export type Tone = 'green' | 'coral' | 'gold' | 'gray' | 'sage' | 'red';
export function Pill({ children, tone = 'gray', className, icon }: { children: ReactNode; tone?: Tone; className?: string; icon?: ReactNode }) {
  const t: Record<Tone, string> = {
    green: 'bg-ok-soft text-ok',
    coral: 'bg-coral-soft text-coral',
    gold: 'bg-gold-soft text-gold',
    gray: 'bg-chip text-muted',
    sage: 'bg-sage-soft text-forest',
    red: 'bg-danger-soft text-danger',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', t[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Progress bar. "candy" (default) is for things getting done; budget bars pass "forest" (within budget) or "coral" (over). */
export function Progress({ value, max, tone = 'candy', label }: { value: number; max: number; tone?: 'candy' | 'forest' | 'coral' | 'gold'; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const c = { candy: 'm2p-candy', forest: 'bg-coral-bright', coral: 'bg-danger', gold: 'bg-gold-bright' }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className="h-3 w-full overflow-hidden rounded-full bg-line">
      <div className={cx('h-full rounded-full transition-[width] duration-300', c)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'coral' | 'green' | 'red'; children?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-3xl border border-line bg-paper p-4">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={cx('tnum mt-1 text-2xl font-bold tracking-tight', tone === 'coral' ? 'text-coral' : tone === 'red' ? 'text-danger' : tone === 'green' ? 'text-ok' : 'text-ink')}>{value}</p>
      {sub && <div className="mt-1 text-[13px] text-muted">{sub}</div>}
      {children}
    </div>
  );
}

export function Field({ label, hint, info, children, htmlFor, className }: { label: string; hint?: ReactNode; info?: ReactNode; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    // min-w-0 and a shrinkable column: date and time boxes otherwise refuse to shrink on phones and push the page sideways
    <div className={cx('grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-1.5', className)}>
      <span className="flex h-5 min-w-0 items-center gap-1">
        <label htmlFor={htmlFor} className="min-w-0 truncate text-sm font-semibold text-ink" title={label}>{label}</label>
        {info && <InfoTip label={`About ${label.toLowerCase()}`}>{info}</InfoTip>}
      </span>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/** Pick any number of options as chips (multi-select). */
export function ToggleChips<T extends string>({ label, options, value, onChange, id }: { label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; id?: string }) {
  return (
    <div role="group" aria-label={label} id={id} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cx('inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold transition-colors', on ? 'border-forest bg-sage-soft text-forest' : 'border-line-strong bg-paper text-muted hover:border-forest/50 hover:bg-sage-soft/50 hover:text-ink')}
          >
            <span className={cx('grid size-4 place-items-center rounded-full border', on ? 'm2p-grad border-transparent' : 'border-line-strong')} aria-hidden="true">{on && <Check className="size-3" strokeWidth={3} />}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The single "optional" setting for a shopping item (everything else is essential). */
export function OptionalToggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label htmlFor={id} className={cx('flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm', checked ? 'border-forest/40 bg-sage-soft' : 'border-line bg-paper')}>
      <input id={id} type="checkbox" className="size-5 shrink-0 accent-forest" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><b>Optional.</b> Nice to have; suggested first if you need to cut costs. Leave unticked for must-buys.</span>
    </label>
  );
}

/**
 * Number box that can be emptied while typing (no stuck "0"). The saved value only changes when the box holds a number;
 * leaving it empty puts back the minimum. Focusing selects the current number so typing replaces it.
 */
export function NumberInput({ value, onValue, min = 0, max, onFocus, onBlur, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & { value: number; onValue: (n: number) => void; min?: number; max?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n));
  return (
    <input
      {...rest}
      type="number"
      inputMode={rest.inputMode ?? 'numeric'}
      min={min}
      max={max}
      value={draft ?? String(value)}
      onFocus={(e) => { e.currentTarget.select(); onFocus?.(e); }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() !== '' && Number.isFinite(Number(raw))) onValue(clamp(Number(raw)));
      }}
      onBlur={(e) => {
        if (draft !== null && (draft.trim() === '' || !Number.isFinite(Number(draft)))) onValue(clamp(min));
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}

export const inputBase =
  'm2p-field min-h-11 min-w-0 rounded-xl border border-line-strong bg-paper px-3 text-[15px] text-ink placeholder:text-placeholder focus:border-forest';
export const inputCls = `${inputBase} w-full`;

export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-chip p-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'shrink-0 whitespace-nowrap rounded-lg px-3 font-semibold transition-colors duration-150',
            size === 'sm' ? 'min-h-8 text-[13px]' : 'min-h-10 text-sm',
            value === o.value ? 'bg-paper text-forest shadow-sm' : 'text-muted hover:bg-paper/60 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children, footer, wide }: { title: string; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end md:items-stretch">
      <div className="m2p-fade absolute inset-0 bg-shade/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'm2p-drawer relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-cream shadow-2xl outline-none md:max-h-none md:rounded-none md:rounded-l-3xl',
          wide ? 'md:w-[640px]' : 'md:w-[520px]',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line bg-paper px-5 py-4 md:rounded-tl-3xl rounded-t-3xl md:rounded-tr-none">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-cream">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap gap-2 border-t border-line bg-paper px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function SectionHead({ title, children, id, count }: { title: ReactNode; children?: ReactNode; id?: string; count?: number }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <h2 id={id} className="font-display text-xl font-semibold text-ink">
        {title}
        {count !== undefined && <span className="tnum ml-2 text-sm font-semibold text-muted">{count}</span>}
      </h2>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[30px] font-semibold leading-tight md:text-[34px]"><span className="m2p-grad-text">{title}</span></h1>
        {sub && <div className="mt-1 text-[15px] text-muted">{sub}</div>}
      </div>
      {children && <div className="flex w-full flex-wrap gap-2 sm:w-auto max-sm:[&>*]:flex-1">{children}</div>}
    </header>
  );
}

export function Note({ tone = 'sage', icon, children, className }: { tone?: 'sage' | 'coral' | 'gold' | 'green'; icon?: ReactNode; children: ReactNode; className?: string }) {
  const t = {
    sage: 'bg-sage-soft border-sage/60 text-forest',
    coral: 'bg-coral-soft border-coral-bright/40 text-attn-ink',
    gold: 'bg-gold-soft border-gold-bright/50 text-warn-ink',
    green: 'bg-ok-soft border-sage text-ok',
  }[tone];
  return (
    <div className={cx('flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm', t, className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** A small "?" button that shows a short explanation, so pages can stay light on text. */
export function InfoTip({ label, children, align = 'left' }: { label: string; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  // Keep the bubble on screen: slide it left or right if it would cross the edge
  useLayoutEffect(() => {
    if (!open) { setShift(0); return; }
    const r = tipRef.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 12;
    if (r.right > window.innerWidth - gap) setShift((x) => x - (r.right - (window.innerWidth - gap)));
    else if (r.left < gap) setShift((x) => x + (gap - r.left));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cx("relative grid size-7 place-items-center rounded-full transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-sage-soft hover:text-forest", open ? 'bg-sage-soft text-forest' : 'text-muted')}
      >
        <CircleHelp className="size-[18px]" aria-hidden="true" />
      </button>
      {open && (
        <span
          ref={tipRef}
          id={id}
          style={{ transform: `translateX(${shift}px)` }}
          role="note"
          className={cx(
            'absolute top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-line bg-paper p-3.5 font-sans text-[14px] font-normal leading-snug text-ink shadow-lg',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}

/** Soft gradient glow at the top and bottom of the screen. Fixed while scrolling; in the app it starts after the sidebar. */
export function PageGlow({ besideSidebar }: { besideSidebar: boolean }) {
  const side = cx('inset-x-0', besideSidebar && 'lg:left-[272px]');
  return (
    <>
      <div aria-hidden="true" className={cx('m2p-glow-top', side)} />
      <div aria-hidden="true" className={cx('m2p-glow-bottom', side)} />
    </>
  );
}

/** Celebration banner shown when a list is finished. */
export function PartyReady({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" className={cx('m2p-grad flex items-center gap-2.5 rounded-3xl px-4 py-3 font-display text-[17px] font-semibold', className)}>
      <Sparkles className="size-5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function SampleBadge() {
  return <span className="text-[12px] font-medium text-muted">Sample prices for concept testing</span>;
}

/** "Paid $___": the actual amount paid. Empty means "use the estimate" (shown as the placeholder). Saves on blur or Enter. */
export function PaidInput({ id, value, estimate, onSave, label, className }: { id: string; value: number | undefined; estimate: number; onSave: (n: number | undefined) => void; label: string; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (typeof value === 'number' ? String(value) : '');
  const commit = () => {
    if (draft === null) return;
    const raw = draft.trim().replace(/[$,]/g, '');
    const n = raw === '' ? undefined : Number(raw);
    setDraft(null);
    if (n === undefined || (Number.isFinite(n) && n >= 0)) { if (n !== value) onSave(n === undefined ? undefined : Math.round(n * 100) / 100); }
  };
  return (
    <span className={cx('inline-flex min-h-9 items-center rounded-lg border bg-paper pl-2 text-[13px] font-semibold focus-within:border-forest', typeof value === 'number' ? 'border-forest/40' : 'border-gold-bright/70', className)}>
      <label htmlFor={id} className="text-muted">Paid $</label>
      <input
        id={id}
        inputMode="decimal"
        aria-label={label}
        className="tnum w-20 bg-transparent px-1 py-1 text-ink outline-none placeholder:font-normal placeholder:text-placeholder"
        placeholder={estimate.toFixed(2)}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
      />
    </span>
  );
}

/** Indoors / Outdoors as two equal buttons, the same height as a text box. */
export function SettingToggle({ id, value, onChange }: { id: string; value: 'indoors' | 'outdoors'; onChange: (v: 'indoors' | 'outdoors') => void }) {
  return (
    <div className="grid content-start gap-1.5">
      <span id={`${id}-label`} className="flex h-5 items-center text-sm font-semibold text-ink">Setting</span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid min-h-11 grid-cols-2 overflow-hidden rounded-xl border border-line-strong bg-paper">
        {(['indoors', 'outdoors'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={cx('text-sm font-semibold transition-colors', value === v ? 'bg-sage-soft text-forest' : 'text-muted hover:bg-sage-soft/50 hover:text-ink')}>
            {v === 'indoors' ? 'Indoors' : 'Outdoors'}
          </button>
        ))}
      </div>
    </div>
  );
}
