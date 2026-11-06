export const money = (n: number, cents = true) =>
  (n < 0 ? '-' : '') +
  '$' +
  Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

/** Never "+$-12" — describe the direction in words. */
export function costChange(delta: number): string {
  if (Math.abs(delta) < 0.005) return 'No cost change';
  return delta > 0 ? `${money(delta)} more` : `${money(-delta)} less`;
}

export function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

export function dateLabel(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', sameYear ? opts : { ...opts, year: 'numeric' });
}

export function timeLabel(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ampm}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function packLine(pkgs: number, packLabel: string) {
  return `${pkgs} × ${packLabel}`;
}

/** "1 kit", "2 kits", "1 canopy": an amount with its unit, singular for one. */
export function qtyUnit(n: number, unit: string): string {
  const u = unit.trim();
  if (n !== 1 || !u) return `${n} ${u}`.trim();
  const one = /^lbs$/i.test(u) ? 'lb'
    : /ies$/i.test(u) ? u.replace(/ies$/i, 'y')
    : /(ch|sh|x|ss)es$/i.test(u) ? u.replace(/es$/i, '')
    : /[^s]s$/i.test(u) ? u.replace(/s$/i, '')
    : u;
  return `1 ${one}`;
}
