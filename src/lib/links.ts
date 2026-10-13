// Links out of the app: calendar invitations and store searches. No accounts or APIs needed.
import type { EventInfo, RetailerId } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Start and end as local date-times (no time zone, so calendars use the viewer's own). */
function eventTimes(ev: EventInfo): { start: Date; end: Date } {
  const [y, m, d] = (ev.date || '').split('-').map(Number);
  const [hh, mm] = (ev.startTime || '12:00').split(':').map(Number);
  const start = new Date(y || 2026, (m || 1) - 1, d || 1, Number.isFinite(hh) ? hh : 12, Number.isFinite(mm) ? mm : 0);
  const end = new Date(start.getTime() + Math.max(0.5, ev.durationHrs || 3) * 3600_000);
  return { start, end };
}
const compact = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
const isoLocal = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}:00`;

function details(ev: EventInfo) {
  return [`Planned with Mood2Party.`, ev.theme ? `Theme: ${ev.theme}.` : '', ev.dietary ? `Dietary needs: ${ev.dietary}.` : ''].filter(Boolean).join(' ');
}

export function googleCalendarUrl(ev: EventInfo): string {
  const { start, end } = eventTimes(ev);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: ev.name, dates: `${compact(start)}/${compact(end)}`, location: ev.venue, details: details(ev) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function outlookCalendarUrl(ev: EventInfo): string {
  const { start, end } = eventTimes(ev);
  const q = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: ev.name, startdt: isoLocal(start), enddt: isoLocal(end), location: ev.venue, body: details(ev) });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}

/** A standard calendar file (.ics) that Apple Calendar, Outlook and Google Calendar can all open. */
export function icsText(ev: EventInfo): string {
  const { start, end } = eventTimes(ev);
  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mood2Party//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${compact(start)}-${Math.random().toString(36).slice(2)}@mood2party`,
    `DTSTAMP:${stamp}`, `DTSTART:${compact(start)}`, `DTEND:${compact(end)}`,
    `SUMMARY:${esc(ev.name)}`, `LOCATION:${esc(ev.venue)}`, `DESCRIPTION:${esc(details(ev))}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

/** Inside claude.ai the page cannot hand over calendar files, so that option is hidden there. */
export function canDownloadFiles(): boolean {
  return typeof window !== 'undefined' && !window.claude;
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Search the store's own website for an item. */
export function storeSearchUrl(r: RetailerId, query: string): string {
  // Short searches find more: drop pack details like "(serves 16)" or ", 30 bags"
  const q = encodeURIComponent(query.replace(/\s*\([^)]*\)/g, '').replace(/,.*$/, '').trim() || query);
  return {
    costco: `https://www.costco.com/CatalogSearch?keyword=${q}`,
    target: `https://www.target.com/s?searchTerm=${q}`,
    amazon: `https://www.amazon.com/s?k=${q}`,
    instacart: `https://www.instacart.com/store/s?k=${q}`,
    own: `https://www.google.com/search?q=${q}`,
  }[r];
}

/** Copy text, falling back to a hidden text box for browsers that block the clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
