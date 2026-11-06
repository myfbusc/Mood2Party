import { addDays, toISO } from './tasks';
import { FOOD_SHORT } from './catalog';
import type { Alcohol, FoodFormat, Setting, SoftDrink } from './types';
import { defaultBudget, profileFor, sizeFactor, type Profile } from './partyDefaults';

/** What the setup assistant understood from a free-form description. All fields are editable afterwards. */
export interface Draft {
  name: string;
  type: string;
  date: string;
  startTime: string;
  durationHrs: number;
  venue: string;
  setting: Setting;
  venueCapacity: number;
  foodFormat: FoodFormat;
  dietary: string;
  theme: string;
  budget: number;
  guestMin: number;
  guestExpected: number;
  guestMax: number;
  childPct: number;
  children: number; // how many children are expected
  helpers: string[];
  extraFood: FoodFormat[];
  alcohol: Alcohol;
  softDrinks: SoftDrink[];
  preferences: string;
  foodText: string; // food in the host's own words
  drinksText: string; // drinks in the host's own words
}

export interface ParseResult {
  draft: Draft;
  assumptions: string[];
  found: string[];
  /** Which fields the description gave (everything else is a default that fits the kind of party) */
  stated: Field[];
  /** What the defaults were based on, so they can be worked out again after AI reads the description */
  ctx: DefaultsCtx;
}

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, couple: 2, few: 3,
};
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM_WORDS[s.toLowerCase()] ?? NaN);

/** A holiday or occasion: its plain name, and what usually goes with it when the host doesn't say. */
interface Occasion {
  re: RegExp;
  label: string; // "Halloween party"
  /** When it usually happens, if it has a fixed day: month (0-11) and day, or a rule */
  when?: { month: number; day: number } | ((year: number) => Date);
  /** Party held on the day itself even on a weekday (e.g. New Year's Eve) */
  onTheDay?: boolean;
  theme?: string;
  start?: string; // HH:MM
  hours?: number;
  kids?: boolean;
}

const nthWeekday = (year: number, month: number, weekday: number, n: number) => {
  const d = new Date(year, month, 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (n - 1));
  return d;
};
const thanksgiving = (y: number) => nthWeekday(y, 10, 4, 4);

