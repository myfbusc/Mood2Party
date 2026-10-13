import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { cx } from './ui';

export default function Toasts() {
  const { toasts, dismiss } = useStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:items-start md:pl-6 lg:pl-[296px]">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={cx('m2p-drawer pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border bg-paper p-4 shadow-lg', t.tone === 'warn' ? 'border-coral-bright/50' : 'border-line')}>
          <span className={cx('mt-0.5', t.tone === 'success' ? 'text-ok' : t.tone === 'warn' ? 'text-coral' : 'text-forest')}>
            {t.tone === 'success' ? <CheckCircle2 className="size-5" /> : t.tone === 'warn' ? <TriangleAlert className="size-5" /> : <Info className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{t.title}</p>
            {t.detail && <p className="mt-0.5 text-sm text-muted">{t.detail}</p>}
          </div>
          {t.action && (
            <button type="button" onClick={() => { t.action!.run(); dismiss(t.id); }} className="min-h-8 shrink-0 rounded-lg border border-forest/40 px-3 text-sm font-semibold text-forest hover:bg-sage-soft">
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismiss(t.id)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-cream" aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
