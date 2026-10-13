import { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, Loader2, LogIn, LogOut, TriangleAlert } from 'lucide-react';
import { useStore } from '../lib/store';
import { aiServerReady } from '../lib/ai';
import { Button, cx } from './ui';

/** One line about saving, for the account menu and sidebar. */
export function SyncLine({ className }: { className?: string }) {
  const { cloud, s } = useStore();
  if (!cloud.user) return null;
  const onEvent = s.started && !s.isDemo;
  const map = {
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…', cls: 'text-muted' },
    saved: { icon: <Cloud className="size-3.5" />, text: onEvent ? 'Saved to your account' : 'Signed in', cls: 'text-ok' },
    offline: { icon: <CloudOff className="size-3.5" />, text: "Offline · saves when you're back", cls: 'text-warn-ink' },
    error: { icon: <TriangleAlert className="size-3.5" />, text: "Couldn't save · retrying", cls: 'text-danger' },
    off: null,
    'signed-out': null,
  }[cloud.status];
  if (!map) return null;
  return (
    <p role="status" className={cx('flex items-center gap-1.5 text-[12.5px] font-semibold', map.cls, className)}>
      {map.icon}{map.text}
    </p>
  );
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  return photo ? (
    <img src={photo} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="m2p-grad grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold" aria-hidden="true">{initials}</span>
  );
}

/** Sign in with Google, or who is signed in with a menu to sign out. Hidden where accounts aren't available. */
export function AccountMenu({ compact, onPick }: { compact?: boolean; onPick?: () => void }) {
  const { cloud, signOut, toast } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!cloud.available || !cloud.ready) return null;

  if (!cloud.user) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={compact ? '' : 'w-full'}
        onClick={async () => {
          const ok = await cloud.signIn();
          if (ok) {
            const ai = await aiServerReady();
            toast({ title: 'Signed in', detail: ai ? 'Your events are saved to your account, and AI help is turned on.' : 'Your events are saved to your account.', tone: 'success' });
          }
        }}
      >
        <LogIn className="size-4" />
        {compact ? <><span className="sm:hidden">Sign in</span><span className="hidden sm:inline">Sign in with Google</span></> : 'Sign in with Google'}
      </Button>
    );
  }

  const u = cloud.user;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Account: ${u.name}`}
        className={cx('flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-left hover:bg-nav-hover', compact ? '' : 'w-full')}
      >
        <Avatar name={u.name} photo={u.photo} />
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ink">{u.name}</span>
            <SyncLine />
          </span>
        )}
      </button>
      {open && (
        <div className={cx('absolute z-40 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-paper p-3 shadow-xl', compact ? 'right-0 top-full mt-2' : 'bottom-full left-0 mb-2')}>
          <p className="truncate font-semibold text-ink">{u.name}</p>
          {u.email && <p className="truncate text-[13px] text-muted">{u.email}</p>}
          <SyncLine className="mt-2" />
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full"
            onClick={async () => {
              setOpen(false);
              onPick?.();
              await signOut();
              toast({ title: 'Signed out', detail: 'Your events stay in your account. They were removed from this browser.', tone: 'info' });
            }}
          >
            <LogOut className="size-4" /> Sign Out
          </Button>
        </div>
      )}
    </div>
  );
}