/** Most specific first. Labels are what the event is called; the host can rename it. */
const OCCASIONS: Occasion[] = [
  { re: /friendsgiving/i, label: 'Friendsgiving', when: (y) => { const d = thanksgiving(y); d.setDate(d.getDate() - 5); return d; }, theme: 'Autumn harvest', start: '16:00' },
  { re: /thanksgiving/i, label: 'Thanksgiving dinner', when: thanksgiving, onTheDay: true, theme: 'Autumn harvest', start: '15:00' },
  { re: /hallowe'?en|spooky|trick[- ]or[- ]treat/i, label: 'Halloween party', when: { month: 9, day: 31 }, theme: 'Halloween: costumes, orange and black', start: '19:00' },
  { re: /d[ií]a de (?:los )?muertos/i, label: 'Día de los Muertos celebration', when: { month: 10, day: 2 }, theme: 'Marigolds and papel picado' },
  { re: /new year'?s eve|\bnye\b/i, label: "New Year's Eve party", when: { month: 11, day: 31 }, onTheDay: true, theme: 'Black and gold countdown', start: '20:00', hours: 5 },
  { re: /new year'?s day/i, label: "New Year's Day brunch", when: { month: 0, day: 1 }, onTheDay: true, start: '11:00' },
  { re: /christmas|xmas/i, label: 'Christmas party', when: { month: 11, day: 25 }, theme: 'Festive red and green' },
  { re: /hanukkah|chanukah/i, label: 'Hanukkah party', theme: 'Blue and silver' },
  { re: /kwanzaa/i, label: 'Kwanzaa celebration' },
  { re: /lunar new year|chinese new year|t[eế]t\b/i, label: 'Lunar New Year party', theme: 'Red and gold' },
  { re: /diwali/i, label: 'Diwali party', theme: 'Lights and marigolds' },
  { re: /\beid\b/i, label: 'Eid celebration' },
  { re: /easter/i, label: 'Easter gathering', theme: 'Spring pastels', start: '11:00', kids: true },
  { re: /valentine/i, label: "Valentine's party", when: { month: 1, day: 14 }, theme: 'Red and pink' },
  { re: /galentine/i, label: "Galentine's party", when: { month: 1, day: 13 }, theme: 'Pink and red' },
  { re: /st\.? patrick|paddy'?s day/i, label: "St. Patrick's Day party", when: { month: 2, day: 17 }, theme: 'Green' },
  { re: /cinco de mayo/i, label: 'Cinco de Mayo party', when: { month: 4, day: 5 }, theme: 'Fiesta colors' },
  { re: /fourth of july|4th of july|july 4(?:th)?|independence day/i, label: 'Fourth of July party', when: { month: 6, day: 4 }, onTheDay: true, theme: 'Red, white and blue', start: '15:00', hours: 6 },
  { re: /memorial day/i, label: 'Memorial Day cookout', when: (y) => { const d = new Date(y, 4, 31); while (d.getDay() !== 1) d.setDate(d.getDate() - 1); d.setDate(d.getDate() - 2); return d; } },
  { re: /labor day/i, label: 'Labor Day cookout', when: (y) => { const d = nthWeekday(y, 8, 1, 1); d.setDate(d.getDate() - 2); return d; } },
  { re: /super ?bowl/i, label: 'Super Bowl party', theme: 'Team colors', start: '15:00', hours: 5 },
  { re: /watch party|game day|march madness|world cup/i, label: 'Watch party', theme: 'Team colors' },
  { re: /graduat|\bgrad party\b/i, label: 'Graduation party' },
  { re: /baby shower/i, label: 'Baby shower', start: '13:00', hours: 3 },
  { re: /sip (?:and|&|n) see/i, label: 'Sip and see', start: '13:00', hours: 3 },
  { re: /gender reveal/i, label: 'Gender reveal party', theme: 'Pink and blue' },
  { re: /bridal shower|wedding shower/i, label: 'Bridal shower', start: '12:00', hours: 3 },
  { re: /bachelorette/i, label: 'Bachelorette party' },
  { re: /bachelor/i, label: 'Bachelor party' },
  { re: /engagement/i, label: 'Engagement party' },
  { re: /rehearsal dinner/i, label: 'Rehearsal dinner', start: '18:30', hours: 3 },
  { re: /wedding reception|reception/i, label: 'Wedding reception' },
  { re: /vow renewal/i, label: 'Vow renewal' },
  { re: /anniversary/i, label: 'Anniversary party' },
  { re: /quincea[nñ]era|quince\b/i, label: 'Quinceañera' },
  { re: /sweet (?:16|sixteen)/i, label: 'Sweet 16' },
  { re: /bar mitzvah/i, label: 'Bar mitzvah' },
  { re: /bat mitzvah/i, label: 'Bat mitzvah' },
  { re: /baptism|christening/i, label: 'Baptism celebration', start: '12:00' },
  { re: /first communion|communion/i, label: 'First Communion celebration', start: '12:00' },
  { re: /retire/i, label: 'Retirement party' },
  { re: /farewell|going[- ]away|send[- ]off/i, label: 'Going-away party' },
  { re: /welcome home|homecoming/i, label: 'Welcome home party' },
  { re: /housewarming|house warming/i, label: 'Housewarming party' },
  { re: /open house/i, label: 'Open house' },
  { re: /celebration of life|memorial|wake\b/i, label: 'Celebration of life' },
  { re: /reunion/i, label: 'Reunion' },
  { re: /fundrais|gala|charity|nonprofit/i, label: 'Fundraiser' },
  { re: /launch party|product launch/i, label: 'Launch party' },
  { re: /(?:office|work|team|company|coworker|staff)\s+(?:party|event|lunch|dinner|outing|holiday)/i, label: 'Work event' },
  { re: /\bclub\b|student org|chapter|society|sorority|fraternity/i, label: 'Club event' },
  { re: /tailgat/i, label: 'Tailgate' },
  { re: /pool party/i, label: 'Pool party', theme: 'Summer pool' },
  { re: /luau|tropical|hawaiian/i, label: 'Luau', theme: 'Tropical' },
  { re: /block party/i, label: 'Block party' },
  { re: /game night/i, label: 'Game night', start: '19:00' },
  { re: /movie night/i, label: 'Movie night', start: '19:00' },
  { re: /dinner party/i, label: 'Dinner party', start: '18:30', hours: 3 },
  { re: /brunch/i, label: 'Brunch', start: '11:00', hours: 3 },
  { re: /\btea party\b|high tea/i, label: 'Tea party', start: '14:00', hours: 2 },
  { re: /slumber party|sleepover/i, label: 'Sleepover', kids: true },
  { re: /potluck/i, label: 'Potluck' },
  { re: /picnic/i, label: 'Picnic', start: '12:00' },
  { re: /bbq|barbecue|cookout/i, label: 'Cookout' },
  { re: /house ?party/i, label: 'House party' },
  { re: /kids'? party|children'?s party/i, label: "Kids' party", start: '14:00', kids: true },
];

/** Words that describe a party but are not its occasion ("a small casual party"). */
const NOT_OCCASION = /^(?:a|an|the|my|our|his|her|their|small|big|large|little|huge|casual|fun|chill|nice|simple|fancy|outdoor|indoor|backyard|surprise|private|great|cool|planning|plan|throw|throwing|host|hosting|having|have|for|some|this|that|next|last|annual|yearly|first|cute|low[- ]key|intimate|adults?|only|grown-?ups?|family[- ]friendly|kid[- ]friendly)$/i;

const titleCase = (t: string) =>
  t.replace(/(^|[\s-])([a-z])([\w'’]*)/g, (m, pre: string, a: string, rest: string, i: number) => (i > 0 && /^(?:and|or|of|the|a|an|in|on|at|for|to|with|de|los)$/.test(a + rest) ? m : pre + a.toUpperCase() + rest));

/** The holiday's date for a party: the day itself if it falls on a Friday or Saturday (or must be on the day), otherwise the Saturday before. */
function holidayPartyDate(o: Occasion, onDay = false): string | null {
  if (!o.when) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const on = (y: number) => (typeof o.when === 'function' ? o.when(y) : new Date(y, o.when!.month, o.when!.day));
  let day = on(today.getFullYear());
  if (day < today) day = on(today.getFullYear() + 1);
  if (!onDay && /christmas/i.test(o.label) && day.getDate() === 25) {
    const sat = new Date(day);
    do sat.setDate(sat.getDate() - 1); while (sat.getDay() !== 6);
    if (sat >= today) return toISO(sat);
  }
  if (onDay || o.onTheDay || day.getDay() === 5 || day.getDay() === 6) return toISO(day);
  const sat = new Date(day);
  while (sat.getDay() !== 6) sat.setDate(sat.getDate() - 1);
  return toISO(sat >= today ? sat : day);
}

const HOLIDAY_NAME = /^(?:Halloween|Friendsgiving|Christmas|Hanukkah|Kwanzaa|Diwali|Eid|Easter|Thanksgiving|New Year|Valentine|Galentine|St\. Patrick|Cinco|Fourth|Memorial|Labor|Lunar|Día|Super Bowl)/;
/** "Halloween party" → "Halloween"; "Baby shower" → "the baby shower" */
const occasionPhrase = (label: string) => {
  const core = label.replace(/ (party|celebration|gathering|dinner|brunch|cookout)$/i, '');
  return HOLIDAY_NAME.test(core) ? core : `the ${label.replace(/^\w/, (c) => c.toLowerCase())}`;
};

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** Who the party is for, when the description names them: "Maya's graduation", "for my son Leo", "my wife Ana's 40th". */
function findHonoree(t: string): string {
  const poss = t.match(/\b([A-Z][a-zÀ-ɏ]+)(?:'s|’s)\s+(?:(?:\d+\w*|surprise|big|first|1st)\s+)*(?:birthday|bday|graduation|grad|baby shower|bridal shower|retirement|going[- ]away|farewell|quincea|sweet|bar mitzvah|bat mitzvah|baptism|christening|communion|engagement|anniversary|welcome home|celebration|party)/);
  if (poss && !/^(?:It|That|What|There|Let|Here|He|She|Today|Tomorrow|Halloween|Christmas|Valentine|Patrick)$/.test(poss[1])) return poss[1];
  const rel = t.match(/\bfor\s+(?:my|our)\s+(?:son|daughter|wife|husband|partner|mom|mother|dad|father|sister|brother|friend|best friend|bestie|boss|coworker|colleague|niece|nephew|grandma|grandpa|grandmother|grandfather|aunt|uncle|cousin|boyfriend|girlfriend|fianc[eé]e?|kid|child|twins?)\s+([A-Z][a-zÀ-ɏ]+)/);
  if (rel) return rel[1];
  const turning = t.match(/\b([A-Z][a-zÀ-ɏ]+)\s+(?:is|will be)\s+turning\s+\d/);
  if (turning && !/^(?:It|He|She|That|This)$/.test(turning[1])) return turning[1];
  const couple = t.match(/\b(?:party|celebration|shower|dinner|bash|reception)\s+for\s+([A-Z][a-zÀ-ɏ]+)\s+(?:and|&)\s+([A-Z][a-zÀ-ɏ]+)\b/);
  if (couple) return `${couple[1]} and ${couple[2]}`;
  const forName = t.match(/\b(?:party|celebration|shower|dinner|bash)\s+for\s+([A-Z][a-zÀ-ɏ]+)\b/);
  if (forName && !/^(?:Christmas|Halloween|Easter|Thanksgiving|New|Saturday|Sunday|Friday|Monday|Tuesday|Wednesday|Thursday|January|February|March|April|May|June|July|August|September|October|November|December|The|Our|My)$/.test(forName[1])) return forName[1];
  return '';
}

/** Fun extras the host mentions, kept as notes for the plan. */
const EXTRAS: [RegExp, string][] = [
  [/costume contest|best costume/i, 'costume contest'], [/costumes?\b/i, 'costumes'], [/pumpkin carving|carve pumpkins/i, 'pumpkin carving'],
  [/haunted/i, 'haunted house'], [/trick[- ]or[- ]treat/i, 'trick-or-treating'], [/karaoke/i, 'karaoke'], [/\bdj\b/i, 'DJ'], [/live music|band\b/i, 'live music'],
  [/photo ?booth/i, 'photo booth'], [/pi[nñ]ata/i, 'piñata'], [/bounce house/i, 'bounce house'], [/face paint/i, 'face painting'], [/games?\b/i, 'games'],
  [/fireworks/i, 'fireworks'], [/bonfire|fire pit/i, 'bonfire'], [/s'?mores/i, "s'mores"], [/gift exchange|white elephant|secret santa/i, 'gift exchange'],
  [/speech|toast/i, 'speeches or toasts'], [/slideshow/i, 'slideshow'], [/dance|dancing/i, 'dancing'], [/swim/i, 'swimming'],
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function nextSaturdayAfter(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return toISO(d);
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

interface DateHit {
  date: string; // YYYY-MM-DD
  said: string; // the words the person used, for plain-language notes
  rolled: boolean; // no year given and this year's date had passed, so next year was used
  past: boolean; // an explicit date that is already over
}

function build(year: number | null, month: number, day: number, said: string): DateHit | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let y = year ?? today.getFullYear();
  let d = new Date(y, month, day);
  if (d.getMonth() !== month) return null; // e.g. February 31
  let rolled = false;
  if (year === null && d < today) {
    d = new Date(++y, month, day);
    rolled = true;
  }
  return { date: toISO(d), said: said.trim(), rolled, past: d < today };
}

const fullYear = (y?: string) => (!y ? null : y.length === 2 ? 2000 + Number(y) : Number(y));

/** Reads a date written in any of the usual ways. Returns null when there is none. */
function parseDate(text: string): DateHit | null {
  const monthIdx = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase());

  // 2026-11-14
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return build(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), iso[0]);

  // November 14, Nov. 14th 2026, Saturday, November 14
  const md = text.match(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, 'i'));
  if (md) return build(fullYear(md[3]), monthIdx(md[1]), Number(md[2]), md[0]);

  // 14 November, the 14th of November 2026
  const dm = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b\\.?(?:,?\\s*(\\d{4}))?`, 'i'));
  if (dm) return build(fullYear(dm[3]), monthIdx(dm[2]), Number(dm[1]), dm[0]);

  // 11/14, 11/14/2026, 11-14-26, 14.11.2026 (day first when the first number is over 12)
  const num = text.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (num && !/^\d{1,2}[.-]\d{1,2}$/.test(num[0])) {
    let a = Number(num[1]);
    let b = Number(num[2]);
    if (a > 12 && b <= 12) [a, b] = [b, a];
    const hit = build(fullYear(num[3]), a - 1, b, num[0]);
    if (hit) return hit;
  }

  // this Saturday, next Friday, on Saturday, this weekend, tomorrow
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const wd = text.match(/\b(this|next|coming|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2].toLowerCase());
    let add = (target - today.getDay() + 7) % 7;
    if (add === 0) add = 7;
    if (wd[1].toLowerCase() === 'next' && add < 7 && today.getDay() !== 0) add += 7;
    const d = new Date(today);
    d.setDate(d.getDate() + add);
    return { date: toISO(d), said: wd[0], rolled: false, past: false };
  }
  if (/\b(this|next) weekend\b/i.test(text)) {
    const next = /next weekend/i.test(text);
    const d = new Date(today);
    d.setDate(d.getDate() + ((6 - today.getDay() + 7) % 7 || 7) + (next ? 7 : 0));
    return { date: toISO(d), said: next ? 'next weekend' : 'this weekend', rolled: false, past: false };
  }
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return { date: toISO(d), said: 'tomorrow', rolled: false, past: false };
  }

  // in two weeks, in 3 months
  const rel = text.match(/\bin\s+(\w+)\s+(week|month)s?\b/i);
  if (rel) {
    const k = toNum(rel[1]);
    if (!isNaN(k)) return { date: nextSaturdayAfter(rel[2].toLowerCase() === 'week' ? k * 7 - 3 : k * 30 - 3), said: rel[0], rolled: false, past: false };
  }
  return null;
}

const NUMBER_WORDS: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, couple: 2, few: 3 };

/** The holiday itself (not moved to a weekend), next time it comes round. */
function holidayDay(o: Occasion, today: Date): Date | null {
  if (!o.when) return null;
  const on = (y: number) => (typeof o.when === 'function' ? o.when(y) : new Date(y, o.when!.month, o.when!.day));
  const d = on(today.getFullYear());
  return d < today ? on(today.getFullYear() + 1) : d;
}

/**
 * Dates said relative to a holiday: "the day before Halloween", "Christmas Eve", "the weekend before Christmas",
 * "the Saturday after Thanksgiving", "two days before Christmas", "Halloween night", "on New Year's Day".
 */
function parseHolidayDate(text: string): DateHit | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => toISO(d);
  const fit = (d: Date, said: string): DateHit => ({ date: iso(d), said, rolled: false, past: d < today });
  for (const o of OCCASIONS) {
    if (!o.when) continue;
    const base = holidayDay(o, today);
    if (!base) continue;
    // Look at every mention: "Halloween party the day before Halloween"
    for (const m of text.matchAll(new RegExp(o.re.source, 'gi'))) {
    const name = m[0];
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 60), at);
    const after = text.slice(at + name.length, at + name.length + 20);
    const shift = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    // "<holiday> eve" (when the holiday's own name doesn't already mean the eve)
    if (/^\s*eve\b/i.test(after) && !/eve/i.test(name)) return fit(shift(base, -1), `${name} Eve`);
    // "the day/night before", "two days after", "the week before"
    const rel = before.match(/\b(?:the\s+)?(?:(\w+)\s+)?(day|night|evening|week|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\s+(before|after|prior to|following)\s+(?:the\s+)?$/i);
    if (rel) {
      const count = rel[1] ? (/^\d+$/.test(rel[1]) ? Number(rel[1]) : NUMBER_WORDS[rel[1].toLowerCase()] ?? 1) : 1;
      const unit = rel[2].toLowerCase();
      const dir = /before|prior/i.test(rel[3]) ? -1 : 1;
      const said = `${rel[0].trim()} ${name}`.replace(/^the\s+/i, 'the ');
      let d: Date;
      if (unit === 'day' || unit === 'night' || unit === 'evening') d = shift(base, dir * count);
      else if (unit === 'week') d = shift(base, dir * 7 * count);
      else {
        const target = unit === 'weekend' ? 6 : WEEKDAYS.indexOf(unit);
        d = shift(base, dir);
        while (d.getDay() !== target) d = shift(d, dir);
        if (count > 1) d = shift(d, dir * 7 * (count - 1));
      }
      return fit(d, said);
    }
    // "on Halloween", "Halloween night/day", "the night of Halloween": the day itself
    if (/\b(?:on|the (?:night|day|evening) of)\s+(?:the\s+)?$/i.test(before) || /^\s*(?:night|day|evening)\b/i.test(after)) return fit(base, name);
    }
  }
  return null;
}

/** Words that start a place: "at", "in" or "on" followed by the/my/our/a or a capitalised name. */
const TIME_WORD = /^(?:the\s+)?(?:(?:day|night|evening|morning|afternoon|weekend|week|end|middle|beginning|start)\b|(?:mon|tues|wednes|thurs|fri|satur|sun)day|jan|feb|march|april|may\b|june|july|aug|sept|oct|nov|dec|\d|noon|midnight|time|moment|mood|meantime|future|past|summer|winter|spring|fall|autumn|year|month)/i;
const STOP_WORD = /^(?:for|with|and|from|around|about|which|that|who|where|starting|this|next|we|i|it|it's|to|so|but|because|while|until|till|or|plus|maybe|probably|budget|guests?|people|kids|friends|family|serving|having|bring|bringing)$/i;
const HOME_WORD = /^(?:my |our )?(?:place|house|home|apartment|apt|condo|flat)$/i;
const CITY_EXCLUDE = /^(?:January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Halloween|Christmas|Thanksgiving|Easter)$/;

/** The place in the host's own words: "the pool on the rooftop of my apartment", "Jake's place", "Nobu in Malibu". */
function findVenue(t: string): { venue: string; city: string } {
  const words = t.replace(/\s+/g, ' ').trim();
  const starts = [...words.matchAll(/\b(at|in|on|inside)\s+(?=(?:the|our|my|a|an|his|her|their)\s|[A-Z][\w'’-]*)/g)];
  for (const s of starts) {
    const rest = words.slice((s.index ?? 0) + s[0].length);
    if (TIME_WORD.test(rest)) continue;
    const toks = rest.split(' ');
    const out: string[] = [];
    for (let i = 0; i < toks.length && out.length < 12; i++) {
      const raw = toks[i];
      const w = raw.replace(/[,.;:!?)]+$/, '');
      if (!w || STOP_WORD.test(w)) break;
      // "…my parents' house the weekend after Thanksgiving": a date phrase ends the place
      if (out.length && /^(?:the|this|next|last)$/i.test(w) && TIME_WORD.test(toks.slice(i + 1).join(' '))) break;
      // a time or date after "on/at/in" ends the place: "on Saturday", "at 7pm", "in two weeks"
      if (/^(?:on|at|in|by|near|next|of|inside|behind|above|off)$/i.test(w)) {
        const tail = toks.slice(i + 1).join(' ');
        if (TIME_WORD.test(tail) || /^(?:two|three|four|a few|a couple)\b/i.test(tail) || !tail) break;
      }
      if (/^\d/.test(w) && out.length) break;
      out.push(w);
      if (raw !== w) break; // punctuation ends it
    }
    while (out.length && /^(?:on|at|in|of|by|near|the|a|an|my|our)$/i.test(out[out.length - 1])) out.pop();
    if (!out.length) continue;
    let phrase = out.join(' ');
    if (s[1].toLowerCase() === 'in' && /^[A-Z]/.test(phrase) && out.length <= 3 && !/'s\b/.test(phrase)) {
      // "in Malibu": a city, unless it's a month or holiday
      if (!CITY_EXCLUDE.test(out[0])) return { venue: '', city: phrase };
      continue;
    }
    // A trailing city: "Nobu in Malibu"
    let city = '';
    const inCity = phrase.match(/^(.*\S)\s+in\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,2})$/);
    if (inCity && !CITY_EXCLUDE.test(inCity[2])) { phrase = inCity[1]; city = inCity[2]; }
    phrase = phrase.replace(/^(?:the|a|an)\s+/i, '');
    if (HOME_WORD.test(phrase)) phrase = 'Home';
    return { venue: phrase[0].toUpperCase() + phrase.slice(1), city };
  }
  const city = words.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,2})/);
  return { venue: '', city: city && !CITY_EXCLUDE.test(city[1].split(' ')[0]) ? city[1] : '' };
}

const clock = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`; };
const hhmm = (h: number, m = 0) => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

// ─── Words to numbers ────────────────────────────────────────────

const UNITS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORD: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90, hundredth: 100 };
const ONES_ORD: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9 };
const ONES: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const suffix = (n: number) => ordinal(n).replace(/^\d+/, '');

/**
 * Writes numbers as digits so one set of patterns reads them all:
 * "twenty-five people" → "25 people", "a dozen" → "12", "her thirtieth birthday" → "her 30th birthday",
 * "noon" → "12pm", "a couple of hours" → "2 hours".
 */
function normalize(text: string): string {
  let t = text;
  t = t.replace(/\b(?:a|one)\s+hundred\b/gi, '100').replace(/\b(two|three|four|five)\s+hundred\b/gi, (_m, w: string) => String(ONES[w.toLowerCase()] * 100));
  t = t.replace(/\b(a|one|two|three|four|2|3|4)\s+dozen\b/gi, (_m, w: string) => String(({ a: 1, one: 1, two: 2, three: 3, four: 4 } as Record<string, number>)[w.toLowerCase()] ?? Number(w)) === 'NaN' ? '12' : String((({ a: 1, one: 1, two: 2, three: 3, four: 4 } as Record<string, number>)[w.toLowerCase()] ?? Number(w)) * 12));
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/gi, (_m, a: string, b: string) => { const n = TENS[a.toLowerCase()] + ONES_ORD[b.toLowerCase()]; return `${n}${suffix(n)}`; });
  t = t.replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth|fortieth|fiftieth|sixtieth|seventieth|eightieth|ninetieth|hundredth)\b/gi, (m: string) => { const n = ORD[m.toLowerCase()]; return `${n}${suffix(n)}`; });
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](one|two|three|four|five|six|seven|eight|nine))?\b/gi, (_m, a: string, b?: string) => String(TENS[a.toLowerCase()] + (b ? ONES[b.toLowerCase()] : 0)));
  t = t.replace(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi, (m: string) => String(UNITS[m.toLowerCase()]));
  t = t.replace(/\ba\s+couple(?:\s+of)?\s+hours\b/gi, '2 hours').replace(/\ba\s+few\s+hours\b/gi, '3 hours').replace(/\bhalf[- ]a[- ]day\b|\bhalf[- ]day\b/gi, '4 hours').replace(/\b(\d+)\s+and\s+a\s+half\s+hours\b/gi, (_m, n: string) => `${n}.5 hours`);
  t = t.replace(/\b12\s*noon\b|\bnoon\b|\bmidday\b(?=\s*(?:to|-|–|until|till))/gi, '12pm').replace(/\bmidnight\b/gi, '12am');
  return t;
}

