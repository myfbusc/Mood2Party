import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, ChevronDown, Download, ExternalLink } from 'lucide-react';
import { useStore } from '../lib/store';
import { canDownloadFiles, downloadText, googleCalendarUrl, icsText, outlookCalendarUrl } from '../lib/links';
import { Button } from './ui';

/** "Add to calendar": Google or Outlook links, plus a calendar file where the page can save one. */
export function AddToCalendar() {
  const { s, toast } = useStore();
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
  const ev = s.event;
  const item = 'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-semibold text-ink hover:bg-sage-soft';
  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true">
        <CalendarPlus className="size-4" /> Add to Calendar <ChevronDown className="size-4" />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 sm:left-auto sm:right-0 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-paper p-2 shadow-xl">
          <a className={item} href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <ExternalLink className="size-4 text-forest" aria-hidden="true" /> Google Calendar
          </a>
          <a className={item} href={outlookCalendarUrl(ev)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <ExternalLink className="size-4 text-forest" aria-hidden="true" /> Outlook.com
          </a>
          {canDownloadFiles() && (
            <button
              type="button"
              className={item}
              onClick={() => {
                downloadText(`${ev.name.replace(/[^\w\- ]+/g, '').trim() || 'event'}.ics`, icsText(ev), 'text/calendar');
                setOpen(false);
                toast({ title: 'Calendar file saved', detail: 'Open it to add the event to Apple Calendar, Outlook or another calendar.', tone: 'success' });
              }}
            >
              <Download className="size-4 text-forest" aria-hidden="true" /> Apple, Outlook or other (.ics file)
            </button>
          )}
          <p className="px-3 pb-1 pt-2 text-[12px] text-muted">Adds {ev.name} on your own calendar. Send the calendar invite to guests from there.</p>
        </div>
      )}
    </div>
  );
}