// ─── Guests ──────────────────────────────────────────────────────

const PEOPLE = '(?:people|guests|persons|ppl|pax|attendees|folks|members|friends|coworkers|co-workers|colleagues|classmates|students|relatives|family members|cousins|neighbors|neighbours|employees|staff|teammates|ladies|guys|women|men|adults|grown-?ups|couples|families|teens|teenagers|girls|boys|kids|children|little ones|toddlers|people total)';
const NOT_PEOPLE_AFTER = '(?!\\s*(?:hours?|hrs?|h\\b|pm|am|p\\.m|a\\.m|o\'?clock|years?|yrs?|year[- ]old|dollars|bucks|usd|minutes|mins|%|k\\b|th\\b|st\\b|nd\\b|rd\\b|:|\\/|-?(?:dozen|hundred)|days?|weeks?|months?|miles?|per|a head|each|ft|feet))';

interface Guests { exp: number; min: number; max: number; kids: number | null; said: string; note?: string; adultsOnly: boolean; kidsMentioned: boolean }

function readGuests(t: string, kidsParty: boolean): Guests | null {
  const r = readGuestsCore(t, kidsParty);
  if (r && r.exp > 0 && r.kids === null) {
    const k = t.match(/(?:including|incl\.?|with|plus|and|,|of (?:them|whom))\s*(?:about|around|maybe|~)?\s*(\d{1,4})\s*(?:of them\s+)?(?:are\s+)?(?:kids|children|little ones|under \d+s?)\b/i) ?? t.match(/\b(\d{1,4})\s+of (?:them|whom) (?:are|will be) (?:kids|children)/i);
    if (k) {
      const n = Number(k[1]);
      const plus = /^plus/i.test(k[0]);
      if (plus && !/(?:people|guests)\s*(?:total|in all)/i.test(t)) { r.exp += n; r.min = Math.round(r.exp * 0.8); r.max = Math.round(r.exp * 1.2); r.note = `${r.said} plus ${n} kids: ${r.exp} guests in all.`; }
      r.kids = Math.min(n, r.exp);
    }
  }
  return r;
}

function readGuestsCore(t: string, kidsParty: boolean): Guests | null {
  const adultsOnly = /\badults?[- ]only\b|\bno (?:kids|children)\b|\bkid[- ]?free\b|\bchild[- ]?free\b|\b21\s*\+|\b21 and (?:up|over)\b|\bgrown[- ]?ups? only\b/i.test(t);
  const kidsMentioned = !adultsOnly && /\b(?:kids?|children|child|toddlers?|little ones|babies|family[- ]friendly|kid[- ]friendly|families)\b/i.test(t);
  const spread = (exp: number) => ({ exp, min: Math.max(1, Math.round(exp * 0.8)), max: Math.round(exp * 1.2) });
  const g = (o: Partial<Guests> & { exp: number; said: string }): Guests => ({ ...spread(o.exp), kids: null, adultsOnly, kidsMentioned, ...o });

  // "40 adults and 10 kids", "10 kids and 40 adults"
  const ak = t.match(/(\d{1,4})\s*(?:adults?|grown-?ups)\s*(?:and|&|\+|,|plus|with)\s*(\d{1,4})\s*(?:kids|children|little ones)/i);
  const ka = t.match(/(\d{1,4})\s*(?:kids|children|little ones)\s*(?:and|&|\+|,|plus|with)\s*(\d{1,4})\s*(?:adults?|grown-?ups|parents)/i);
  if (ak || ka) {
    const adults = Number(ak ? ak[1] : ka![2]);
    const kids = Number(ak ? ak[2] : ka![1]);
    return g({ exp: adults + kids, kids, said: `${adults} adults and ${kids} kids` });
  }
  // "between 30 and 40 people", "30-40 people", "30 to 40 close friends"
  const range = t.match(new RegExp(`(?:between\\s+)?(\\d{1,4})\\s*(?:-|–|to|or|and)\\s*(\\d{1,4})\\s*(?:[a-z]+\\s+)?${PEOPLE}`, 'i'));
  if (range && (!/\band\b/i.test(range[0]) || /^between/i.test(range[0]))) {
    let lo = Number(range[1]), hi = Number(range[2]);
    if (lo > hi) [lo, hi] = [hi, lo];
    if (hi > 0) {
      const exp = Math.round((lo + hi) / 2);
      return g({ exp, min: lo, max: hi, said: `${lo} to ${hi}`, note: `The plan is set for ${exp} guests, the middle of your ${lo} to ${hi} range. You can change it anytime.` });
    }
  }
  // "50+ guests", "over 50 people", "at least 50"
  const plus = t.match(new RegExp(`(\\d{1,4})\\s*\\+\\s*${PEOPLE}?|\\b(?:over|more than|at least|upwards of)\\s+(\\d{1,4})\\s*${PEOPLE}?${NOT_PEOPLE_AFTER}`, 'i'));
  if (plus && !/\$/.test(t.slice(Math.max(0, (plus.index ?? 0) - 2), plus.index ?? 0))) {
    const n = Number(plus[1] ?? plus[2]);
    if (n >= 4) { const exp = Math.round(n * 1.15); return g({ exp, min: n, max: Math.round(n * 1.35), said: `${n} or more`, note: `"${n} or more" guests: the plan is set for about ${exp}.` }); }
  }
  // "up to 50", "no more than 40 guests", "max 30"
  const upto = t.match(new RegExp(`\\b(?:up to|max(?:imum)?(?: of)?|no more than|at most|fewer than|less than|under)\\s+(\\d{1,4})\\s*${PEOPLE}?${NOT_PEOPLE_AFTER}`, 'i'));
  if (upto && !/\$\s*$/.test(t.slice(0, (upto.index ?? 0) + upto[0].indexOf(upto[1])))) {
    const n = Number(upto[1]);
    if (n >= 4 && (new RegExp(PEOPLE, 'i').test(upto[0]) || !/budget|spend|\$/i.test(t.slice(Math.max(0, (upto.index ?? 0) - 20), (upto.index ?? 0) + upto[0].length + 3)))) {
      const exp = Math.round(n * 0.85);
      return g({ exp, min: Math.round(n * 0.65), max: n, said: `up to ${n}`, note: `Up to ${n} guests: the plan is set for about ${exp}.` });
    }
  }
  // "25 friends", "30ish people", "10 couples", "6 girls", "15 kids and their parents"
  const one = t.match(new RegExp(`(\\d{1,4})\\s*(?:-?ish\\s*)?(?:[a-z]+\\s+)?(${PEOPLE})`, 'i'));
  if (one && !/(?:hours?|years?)\s/i.test(one[0])) {
    const n = Number(one[1]);
    const noun = one[2].toLowerCase();
    if (/couples/.test(noun)) return g({ exp: n * 2, said: `${n} couples`, note: `${n} couples counted as ${n * 2} guests.` });
    if (/families/.test(noun)) {
      const exp = Math.round(n * 3.5);
      return g({ exp, kids: Math.round(n * 1.5), said: `${n} families`, note: `${n} families counted as about ${exp} people, ${Math.round(n * 1.5)} of them kids. Change it below.` });
    }
    const childish = /kids|children|little ones|toddlers/.test(noun) || (/girls|boys/.test(noun) && (kidsParty || /sleepover|slumber/i.test(t)));
    if (childish) {
      const withParents = /\b(?:and|with|plus)\s+(?:their\s+)?(?:parents|moms|dads|families)\b/i.test(t);
      const adults = withParents ? n : Math.max(2, Math.round(n * 0.4));
      return g({ exp: n + adults, kids: n, said: `${n} kids`, note: `${n} kids were mentioned, so the plan adds about ${adults} adults${withParents ? ' (their parents)' : ' to help out'}, ${n + adults} guests in all. Change it below.` });
    }
    if (n >= 2) return g({ exp: n, said: `about ${n}` });
  }
  // "dinner for 8", "about 40", "party of 12"
  const bare = t.match(new RegExp(`\\b(?:for|about|around|roughly|approximately|approx\\.?|~|expecting|maybe|party of|table for|headcount(?: of)?|count of)\\s*(\\d{1,4})(?:\\s*-?ish)?\\b${NOT_PEOPLE_AFTER}`, 'i'));
  if (bare && Number(bare[1]) >= 4 && !/\$\s*$/.test(t.slice(0, (bare.index ?? 0) + bare[0].indexOf(bare[1])))) return g({ exp: Number(bare[1]), said: `about ${bare[1]}` });
  if (adultsOnly || kidsMentioned) return { exp: 0, min: 0, max: 0, kids: null, said: '', adultsOnly, kidsMentioned };
  return null;
}

// ─── Time ────────────────────────────────────────────────────────

interface TimeHit { start?: string; hours?: number; said: string[]; untilLate?: boolean; allDay?: boolean }

/** Hour without am/pm: "at 7" is 7 PM for a party, "at 10" is 10 AM unless it's an evening event. */
function hour24(h: number, ampm: string | undefined, eveningLean: boolean): number {
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (h === 12) return pm ? 12 : 0;
    return pm ? h + 12 : h;
  }
  if (h > 12) return h; // 24-hour clock
  if (h === 12) return 12;
  if (h >= 9 && h <= 11) return eveningLean ? h + 12 : h;
  return h + 12;
}

function readTime(t: string, eveningLean: boolean): TimeHit {
  const out: TimeHit = { said: [] };
  const AMPM = '(am|pm|a\\.m\\.?|p\\.m\\.?)';
  // "from 2 to 6", "2-7pm", "6pm until 12am", "between 1 and 4"
  const span = t.match(new RegExp(`\\b(from|between)?\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*${AMPM}?\\s*(?:-|–|to|until|till|and)\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*${AMPM}?(?!\\s*(?:${PEOPLE.slice(3, -1)}|hours?|years?|\\d))`, 'i'));
  if (span && (span[1] || span[4] || span[7]) && Number(span[2]) <= 23 && Number(span[5]) <= 23 && (!/between/i.test(span[1] ?? '') || span[4] || span[7] || Number(span[2]) <= 12)) {
    const endAmpm = span[7], startAmpm = span[4] ?? (endAmpm && Number(span[2]) <= Number(span[5]) && Number(span[5]) !== 12 ? endAmpm : undefined);
    const h1 = hour24(Number(span[2]), startAmpm, eveningLean);
    let h2 = hour24(Number(span[5]), endAmpm ?? (h1 >= 12 && Number(span[5]) < 12 ? 'pm' : undefined), eveningLean);
    if (endAmpm && /a/i.test(endAmpm) && h2 <= h1) h2 += 24; // until 2am
    if (h2 <= h1) h2 += 12;
    out.start = hhmm(h1, Number(span[3] ?? 0));
    out.hours = Math.max(1, Math.min(16, h2 + Number(span[6] ?? 0) / 60 - h1 - Number(span[3] ?? 0) / 60));
    out.said.push(`Time: ${clock(out.start)} to ${clock(hhmm(h2 % 24, Number(span[6] ?? 0)))}`);
    return out;
  }
  // "at 7", "starts at 2", "kicks off at 8pm", "7:30pm"
  const at = t.match(new RegExp(`\\b(?:at|@|starts?(?:ing)?(?:\\s+at)?|start time(?: is)?|kicks?(?:ing)? off(?:\\s+at)?|begins?(?:ning)?(?:\\s+at)?|arrive(?:\\s+at)?|doors?(?: open)?(?:\\s+at)?)\\s+(\\d{1,2})(?:[:.](\\d{2}))?\\s*${AMPM}?\\b${NOT_PEOPLE_AFTER.replace('|pm|am|p\\\\.m|a\\\\.m', '')}`, 'i'))
    ?? t.match(new RegExp(`\\b(\\d{1,2})(?:[:.](\\d{2}))?\\s*${AMPM}`, 'i'));
  if (at && Number(at[1]) <= 23 && !(at[3] === undefined && /\$\s*$/.test(t.slice(0, at.index ?? 0)))) {
    const h = hour24(Number(at[1]), at[3], eveningLean);
    out.start = hhmm(h, Number(at[2] ?? 0));
    out.said.push(`Starts at ${clock(out.start)}`);
    // "until 11", "till midnight", "until late"
    const until = t.slice((at.index ?? 0) + at[0].length).match(new RegExp(`\\b(?:until|till|'til|to|ends? at)\\s+(\\d{1,2})(?:[:.](\\d{2}))?\\s*${AMPM}?\\b`, 'i'));
    if (until) {
      let h2 = hour24(Number(until[1]), until[3] ?? (h >= 12 && Number(until[1]) < 12 ? 'pm' : undefined), eveningLean);
      if (until[3] && /a/i.test(until[3]) && h2 <= h) h2 += 24;
      if (h2 <= h) h2 += 12;
      out.hours = Math.max(1, Math.min(16, h2 - h));
      out.said.push(`Ends at ${clock(hhmm(h2 % 24, Number(until[2] ?? 0)))}`);
    }
  }
  if (/\buntil late\b|\btill late\b|\blate night\b|\binto the night\b/i.test(t)) out.untilLate = true;
  if (/\ball[- ]day\b/i.test(t)) out.allDay = true;
  // "3 hours", "2.5 hrs", "a 4-hour party"
  const dur = t.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:-|\s)?(?:hours?|hrs?|h)\b(?!\s*(?:drive|away|before|after|early|ahead|notice))/i);
  if (dur && out.hours === undefined) { out.hours = Number(dur[1]); out.said.push(`${out.hours} hours`); }
  return out;
}

/** A start time from words like "brunch" or "Saturday afternoon", fitted to the kind of party. */
function dayPartStart(t: string, profileStart: string): string | null {
  const ps = Number(profileStart.slice(0, 2));
  if (/\bbreakfast\b/i.test(t)) return '09:00';
  if (/\bmorning\b/i.test(t)) return ps < 12 && ps >= 9 ? profileStart : '10:00';
  if (/\blunch ?time\b|\bmidday\b/i.test(t)) return '12:00';
  if (/\bafternoon\b/i.test(t)) return ps >= 12 && ps < 17 ? profileStart : '14:00';
  if (/\bsunset\b|\bgolden hour\b/i.test(t)) return '18:00';
  if (/\bevening\b/i.test(t)) return ps >= 17 && ps < 21 ? profileStart : '18:00';
  if (/\bnight\b/i.test(t) && !/game night|movie night|card night|trivia night|bingo night|date night/i.test(t)) return ps >= 18 ? profileStart : '19:00';
  return null;
}

// ─── Dates said loosely ──────────────────────────────────────────

const monthOf = (w: string) => MONTHS.indexOf(w.slice(0, 3).toLowerCase());

/** "mid-December", "early March", "the first weekend of December", "in April", "Saturday the 21st", "next month" */
function parseLooseDate(t: string): DateHit | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sat = (y: number, m: number, fromDay: number) => { const d = new Date(y, m, fromDay); while (d.getDay() !== 6) d.setDate(d.getDate() + 1); return d; };
  const lastWeekday = (y: number, m: number, wd: number) => { const d = new Date(y, m + 1, 0); while (d.getDay() !== wd) d.setDate(d.getDate() - 1); return d; };
  const inFuture = (make: (y: number) => Date, said: string): DateHit => {
    let d = make(today.getFullYear());
    let rolled = false;
    if (d < today) { d = make(today.getFullYear() + 1); rolled = true; }
    return { date: toISO(d), said, rolled, past: false };
  };
  // "the first weekend of December", "the last Friday in May", "the 2nd Saturday of June"
  const nth = t.match(new RegExp(`\\b(1st|2nd|3rd|4th|last)\\s+(weekend|${WEEKDAYS.join('|')})\\s+(?:of|in)\\s+${MONTH_RE}\\b`, 'i'));
  if (nth) {
    const m = monthOf(nth[3]);
    const wd = nth[2].toLowerCase() === 'weekend' ? 6 : WEEKDAYS.indexOf(nth[2].toLowerCase());
    return inFuture((y) => {
      if (/last/i.test(nth[1])) return lastWeekday(y, m, wd);
      const d = new Date(y, m, 1);
      while (d.getDay() !== wd) d.setDate(d.getDate() + 1);
      d.setDate(d.getDate() + 7 * (Number(nth[1][0]) - 1));
      return d;
    }, nth[0]);
  }
  // "early March", "mid-December", "late October", "the end of May"
  const part = t.match(new RegExp(`\\b(early|beginning of|start of|mid|middle of|late|end of|the end of)[- ]+${MONTH_RE}\\b`, 'i'));
  if (part) {
    const m = monthOf(part[2]);
    const w = part[1].toLowerCase();
    return inFuture((y) => (/early|beginning|start/.test(w) ? sat(y, m, 1) : /mid|middle/.test(w) ? sat(y, m, 12) : lastWeekday(y, m, 6)), part[0]);
  }
  // "Saturday the 21st", "on the 21st"
  const dom = t.match(new RegExp(`\\b(?:(${WEEKDAYS.join('|')})\\s*,?\\s+)?the\\s+(\\d{1,2})(?:st|nd|rd|th)\\b(?!\\s+(?:of\\s+)?${MONTH_RE})(?!\\s+(?:birthday|bday|anniversary|annual|year|weekend|${WEEKDAYS.join('|')}))`, 'i'));
  if (dom && Number(dom[2]) >= 1 && Number(dom[2]) <= 31) {
    const day = Number(dom[2]);
    const wd = dom[1] ? WEEKDAYS.indexOf(dom[1].toLowerCase()) : -1;
    for (let k = 0; k < 14; k++) {
      const d = new Date(today.getFullYear(), today.getMonth() + k, day);
      if (d.getDate() !== day || d < today) continue;
      if (wd >= 0 && d.getDay() !== wd) continue;
      return { date: toISO(d), said: dom[0].trim(), rolled: false, past: false };
    }
  }
  // "next month", "end of the month"
  if (/\bnext month\b/i.test(t)) { const d = sat(today.getFullYear(), today.getMonth() + 1, 8); return { date: toISO(d), said: 'next month', rolled: false, past: false }; }
  if (/\b(?:end of (?:the|this) month|later this month)\b/i.test(t)) {
    let d = lastWeekday(today.getFullYear(), today.getMonth(), 6);
    if (d < today) d = lastWeekday(today.getFullYear(), today.getMonth() + 1, 6);
    return { date: toISO(d), said: 'the end of the month', rolled: false, past: false };
  }
  // "in April", "this December", "sometime in June": a Saturday around the middle of that month
  const mo = t.match(new RegExp(`\\b(?:in|this|next|during|sometime in|some time in)\\s+${MONTH_RE}\\b(?!\\s*\\d)`, 'i'));
  if (mo) {
    const m = monthOf(mo[1]);
    return inFuture((y) => sat(y, m, 8), mo[0]);
  }
  return null;
}

/** The weekday a host prefers without giving a date: "on a Friday", "Sunday afternoon", "a Saturday night". */
function preferredWeekday(t: string): number | null {
  const m = t.match(new RegExp(`\\b(?:a|any|some|on a|on)\\s+(${WEEKDAYS.join('|')})\\b|\\b(${WEEKDAYS.join('|')})\\s+(?:morning|afternoon|evening|night|brunch|lunch|dinner)\\b`, 'i'));
  return m ? WEEKDAYS.indexOf((m[1] ?? m[2]).toLowerCase()) : null;
}

function nextWeekdayAfter(days: number, wd: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  while (d.getDay() !== wd) d.setDate(d.getDate() + 1);
  return toISO(d);
}

// ─── Fields and defaults ─────────────────────────────────────────

/** Which parts of the plan the description actually said (the rest come from defaults). */
export type Field = 'type' | 'date' | 'time' | 'duration' | 'guests' | 'kids' | 'budget' | 'setting' | 'venue' | 'food' | 'drinks' | 'theme' | 'dietary' | 'helpers';

export interface DefaultsCtx {
  text: string; // normalized description
  birthday: boolean;
  age: number | null;
  kidsParty: boolean;
  occasion?: { start?: string; hours?: number; theme?: string; label: string };
  adultsOnly: boolean;
  kidsMentioned: boolean;
  untilLate?: boolean;
  allDay?: boolean;
  foodMentionedAsMeal?: boolean;
}

const roundGuests = (n: number) => (n >= 20 ? Math.round(n / 5) * 5 : Math.max(2, Math.round(n)));

/**
 * Fills every field the description did not give with values that fit the kind of party, and explains each one.
 * Used by the built-in reader and after AI reads a description, so both make the same sensible choices.
 */
export function completeDraft(draft: Draft, stated: Set<Field>, ctx: DefaultsCtx): { draft: Draft; notes: string[]; profile: Profile } {
  const d: Draft = { ...draft };
  const notes: string[] = [];
  const p = profileFor({ text: ctx.text, type: d.type, birthday: ctx.birthday, age: ctx.age, kidsParty: ctx.kidsParty });
  const why = p.label;

  // Guests and kids
  if (!stated.has('guests')) {
    const exp = roundGuests(p.guests * sizeFactor(ctx.text));
    d.guestExpected = exp;
    d.guestMin = Math.max(1, Math.round(exp * 0.8));
    d.guestMax = Math.round(exp * 1.2);
    notes.push(`No guest count was given, so the plan starts with ${exp} guests, typical for ${why}${sizeFactor(ctx.text) !== 1 ? ` (${sizeFactor(ctx.text) < 1 ? 'kept small' : 'sized up'} as you described)` : ''}.`);
  }
  if (!stated.has('kids')) {
    const atWork = /\b(?:office|coworkers?|co-workers?|colleagues|employees|staff|company|corporate|team (?:lunch|dinner|event|building)|work (?:party|event|lunch|dinner))\b/i.test(ctx.text) || /^team |^office /i.test(d.type);
    const share = ctx.adultsOnly || (atWork && !ctx.kidsMentioned) ? 0 : ctx.kidsMentioned ? Math.max(0.2, p.kidsShare) : p.kidsShare;
    d.children = Math.min(d.guestExpected, Math.round(d.guestExpected * share));
    d.childPct = d.guestExpected ? Math.round((d.children / d.guestExpected) * 100) : 0;
    if (d.children > 0) notes.push(ctx.kidsMentioned && p.kidsShare < 0.2 ? `Kids were mentioned without a number, so about ${d.children} are planned. Change it in Guests.` : `About ${d.children} kids are planned, usual for ${why}. Change it in Guests.`);
  } else d.childPct = d.guestExpected ? Math.round((d.children / d.guestExpected) * 100) : 0;

  // Time and length
  if (!stated.has('time')) {
    const fromWords = dayPartStart(ctx.text, ctx.occasion?.start ?? p.start);
    d.startTime = fromWords ?? (ctx.allDay ? '11:00' : ctx.occasion?.start ?? p.start);
    notes.push(fromWords ? `Start time set to ${clock(d.startTime)} from your description. Change it below.` : `No start time was given, so it starts at ${clock(d.startTime)}, usual for ${why}.`);
  }
  if (!stated.has('duration')) {
    d.durationHrs = ctx.allDay ? 8 : ctx.untilLate ? Math.max(5, ctx.occasion?.hours ?? p.hours) : ctx.occasion?.hours ?? p.hours;
    notes.push(`Planned as ${d.durationHrs} hours${ctx.allDay ? ' (all day)' : ctx.untilLate ? ' (until late)' : ''}. Drinks and ice scale with this.`);
  }

  // Food and drinks, in the boxes the plan is built from
  if (!stated.has('food')) {
    d.foodText = p.food;
    notes.push(ctx.foodMentionedAsMeal ? `A meal was mentioned but not what, so Food starts with ${p.food}. Change it under Food.` : `No food was mentioned, so Food starts with ${p.food}, usual for ${why}. Change it under Food.`);
  }
  const soft = p.drinks;
  if (!stated.has('drinks')) {
    d.drinksText = soft;
    notes.push(`No drinks were mentioned, so Drinks starts with ${soft}${/kids|baby|sleepover/.test(p.key) ? '' : '. No alcohol is planned unless you add it'}.`);
    if (p.key === 'nye') notes.push('Tip: add champagne or sparkling cider under Drinks for the midnight toast.');
  } else if (d.drinksText && !/water|soda|juice|lemonade|coffee|\btea\b|punch|seltzer|sparkling/i.test(d.drinksText)) {
    // Only alcohol was named: keep water and soft drinks alongside it
    d.drinksText = `${d.drinksText}, water, soda`;
    notes.push('Water and soda were added alongside the drinks you named.');
  }

  // Budget fits the party, the guests and the drinks
  if (!stated.has('budget')) {
    const alcohol = /full bar|open bar|cocktail|liquor|spirits|margarita/i.test(d.drinksText) ? 'full-bar' : /byob|bring your own/i.test(d.drinksText) ? 'byob' : /beer|wine|champagne|prosecco|mimosa|sangria|seltzer/i.test(d.drinksText) ? 'beer-wine' : 'none';
    d.budget = defaultBudget(p, d.guestExpected, d.children, alcohol);
    notes.push(`No budget was given, so it starts at $${d.budget.toLocaleString()} for ${d.guestExpected} guests, typical for ${why}${alcohol === 'full-bar' ? ' with a bar' : alcohol === 'beer-wine' ? ' with beer and wine' : ''}.`);
  }

  // Theme
  if (!stated.has('theme')) {
    d.theme = ctx.occasion?.theme ?? p.theme;
    notes.push(`No theme was given, so it starts as "${d.theme}". Change it under More details.`);
  }

  // Where
  if (!stated.has('setting') && p.setting) d.setting = p.setting;
  if (!stated.has('venue')) {
    d.venue = /\bpool\b(?!\s*hall)/i.test(ctx.text) && p.venue === 'Home' ? 'Pool' : p.venue === 'Home' && d.setting === 'outdoors' ? 'Backyard' : p.venue;
    notes.push(d.venue === 'Pool' ? 'A pool was mentioned but not where, so the location is listed as "Pool". Add the address anytime.' : `No location was given, so it is listed as "${d.venue}"${p.setting === 'outdoors' && !stated.has('setting') ? ', outdoors' : ''}. You can change it anytime.`);
  } else if (!stated.has('setting') && !p.setting) notes.push('Indoor or outdoor was not mentioned, so the plan assumes indoors.');

  return { draft: d, notes, profile: p };
}

export function parseDescription(text: string): ParseResult {
  const t = ` ${normalize(text)} `;
  const found: string[] = [];
  const notes: string[] = []; // how things the description said were read
  const stated = new Set<Field>();

  // Occasion: a known holiday or event, a birthday (with the age when given), or the words before "party"
  let type = '';
  let occasion: Occasion | undefined;
  const ageM = t.match(/\b(\d{1,3})(?:st|nd|rd|th)\s+(?:birthday|bday|b-day)/i) ?? t.match(/\bturn(?:s|ing)\s+(\d{1,3})\b/i) ?? t.match(/\b(\d{1,2})[- ]?(?:year|yr)[- ]?old(?:'s|’s)?\s+(?:birthday|bday|party)/i);
  const age = ageM ? Number(ageM[1]) : null;
  const birthday = /birthday|bday|b-day|\bturn(?:s|ing)\s+\d/i.test(t);
  if (birthday) type = age ? `${ordinal(age)} birthday party` : 'Birthday party';
  occasion = OCCASIONS.find((o) => o.re.test(t));
  if (occasion && (!birthday || occasion.when)) type = birthday ? `${occasion.label.replace(/ party$/i, '')} birthday party` : occasion.label;
  if (birthday && occasion?.when) type = `${age ? `${ordinal(age)} birthday` : 'Birthday'} ${occasion.label.replace(/^\w/, (c) => c.toLowerCase())}`;
  if (birthday && occasion && !occasion.when) occasion = occasion.kids ? occasion : undefined;
  const bdayKind = birthday && t.match(/\b(pool|dance|slumber|pajama|costume|karaoke|swim|skate|bowling|spa|tea|garden|beach|game|movie|paint|glow|disco|luau|camping|dinner|brunch)\s+(party|night|day)\b/i);
  if (bdayKind && !new RegExp(bdayKind[1], 'i').test(type)) type = `${type.replace(/ party$/i, '')} ${bdayKind[1].toLowerCase()} ${bdayKind[2].toLowerCase()}`;
  // Keep the host's own word for the kind of gathering: "Diwali dinner", "Christmas brunch", "Eid lunch"
  if (occasion && !birthday && / party$/i.test(type)) {
    const core = type.replace(/ party$/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kind = t.match(new RegExp(`${core.split(' ')[0]}[\\w'’ ]{0,12}?\\s(dinner|brunch|lunch|luncheon|potluck|cookout|bbq|gathering|celebration|bash|get[- ]together)\\b`, 'i'));
    if (kind) type = `${type.replace(/ party$/i, '')} ${kind[1].toLowerCase().replace('bbq', 'cookout')}`;
  }
  if (occasion?.label === 'Club event') {
    const club = t.match(/\b([a-z]+\s+club)(?:\s+(dinner|lunch|brunch|meeting|party|night|social|potluck))?\b/i);
    if (club && !/^(?:the|our|my|a)\s/i.test(club[1])) type = `${club[1]}${club[2] ? ` ${club[2]}` : ' meeting'}`.replace(/^\w/, (c) => c.toUpperCase());
  }
  // A work lunch, a team dinner: the meal says more than "work event"
  if (occasion?.label === 'Work event') {
    const meal = t.match(/\b(lunch|dinner|breakfast|brunch|happy hour|holiday party|offsite|outing)\b/i);
    if (meal) type = /holiday/i.test(meal[1]) ? 'Office holiday party' : `Team ${meal[1].toLowerCase()}`;
  }
  if (!type) {
    // "a murder mystery party", "an ugly sweater party", "a 90s night", "lunch for the team"
    const m = t.match(/\b((?:[\w'’-]+\s+){1,3}?)(party|bash|celebration|get[- ]together|gathering|shindig|soir[eé]e|night|dinner|lunch|luncheon|breakfast|festival|fest|happy hour)\b/i);
    if (m) {
      const words = m[1].trim().split(/\s+/);
      while (words.length && NOT_OCCASION.test(words[0])) words.shift();
      if (words.length && !words.every((w) => NOT_OCCASION.test(w))) type = `${words.join(' ')} ${m[2].toLowerCase()}`.replace(/^\w/, (c) => c.toUpperCase());
      else if (!/party|night/i.test(m[2])) type = m[2].replace(/get[- ]together/i, 'Get-together').replace(/^\w/, (c) => c.toUpperCase());
    } else {
      const meal = t.match(/^\s*(?:a\s+|an\s+)?(lunch|dinner|breakfast|brunch|happy hour)\b/i);
      if (meal) type = meal[1][0].toUpperCase() + meal[1].slice(1).toLowerCase();
    }
    if (/^(?:team|office|work) lunch$/i.test(type)) type = 'Team lunch';
    if (/^(?:lunch|dinner|breakfast|happy hour)$/i.test(type) && /\b(?:team|office|coworkers?|co-workers?|colleagues|staff|employees|department|company)\b/i.test(t)) type = `Team ${type.toLowerCase()}`;
  }
  // "Christmas Eve dinner", "New Year's Day brunch" keep their own day in the name
  if (/\bchristmas eve\b/i.test(t) && /^christmas\b/i.test(type)) type = type.replace(/^christmas/i, 'Christmas Eve');
  if (/surprise/i.test(t) && type && !/surprise/i.test(type)) type = `Surprise ${type.replace(/^\w/, (c) => c.toLowerCase())}`;
  const kidsParty = !!occasion?.kids
    || /\bkids'?\s+(?:birthday|party|bday)\b|\bchildren'?s\s+(?:birthday|party)\b/i.test(t)
    || (birthday && ((age !== null && age <= 12) || (age === null && /\b(?:son|daughter|niece|nephew|grandson|granddaughter|toddler|little one|kid'?s)\b/i.test(t))));
  if (type) { found.push(`Occasion: ${type}`); stated.add('type'); }
  else {
    type = 'Party';
    notes.push('No occasion was mentioned, so it is set up as a party. Rename it below if you like.');
  }
  const honoree = findHonoree(t);
  if (honoree) found.push(`For ${honoree}`);

  // Guests and kids
  const g = readGuests(t, kidsParty);
  let gMin = 0, gExp = 0, gMax = 0, children = 0;
  if (g && g.exp > 0) {
    ({ min: gMin, exp: gExp, max: gMax } = g);
    stated.add('guests');
    found.push(`Guests: ${g.said}`);
    if (g.note) notes.push(g.note);
  }
  if (g?.kids !== null && g?.kids !== undefined) { children = Math.min(gExp, g.kids); stated.add('kids'); found.push(`Kids: ${children}`); }
  else if (g?.adultsOnly) { stated.add('kids'); found.push('Adults only'); }

  // Budget: "$1,500", "1.5k", "$25 per person", "under $800", "budget is 2000"
  let budget = 0;
  const perHead = t.match(/\$\s?(\d+(?:\.\d+)?)\s*(?:per|a|\/|each)\s*(?:person|guest|head|plate|ticket|attendee)/i);
  const NUM = '(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)\\s*(k)?';
  const dollars = [...t.matchAll(new RegExp(`\\$\\s?${NUM}`, 'gi'))].find((m) => !perHead || m.index !== perHead.index);
  const words = t.match(new RegExp(`\\b${NUM}\\s*(?:dollars|bucks|usd)\\b`, 'i')) ?? t.match(new RegExp(`\\b(?:budget|spend|spending)\\b[^.$\\d]{0,25}?${NUM}(?!\\s*(?:${PEOPLE.slice(3, -1)}|hours?))\\b`, 'i')) ?? t.match(new RegExp(`\\b${NUM}\\s+budget\\b`, 'i'));
  const bm = dollars ?? words;
  if (bm) {
    budget = Math.round(Number(bm[1].replace(/,/g, '')) * (bm[2] ? 1000 : 1));
    const capped = /\b(?:under|max(?:imum)?|no more than|at most|less than|up to|tops)\s*\$?\s*$/i.test(t.slice(0, (bm.index ?? 0) + bm[0].indexOf(bm[1])).replace(/\$\s*$/, ''));
    found.push(`Budget: ${capped ? 'up to ' : ''}$${budget.toLocaleString()}`);
    stated.add('budget');
  } else if (perHead && gExp) {
    budget = Math.round(Number(perHead[1]) * gExp);
    found.push(`Budget: $${perHead[1]} per guest`);
    notes.push(`$${perHead[1]} per guest for ${gExp} guests gives a budget of $${budget.toLocaleString()}.`);
    stated.add('budget');
  }

  // Theme
  let theme = '';
  const th = t.match(/(?:theme(?:d)?\s*(?:is|of|:)?\s*|([\w-]+(?:\s[\w-]+){0,2})\s+theme)([\w\s-]{0,30}?)(?=[,.;]|$| and | with )/i);
  if (th) theme = (th[1] ?? th[2] ?? '').trim().replace(/^(a|an|the|with|and)\s+/i, '');
  const colors = t.match(/\b((?:[a-z]+\s+and\s+)?[a-z]+)\s+colors?\b/i);
  if (!theme && colors && !/school|team|favorite|her|his|their/i.test(colors[1])) theme = colors[1];
  if (!theme && /simple decor/i.test(t)) theme = 'Simple';
  if (theme) {
    theme = theme[0].toUpperCase() + theme.slice(1);
    found.push(`Theme: ${theme}`);
    stated.add('theme');
  }
  const extras = EXTRAS.filter(([re]) => re.test(t)).map(([, w]) => w).filter((w, _i, all) => !(w === 'costumes' && all.includes('costume contest')));
  if (extras.length) found.push(`Extras: ${extras.join(', ')}`);

  const tNoTheme = th ? t.replace(th[0], ' ') : t;

  // Setting and venue
  const place = findVenue(tNoTheme);
  const where = `${place.venue} ${tNoTheme}`;
  const SURELY_INDOOR = /trampoline|bowling|arcade|(?:skating|ice) rink|escape room|museum|theat(?:er|re)|cinema|hotel|ballroom|banquet|event hall|\bhall\b|community (?:center|room)|church|temple|mosque|synagogue|library|restaurant|brewery|winery tasting room|\bbar\b|lounge|cafe|clubhouse|studio|gym|office|conference/i;
  const OUTDOOR = /outdoor|outside|backyard|back yard|\byard\b|\bpark\b|garden|patio|beach|tailgat|lawn|picnic|rooftop|roof ?deck|\broof\b|terrace|pool(?!\s*hall)|\bdeck\b|courtyard|vineyard|campground|campsite|camping|lake|farm\b|ranch|street|block party|cul-de-sac|field\b|trail/i;
  const INDOOR = /indoor|inside|\broom\b|garage|basement|kitchen|living room|apartment|condo|\bhouse\b|\bhome\b|my place|our place|\bplace\b/i;
  let setting: Setting = 'indoors';
  if (/\b(?:indoors?|inside)\b/i.test(t) && !/\boutdoors?\b|\boutside\b/i.test(t)) { found.push('Indoors'); stated.add('setting'); }
  else if (/\b(?:outdoors?|outside|al fresco|open air)\b/i.test(t)) { setting = 'outdoors'; found.push('Outdoors'); stated.add('setting'); }
  else if (place.venue && SURELY_INDOOR.test(place.venue)) { found.push('Indoors'); stated.add('setting'); }
  else if (place.venue && OUTDOOR.test(place.venue)) { setting = 'outdoors'; found.push('Outdoors'); stated.add('setting'); }
  else if (OUTDOOR.test(where) && !SURELY_INDOOR.test(where)) { setting = 'outdoors'; found.push('Outdoors'); stated.add('setting'); }
  else if (place.venue && INDOOR.test(place.venue)) { found.push('Indoors'); stated.add('setting'); }
  let venue = place.venue;
  if (place.city) venue = venue ? `${venue}, ${place.city}` : place.city;
  if (venue) { found.push(`Place: ${venue}`); stated.add('venue'); }
  const cap = t.match(/(?:holds|capacity(?: of)?|fits|room for)\s*(\d{2,4})/i);
  const venueCapacity = cap ? Number(cap[1]) : Math.max(gMax + 10, Math.ceil((gMax * 1.25) / 5) * 5);

  // Date
  const hit = parseDate(t) ?? parseHolidayDate(t) ?? parseLooseDate(t);
  const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const wdPref = preferredWeekday(t);
  const placeholder = () => (wdPref !== null ? nextWeekdayAfter(42, wdPref) : nextSaturdayAfter(42));
  let date: string;
  // A holiday party in a loosely given month ("Halloween party in late October") goes on the holiday's party date
  const loose = hit && parseLooseDate(t)?.date === hit.date && !parseDate(t) && !parseHolidayDate(t);
  if (loose && occasion && holidayPartyDate(occasion) && Math.abs(new Date(holidayPartyDate(occasion)!).getTime() - new Date(hit!.date).getTime()) < 20 * 864e5) {
    date = holidayPartyDate(occasion)!;
    found.push(`Date: ${longDate(date)}`);
    notes.push(`"${hit!.said}" was read as ${longDate(date)}, around ${occasionPhrase(occasion.label)}.`);
    stated.add('date');
  } else if (hit && !hit.past) {
    date = hit.date;
    found.push(`Date: ${longDate(date)}`);
    stated.add('date');
    if (hit.rolled) notes.push(`"${hit.said}" has already passed this year, so the date is set to ${longDate(date)}. Change it if you meant a different year.`);
    else if (loose || /^(this|next|coming|on)\b|weekend|tomorrow|^in\s|before|after|eve\b|night|day$|the \d/i.test(hit.said)) notes.push(`"${hit.said}" was read as ${longDate(date)}.`);
  } else if (hit && hit.past) {
    date = placeholder();
    notes.push(`The date you gave (${hit.said}) has already passed, so a placeholder date of ${longDate(date)} is used. Enter the right date below.`);
  } else if (occasion && holidayPartyDate(occasion, /christmas (?:day|dinner|morning|lunch|brunch)/i.test(t))) {
    date = holidayPartyDate(occasion, /christmas (?:day|dinner|morning|lunch|brunch)/i.test(t))!;
    notes.push(`No date was given, so it is set for ${longDate(date)}, around ${occasion.label.replace(/ (party|celebration|dinner|brunch|cookout)$/i, '')}. Change it below.`);
  } else {
    date = placeholder();
    notes.push(`No date was found, so a ${WEEKDAYS[new Date(`${date}T12:00:00`).getDay()].replace(/^\w/, (c) => c.toUpperCase())} about six weeks away (${longDate(date)}) is used as a placeholder.`);
  }

  // Time: read before defaults so "at 9" for a brunch means morning
  const eveningLean = !/brunch|breakfast|morning|lunch|coffee|tea party|shower|picnic|tailgate|easter|1st birthday/i.test(`${type} ${t}`) || /evening|night|dinner|nye|new year'?s eve/i.test(t);
  const time = readTime(t, eveningLean);
  let startTime = '18:00';
  let durationHrs = 4;
  if (time.start) { startTime = time.start; stated.add('time'); }
  if (time.hours !== undefined) { durationHrs = time.hours; stated.add('duration'); }
  found.push(...time.said);

  // Food
  const mentions: [RegExp, FoodFormat][] = [
    [/taco/i, 'taco-bar'], [/bbq|barbecue|grill|burger|hot ?dog|cookout/i, 'bbq'], [/potluck|bring a dish/i, 'potluck'],
    [/appetizer|finger food|hors d|snacks?\b|light bites|canap/i, 'appetizers'], [/buffet|cater/i, 'buffet'],
  ];
  const styles = mentions.map(([re, f]) => ({ f, at: t.search(re) })).filter((x) => x.at >= 0).sort((x, y) => x.at - y.at).map((x) => x.f);
  const foodText = foodWords(t, styles);
  if (foodText) { found.push(`Food: ${foodText}`); stated.add('food'); }
  const foodMentionedAsMeal = !foodText && /\bfood\b|\bmeal\b/i.test(t);

  // Drinks
  let alcohol: Alcohol = 'none';
  if (/no alcohol|alcohol[- ]free|dry party|no drinking|sober|mocktails? only/i.test(t)) alcohol = 'none';
  else if (/byob|bring (?:your|their) own (?:drinks|booze|alcohol|beer|wine)/i.test(t)) alcohol = 'byob';
  else if (/full bar|open bar|cocktails?\b|spirits|liquor|margaritas?|tequila|vodka|whiskey|bourbon/i.test(t) && !/cocktail (?:attire|dress)/i.test(t)) alcohol = 'full-bar';
  else if (/\bbeers?\b|\bwines?\b|alcohol|mimosas?|prosecco|champagne|sangria|hard seltzer|beer pong|keg\b/i.test(t)) alcohol = 'beer-wine';
  const softDrinks: SoftDrink[] = ['soda', 'water'];
  if (/juice|lemonade|punch/i.test(t)) softDrinks.push('juice');
  if (/coffee|\btea\b/i.test(t)) softDrinks.push('coffee-tea');
  const drinkSaid = /\bwater\b(?!melon)|soda|\bpop\b|lemonade|punch|horchata|agua fresca|iced tea|\btea\b|juice|coffee|beers?\b|wines?\b|prosecco|champagne|mimosa|cocktail|margarita|open bar|full bar|spirits|liquor|byob|bring (?:your|their) own|cider|cocoa|hot chocolate|eggnog|sangria|seltzer|mocktail|keg\b|beer pong|no alcohol|alcohol[- ]free|dry party/i.test(t);
  let drinksText = drinkSaid ? drinkWords(t, alcohol, softDrinks) : '';
  if (/no alcohol|alcohol[- ]free|dry party|sober/i.test(t)) { found.push('No alcohol'); if (!drinksText || drinksText === 'water, soda') drinksText = ''; }
  if (/mocktail/i.test(t) && !/mocktail/i.test(drinksText)) drinksText = drinksText ? `${drinksText}, mocktails` : 'mocktails';
  if (drinksText) { found.push(`Drinks: ${drinksText}`); stated.add('drinks'); }

  // Dietary needs, with word edges so "minutes" or "donuts" don't read as a nut allergy
  const diet: string[] = [];
  for (const [re, label] of [
    [/vegetarian|\bveggie\b(?!\s*(?:tray|platter|burger|sticks))|meatless/i, 'vegetarian'], [/\bvegan\b|plant[- ]based/i, 'vegan'], [/gluten/i, 'gluten-free'],
    [/\bnuts?\b(?![- ]?(?:cracker|meg))|peanut|tree[- ]nut|nut[- ]free|nut allerg/i, 'nut allergy'], [/shellfish|seafood allerg/i, 'shellfish allergy'],
    [/halal/i, 'halal'], [/kosher/i, 'kosher'], [/dairy|lactose/i, 'dairy-free'], [/pescatarian/i, 'pescatarian'], [/no pork|pork[- ]free/i, 'no pork'],
    [/\bketo\b|low[- ]carb/i, 'low-carb'], [/diabetic|sugar[- ]free/i, 'low-sugar'],
  ] as [RegExp, string][]) if (re.test(t) && !diet.includes(label)) diet.push(label);
  const dietary = diet.length ? diet.join(', ') : 'No specific restrictions';
  if (diet.length) { found.push(`Dietary: ${diet.join(', ')}`); stated.add('dietary'); }

  // Helpers: real names only ("Me and my boyfriend Lucas" → Lucas; "me" is the host)
  const helpers: string[] = [];
  const after = t.match(/(?:help from|helped by|with the help of|helpers?\s*(?:are|is|:)|co-?hosts?\s*(?:are|is|:)|co-?hosting with)\s+([^.!?\n]+)/i);
  const before = t.match(/(?:^|[.!?\n]\s*|,\s*)([^.!?\n,]*?(?:\s(?:and|&)\s[^.!?\n,]*?)?)\s+(?:will|can|are going to|is going to|are|is)\s+(?:help|helping|be helping|co-?host)/i);
  const segment = after?.[1] ?? before?.[1] ?? '';
  const counted = t.match(/(\d+)\s+(?:friends|helpers|volunteers|roommates|teammates|co-?hosts|parents)\s*(?:to help|helping|who can help|will help)?/i);
  const fromSegment = segment ? extractNames(segment.replace(/\b(?:to|with|for|on|at|in|who|that)\b.*$/i, '')).names.filter(looksLikeName) : [];
  if (fromSegment.length) fromSegment.slice(0, 10).forEach((n) => helpers.push(n));
  else if (counted && /help|volunteer/i.test(t)) for (let i = 1; i <= Math.min(Number(counted[1]), 8); i++) helpers.push(`Helper ${i}`);
  if (helpers.length) { found.push(`Organizers: ${helpers.join(', ')}`); stated.add('helpers'); }
  const helperNote = helpers.length ? [] : ['No organizers were mentioned. Add names later to assign tasks and purchases.'];

  // Fill everything else with values that fit this kind of party
  const ctx: DefaultsCtx = {
    text: t, birthday, age, kidsParty, adultsOnly: !!g?.adultsOnly, kidsMentioned: !!g?.kidsMentioned,
    occasion: occasion ? { start: occasion.start, hours: occasion.hours, theme: occasion.theme, label: occasion.label } : undefined,
    untilLate: time.untilLate, allDay: time.allDay, foodMentionedAsMeal,
  };
  const partial: Draft = {
    name: '', type, date, startTime, durationHrs, venue, setting, venueCapacity, foodFormat: styles[0] ?? 'buffet', dietary, theme,
    budget, guestMin: gMin, guestExpected: gExp, guestMax: gMax, childPct: 0, children, helpers, foodText, drinksText,
    extraFood: styles.slice(1), alcohol, softDrinks, preferences: extras.length ? extras.map((e, i) => (i ? e : e[0].toUpperCase() + e.slice(1))).join(', ') : '',
  };
  const done = completeDraft(partial, stated, ctx);
  const d = done.draft;
  d.venueCapacity = cap ? Number(cap[1]) : Math.max(d.guestMax + 10, Math.ceil((d.guestMax * 1.25) / 5) * 5);
  if (stated.has('budget') && perHead && !bm) d.budget = Math.round(Number(perHead[1]) * d.guestExpected);

  // Suggested name: who it's for plus the occasion ("Leo's 7th Birthday Party"), with a costume note for costume parties
  let name = type === 'Party' ? (stated.has('theme') && theme !== 'Simple' ? `${theme.split(/[:,]/)[0]} Party` : 'Party') : type;
  if (/halloween/i.test(name) && extras.some((e) => /costume/.test(e)) && !/costume/i.test(name)) name = name.replace(/party/i, 'Costume Party');
  if (honoree) name = `${honoree}'s ${name.replace(/^(surprise )?/i, (m) => m.toLowerCase())}`.replace(/'s surprise /i, "'s Surprise ");
  name = titleCase(name);
  d.name = name;
  const nameNote = name !== 'Party' ? `Suggested the name "${name}". Change it below.` : 'Give your event a name below.';

  return { draft: d, assumptions: [nameNote, ...notes, ...done.notes, ...helperNote], found, stated: [...stated], ctx };
}

// ─── Names ───────────────────────────────────────────────────────

const RELATION = ['boyfriend', 'girlfriend', 'husband', 'wife', 'partner', 'fiance', 'fiancee', 'fiancé', 'fiancée', 'sister', 'brother', 'mom', 'mother', 'dad', 'father', 'friend', 'cousin', 'aunt', 'uncle', 'roommate', 'son', 'daughter', 'grandma', 'grandpa', 'neighbor', 'neighbour', 'coworker', 'colleague', 'bestie', 'bff'];
const SELF = /^(?:me|i|myself|us|we|you|the host)$/i;
const FILLER = /^(?:my|our|the|a|an|best|older|younger|little|big|good)$/i;
const VERBS = /\b(?:will|can|could|are|is|am|be|going|helping|help|helps|to|with|for|too|also|both)\b.*$/i;
const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

/**
 * Pulls helper names out of a phrase: "Me and my boyfriend Lucas" → ["Lucas"]; "my mom and Ana" → ["Mom", "Ana"].
 * "Me" (the host) is skipped and reported, because the host is always on the list as "You".
 */
export function extractNames(raw: string): { names: string[]; skippedSelf: boolean } {
  const names: string[] = [];
  let skippedSelf = false;
  for (let part of raw.split(/\s*(?:,|;|\/|&|\+|\band\b|\bplus\b)\s*/i)) {
    part = part.replace(VERBS, '').replace(/[“”"'()]/g, ' ').trim();
    if (!part) continue;
    if (SELF.test(part)) { skippedSelf = true; continue; }
    const words = part.split(/\s+/).filter((w) => !FILLER.test(w));
    if (!words.length) continue;
    const r = words.findIndex((w) => RELATION.includes(w.toLowerCase()) || RELATION.includes(w.toLowerCase().replace(/s$/, '')));
    let name: string;
    if (r >= 0 && r < words.length - 1) name = words.slice(r + 1).map(cap).join(' ');
    else if (r >= 0) name = cap(words[r].toLowerCase().replace(/s$/, ''));
    else name = words.map((w) => (w === w.toLowerCase() ? cap(w) : w)).join(' ');
    if (SELF.test(name)) { skippedSelf = true; continue; }
    if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  return { names, skippedSelf };
}

/** A short capitalised name, not a stray phrase from the description. */
function looksLikeName(n: string): boolean {
  const words = n.split(/\s+/);
  return words.length <= 3 && words.every((w) => /^[A-Z\u00C0-\u024F][\p{L}'-]*$/u.test(w)) && !/^(?:I|I'm|It|It's|This|There|We|They|Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)$/.test(n);
}

export const SAMPLE_DESCRIPTION =
  "I'm planning a casual outdoor graduation party in Los Angeles for around 40 to 60 people, including about 8 kids. It's on a Saturday afternoon from 2 to 7pm. My budget is $1,500. I want a taco bar, lavender and gold colors, and help from Sam, Priya and Jordan. A few guests are vegetarian.";

/** Food mentioned in the description, in plain words: styles first, then common dishes. */
function foodWords(t: string, styles: FoodFormat[]): string {
  const out = styles.map((f) => FOOD_SHORT[f]);
  for (const [re, w] of [[/pizza/i, 'pizza'], [/cupcake/i, 'cupcakes'], [/cookie/i, 'cookies'], [/sandwich|slider/i, 'sandwiches'], [/fruit/i, 'fruit tray'], [/salad/i, 'salad'], [/pasta|lasagna/i, 'pasta'], [/wings/i, 'wings'], [/ice cream/i, 'ice cream'], [/\bcake\b/i, 'cake'], [/pupusa/i, 'pupusas'], [/chili\b/i, 'chili'], [/nachos/i, 'nachos'], [/hot ?dogs?/i, 'hot dogs'], [/burgers?/i, 'burgers'], [/\bpie\b|pies\b/i, 'pie'], [/candy|candies/i, 'candy'], [/brownies?/i, 'brownies'], [/charcuterie|cheese board/i, 'charcuterie board'], [/chips|dip\b/i, 'chips and dip'], [/turkey/i, 'turkey'], [/ham\b/i, 'ham'], [/bbq|barbecue/i, 'barbecue'], [/curry/i, 'curry'], [/samosa/i, 'samosas'], [/empanada/i, 'empanadas'], [/paella/i, 'paella'], [/bagels?/i, 'bagels'], [/donuts?|doughnuts?/i, 'donuts'], [/pancakes?|waffles?/i, 'pancakes'], [/sliders?/i, 'sliders'], [/tamale/i, 'tamales'], [/sushi/i, 'sushi'], [/dumpling/i, 'dumplings']] as [RegExp, string][]) {
    if (re.test(t) && !out.includes(w) && !(w === 'barbecue' && styles.includes('bbq'))) out.push(w);
  }
  return out.join(', ');
}
/** Drinks mentioned in the description, in plain words. */
function drinkWords(t: string, alcohol: Alcohol, soft: SoftDrink[]): string {
  const out: string[] = [];
  for (const [re, w] of [[/\bwater\b(?!melon)/i, 'water'], [/soda|\bpop\b|soft drinks?|coke/i, 'soda'], [/lemonade/i, 'lemonade'], [/punch/i, 'punch'], [/horchata/i, 'horchata'], [/agua fresca/i, 'agua fresca'], [/iced tea/i, 'iced tea'], [/\bjuice/i, 'juice for kids'], [/coffee/i, 'coffee'], [/cider/i, 'cider'], [/hot (?:chocolate|cocoa)|\bcocoa\b/i, 'hot chocolate'], [/eggnog/i, 'eggnog'], [/sangria/i, 'sangria'], [/seltzer|sparkling water/i, 'sparkling water'], [/mulled wine/i, 'mulled wine'], [/\btea\b/i, 'tea'], [/\bbeers?\b/i, 'beer'], [/\bwines?\b/i, 'wine'], [/mimosas?/i, 'mimosas'], [/prosecco|champagne|bubbly/i, 'champagne'], [/cocktail|margarita|full bar|open bar|spirits|liquor/i, 'cocktails'], [/byob|bring (?:your|their) own/i, 'BYOB']] as [RegExp, string][]) {
    if (re.test(t) && !out.includes(w)) out.push(w);
  }
  if (out.includes('iced tea')) out.splice(out.indexOf('tea'), out.includes('tea') ? 1 : 0);
  if (!out.length) {
    // Nothing mentioned: start with the usual basics and any alcohol choice
    if (soft.includes('water')) out.push('water');
    if (soft.includes('soda')) out.push('soda');
    if (alcohol === 'beer-wine') out.push('beer', 'wine');
    if (alcohol === 'full-bar') out.push('cocktails');
    if (alcohol === 'byob') out.push('BYOB');
  }
  return out.join(', ');
}

export function emptyDraft(): Draft {
  return parseDescription('').draft;
}

export { addDays };
