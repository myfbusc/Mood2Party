import { addDays, toISO } from './tasks';
import { FOOD_SHORT } from './catalog';
import type { Alcohol, FoodFormat, Setting, SoftDrink } from './types';

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
const NOT_OCCASION = /^(?:a|an|the|my|our|his|her|their|small|big|large|little|huge|casual|fun|chill|nice|simple|fancy|outdoor|indoor|backyard|surprise|private|great|cool|planning|plan|throw|throwing|host|hosting|having|have|for|some|this|that|next|last|annual|yearly|first|cute|low[- ]key|intimate)$/i;

const titleCase = (t: string) =>
  t.replace(/(^|[\s-])([a-z])([\w'’]*)/g, (m, pre: string, a: string, rest: string, i: number) => (i > 0 && /^(?:and|or|of|the|a|an|in|on|at|for|to|with|de|los)$/.test(a + rest) ? m : pre + a.toUpperCase() + rest));

/** The holiday's date for a party: the day itself if it falls on a Friday or Saturday (or must be on the day), otherwise the Saturday before. */
function holidayPartyDate(o: Occasion): string | null {
  if (!o.when) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const on = (y: number) => (typeof o.when === 'function' ? o.when(y) : new Date(y, o.when!.month, o.when!.day));
  let day = on(today.getFullYear());
  if (day < today) day = on(today.getFullYear() + 1);
  if (o.onTheDay || day.getDay() === 5 || day.getDay() === 6) return toISO(day);
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

const clock = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`; };

function to24(h: number, ampm?: string) {
  if (!ampm) return h < 8 ? h + 12 : h; // "at 2" most likely means 2 PM for a party
  const pm = /p/i.test(ampm);
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

export function parseDescription(text: string): ParseResult {
  const t = ` ${text} `;
  const found: string[] = [];
  const assumptions: string[] = [];

  // Occasion: a known holiday or event, a birthday (with the age when given), or the words before "party"
  let type = '';
  let occasion: Occasion | undefined;
  const age = t.match(/\b(\d{1,3})(?:st|nd|rd|th)\s+(?:birthday|bday)/i) ?? t.match(/\bturn(?:s|ing)\s+(\d{1,3})\b/i);
  const birthday = /birthday|bday|\bturn(?:s|ing)\s+\d/i.test(t);
  if (birthday) type = age ? `${ordinal(Number(age[1]))} birthday party` : 'Birthday party';
  occasion = OCCASIONS.find((o) => o.re.test(t));
  if (occasion && (!birthday || occasion.when)) type = birthday ? `${occasion.label.replace(/ party$/i, '')} birthday party` : occasion.label;
  if (birthday && occasion?.when) type = `${age ? `${ordinal(Number(age[1]))} birthday` : 'Birthday'} ${occasion.label.replace(/^\w/, (c) => c.toLowerCase())}`;
  if (birthday && occasion && !occasion.when) occasion = undefined;
  // Keep the host's own word for the kind of gathering: "Diwali dinner", "Christmas brunch", "Eid lunch"
  if (occasion && !birthday && / party$/i.test(type)) {
    const core = type.replace(/ party$/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kind = t.match(new RegExp(`${core.split(' ')[0]}[\\w'’ ]{0,12}?\\s(dinner|brunch|lunch|luncheon|potluck|cookout|bbq|gathering|celebration|bash|get[- ]together)\\b`, 'i'));
    if (kind) type = `${type.replace(/ party$/i, '')} ${kind[1].toLowerCase().replace('bbq', 'cookout')}`;
  }
  if (!type) {
    // "a murder mystery party", "an ugly sweater party", "a 90s night": take the words in front
    const m = t.match(/\b((?:[\w'’-]+\s+){1,3}?)(party|bash|celebration|get[- ]together|gathering|shindig|soir[eé]e|night|dinner|lunch|luncheon|festival|fest)\b/i);
    if (m) {
      const words = m[1].trim().split(/\s+/);
      while (words.length && NOT_OCCASION.test(words[0])) words.shift();
      if (words.length && !words.every((w) => NOT_OCCASION.test(w))) type = `${words.join(' ')} ${m[2].toLowerCase()}`.replace(/^\w/, (c) => c.toUpperCase());
      else if (!/party|night/i.test(m[2])) type = m[2].replace(/get[- ]together/i, 'Get-together').replace(/^\w/, (c) => c.toUpperCase());
    }
  }
  if (/surprise/i.test(t) && type && !/surprise/i.test(type)) type = `Surprise ${type.replace(/^\w/, (c) => c.toLowerCase())}`;
  const kidsParty = !!occasion?.kids || (birthday && (/\b(?:son|daughter|niece|nephew|grandson|granddaughter)\b/i.test(t) || /\b\d+\s*(?:kids|children)\b/i.test(t) || (!!age && Number(age[1]) <= 12)));
  if (type) found.push(`Occasion: ${type}`);
  else {
    type = 'Party';
    assumptions.push('No occasion was mentioned, so it is set up as a party. Rename it below if you like.');
  }
  const honoree = findHonoree(t);
  if (honoree) found.push(`For ${honoree}`);

  // Guests
  let gMin = 0, gExp = 0, gMax = 0;
  const range = t.match(/(\d{1,4})\s*(?:-|–|to|or)\s*(\d{1,4})\s*(?:people|guests|persons|ppl|attendees|folks|kids|adults|members)/i);
  const single = t.match(/(?:about|around|roughly|approximately|~|maybe|expecting|for)\s*(\d{1,4})\s*(?:people|guests|persons|ppl|attendees|folks|members)?/i)
    ?? t.match(/(\d{1,4})\s*(?:people|guests|persons|ppl|attendees|folks|members)/i);
  if (range) {
    gMin = Number(range[1]);
    gMax = Number(range[2]);
    if (gMin > gMax) [gMin, gMax] = [gMax, gMin];
    gExp = Math.round((gMin + gMax) / 2);
    found.push(`Guests: ${gMin} to ${gMax}`);
    assumptions.push(`The plan is set for ${gExp} guests, the middle of your ${gMin} to ${gMax} range. You can change it anytime.`);
  } else if (!single && /\b(?:a )?dozen\b/i.test(t)) {
    gExp = /\b(?:two|2) dozen\b/i.test(t) ? 24 : 12;
    gMin = Math.round(gExp * 0.8);
    gMax = Math.round(gExp * 1.2);
    found.push(`Guests: about ${gExp}`);
  } else if (single && Number(single[1]) > 3) {
    gExp = Number(single[1]);
    gMin = Math.round(gExp * 0.8);
    gMax = Math.round(gExp * 1.2);
    found.push(`Guests: about ${gExp}`);
  } else if (t.match(/(\d{1,3})\s*(?:kids|children)/i)) {
    const k = Number(t.match(/(\d{1,3})\s*(?:kids|children)/i)![1]);
    const adults = /parents|moms|dads|families/i.test(t) ? k : Math.max(4, Math.round(k * 0.4));
    gExp = k + adults;
    gMin = Math.round(gExp * 0.8);
    gMax = Math.round(gExp * 1.2);
    found.push(`Guests: about ${gExp}`);
    assumptions.push(`${k} kids were mentioned, so the plan counts about ${adults} adults with them (${gExp} guests in all). Change it below.`);
  } else {
    gMin = 30; gExp = 40; gMax = 50;
    assumptions.push('No guest count was given, so the plan starts with 40 guests.');
  }

  // Children
  let childPct = 0;
  const kids = t.match(/(\d{1,3})\s*(?:kids|children|little ones)/i);
  if (kids) {
    childPct = Math.min(80, Math.round((Number(kids[1]) / Math.max(1, gExp)) * 100));
    found.push(`Kids: ${kids[1]}`);
  } else if (/\b(kids|children|family|families)\b/i.test(t)) {
    childPct = 20;
    assumptions.push(`Kids were mentioned without a number, so about ${Math.round(gExp * 0.2)} children are planned. Change it below.`);
  }

  // Budget
  let budget = 0;
  const b = t.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k)?/i) ?? t.match(/budget\s*(?:of|is|around|about)?\s*([\d,]+)\s*(k)?\s*(?:dollars)?/i);
  if (b) {
    budget = Number(b[1].replace(/,/g, '')) * (b[2] ? 1000 : 1);
    found.push(`Budget: $${(Number(b[1].replace(/,/g, '')) * (b[2] ? 1000 : 1)).toLocaleString()}`);
  }
  const perHead = t.match(/\$\s?(\d+)\s*(?:per|a|\/)\s*(?:person|guest|head)/i);
  if (perHead) budget = Number(perHead[1]) * gExp;
  if (!budget) {
    budget = Math.round((gExp * 30) / 50) * 50;
    assumptions.push(`No budget was given, so the plan uses about $30 per expected guest ($${budget.toLocaleString()}).`);
  }

  // Theme
  let theme = '';
  const th = t.match(/(?:theme(?:d)?\s*(?:is|of|:)?\s*|([\w-]+(?:\s[\w-]+){0,2})\s+theme)([\w\s-]{0,30}?)(?=[,.;]|$| and | with )/i);
  if (th) theme = (th[1] ?? th[2] ?? '').trim().replace(/^(a|an|the|with|and)\s+/i, '');
  const colors = t.match(/\b((?:[a-z]+\s+and\s+)?[a-z]+)\s+colors?\b/i);
  if (!theme && colors) theme = colors[1];
  if (!theme && /simple decor/i.test(t)) theme = 'Simple';
  if (theme) {
    theme = theme[0].toUpperCase() + theme.slice(1);
    found.push(`Theme: ${theme}`);
  } else if (occasion?.theme) {
    theme = occasion.theme;
    assumptions.push(`No theme was given, so it starts as "${theme}" to match ${occasionPhrase(occasion.label)}. Change it under More details.`);
  }
  const extras = EXTRAS.filter(([re]) => re.test(t)).map(([, w]) => w).filter((w, _i, all) => !(w === 'costumes' && all.includes('costume contest')));
  if (extras.length) found.push(`Extras: ${extras.join(', ')}`);

  const tNoTheme = th ? t.replace(th[0], ' ') : t;

  // Setting and venue
  let setting: Setting = 'indoors';
  if (/outdoor|outside|backyard|back yard|park|garden|patio|beach|tailgat|lawn|picnic/i.test(tNoTheme) && !/indoor|inside|apartment|lounge|hall\b|office/i.test(tNoTheme)) {
    setting = 'outdoors';
    found.push('Outdoors');
  } else if (/indoor|inside|apartment|lounge|\bhall\b|office|restaurant|house|home|clubhouse|room|church|center|place\b/i.test(t)) {
    found.push('Indoors');
  } else {
    assumptions.push('Indoor or outdoor was not mentioned, so the plan assumes indoors.');
  }
  let venue = '';
  const at = t.match(/\b(?:at|in)\s+(?:the|our|my|a)\s+([a-z][\w\s'-]{2,40}?)(?=[,.;]| in | on | for | with | and | which | that |\s*$)/i);
  const city = t.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,2})/);
  if (at) venue = /^(?:place|house|home|apartment|apt|condo|flat)$/i.test(at[1].trim()) ? 'Home' : at[1].trim();
  if (city) venue = venue ? `${venue[0].toUpperCase()}${venue.slice(1)}, ${city[1]}` : city[1];
  else if (venue) venue = venue[0].toUpperCase() + venue.slice(1);
  if (venue) found.push(`Place: ${venue}`);
  else {
    venue = setting === 'outdoors' ? 'Backyard' : 'Home';
    assumptions.push(`No location was given, so it is listed as "${venue}". You can change it anytime.`);
  }
  const cap = t.match(/(?:holds|capacity(?: of)?|fits|room for)\s*(\d{2,4})/i);
  const venueCapacity = cap ? Number(cap[1]) : Math.max(gMax + 10, Math.ceil((gMax * 1.25) / 5) * 5);

  // Date and time
  const hit = parseDate(t);
  const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  let date: string;
  if (hit && !hit.past) {
    date = hit.date;
    if (hit.rolled) assumptions.push(`"${hit.said}" has already passed this year, so the date is set to ${longDate(date)}. Change it if you meant a different year.`);
    else if (/^(this|next|coming|on)\b|weekend|tomorrow|^in\s/i.test(hit.said)) assumptions.push(`"${hit.said}" was read as ${longDate(date)}.`);
  } else if (hit && hit.past) {
    date = nextSaturdayAfter(42);
    assumptions.push(`The date you gave (${hit.said}) has already passed, so a placeholder date of ${longDate(date)} is used. Enter the right date below.`);
  } else if (occasion && holidayPartyDate(occasion)) {
    date = holidayPartyDate(occasion)!;
    assumptions.push(`No date was given, so it is set for ${longDate(date)}, around ${occasion.label.replace(/ (party|celebration|dinner|brunch|cookout)$/i, '')}. Change it below.`);
  } else {
    date = nextSaturdayAfter(42);
    assumptions.push(`No date was found in your description, so a Saturday about six weeks away (${longDate(date)}) is used as a placeholder.`);
  }
  if (hit && !hit.past) found.push(`Date: ${longDate(date)}`);
  let startTime = '18:00';
  let durationHrs = occasion?.hours ?? (kidsParty ? 3 : 4);
  let span = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)/i);
  const atTime = t.match(/\bat\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/i);
  if (span && (Number(span[1]) > 12 || Number(span[4]) > 12)) span = null;
  if (span) {
    const h1 = to24(Number(span[1]), span[3] ?? span[6]);
    const h2 = to24(Number(span[4]), span[6]);
    startTime = `${String(h1).padStart(2, '0')}:${span[2] ?? '00'}`;
    durationHrs = Math.max(1, h2 - h1);
    found.push(`Starts at ${clock(startTime)}`);
  } else if (atTime) {
    startTime = `${String(to24(Number(atTime[1]), atTime[3])).padStart(2, '0')}:${atTime[2] ?? '00'}`;
    found.push(`Starts at ${clock(startTime)}`);
  } else if (/morning/i.test(t)) startTime = '10:00';
  else if (/afternoon/i.test(t)) startTime = '14:00';
  else if (/evening|night/i.test(t)) startTime = '19:00';
  else if (occasion?.start) startTime = occasion.start;
  else if (kidsParty) startTime = '14:00';
  const dur = t.match(/(\d{1,2})\s*(?:-|\s)?(?:hours?|hrs?)\b/i);
  if (dur) {
    durationHrs = Number(dur[1]);
    found.push(`${durationHrs} hours`);
  } else if (!span) assumptions.push(`The event is planned as ${durationHrs} hours long. Drinks and ice scale with this.`);

  // Food
  // Food styles in the order they are mentioned: the first is the main food, the rest are served alongside
  const mentions: [RegExp, FoodFormat][] = [
    [/taco/i, 'taco-bar'], [/bbq|barbecue|grill|burger|hot ?dog|cookout/i, 'bbq'], [/potluck|bring a dish/i, 'potluck'],
    [/appetizer|finger food|hors d|snacks?\b|light bites/i, 'appetizers'], [/buffet|cater/i, 'buffet'],
  ];
  const styles = mentions
    .map(([re, f]) => ({ f, at: t.search(re) }))
    .filter((x) => x.at >= 0)
    .sort((x, y) => x.at - y.at)
    .map((x) => x.f);
  const foodFormat: FoodFormat = styles[0] ?? 'buffet';
  const foodText = foodWords(t, styles);
  if (foodText) found.push(`Food: ${foodText}`);
  else if (/dinner|food|lunch|brunch/i.test(t)) found.push('Food: a meal');
  else assumptions.push('No food was mentioned, so the plan starts with a catered buffet. Add your menu under Food.');
  const extraFood: FoodFormat[] = styles.slice(1);


  // Drinks
  let alcohol: Alcohol = 'none';
  if (/no alcohol|alcohol[- ]free|dry party|no drinking|sober/i.test(t)) alcohol = 'none';
  else if (/byob|bring (?:your|their) own (?:drinks|booze|alcohol|beer|wine)/i.test(t)) alcohol = 'byob';
  else if (/full bar|open bar|cocktails?|spirits|liquor|margaritas?/i.test(t)) alcohol = 'full-bar';
  else if (/\bbeer\b|\bwine\b|alcohol|mimosas?|prosecco|champagne/i.test(t)) alcohol = 'beer-wine';
  const drinkSaid = /water|soda|\bpop\b|lemonade|punch|horchata|agua fresca|tea\b|juice|coffee|beer|wine|prosecco|champagne|mimosa|cocktail|margarita|open bar|full bar|spirits|liquor|byob|cider|cocoa|eggnog/i.test(t);
  if (/no alcohol|alcohol[- ]free|dry party|sober/i.test(t)) found.push('No alcohol');
  else if (alcohol === 'none' && !/alcohol|drinking/i.test(t)) assumptions.push('No alcohol was mentioned, so none is planned. Add it under Drinks if you want it.');
  const softDrinks: SoftDrink[] = ['soda', 'water'];
  if (/juice|lemonade|punch/i.test(t)) softDrinks.push('juice');
  if (/coffee|\btea\b/i.test(t)) softDrinks.push('coffee-tea');
  const drinksText = drinkWords(t, alcohol, softDrinks);
  if (drinkSaid && drinksText) found.push(`Drinks: ${drinksText}`);

  const diet: string[] = [];
  for (const [re, label] of [
    [/vegetarian/i, 'vegetarian'], [/vegan/i, 'vegan'], [/gluten/i, 'gluten-free'], [/nut|peanut/i, 'nut allergy'],
    [/halal/i, 'halal'], [/kosher/i, 'kosher'], [/dairy|lactose/i, 'dairy-free'],
  ] as [RegExp, string][]) if (re.test(t)) diet.push(label);
  const dietary = diet.length ? diet.join(', ') : 'No specific restrictions';
  if (diet.length) found.push(`Dietary: ${diet.join(', ')}`);

  // Helpers: real names only ("Me and my boyfriend Lucas" → Lucas; "me" is the host)
  const helpers: string[] = [];
  const after = t.match(/(?:help from|helped by|with the help of|helpers?\s*(?:are|is|:)|co-?hosts?\s*(?:are|is|:))\s+([^.!?\n]+)/i);
  const before = t.match(/(?:^|[.!?\n]\s*|,\s*)([^.!?\n,]*?(?:\s(?:and|&)\s[^.!?\n,]*?)?)\s+(?:will|can|are going to|is going to|are|is)\s+(?:help|helping|be helping|co-?host)/i);
  const segment = after?.[1] ?? before?.[1] ?? '';
  const counted = t.match(/(\w+)\s+(?:friends|helpers|volunteers|roommates|teammates|co-?hosts|parents)\s*(?:to help|helping|who can help)?/i);
  const fromSegment = segment ? extractNames(segment.replace(/\b(?:to|with|for|on|at|in|who|that)\b.*$/i, '')).names.filter(looksLikeName) : [];
  if (fromSegment.length) {
    fromSegment.slice(0, 10).forEach((n) => helpers.push(n));
  } else if (counted && /help|volunteer/i.test(t)) {
    const k = toNum(counted[1]);
    if (!isNaN(k)) for (let i = 1; i <= Math.min(k, 8); i++) helpers.push(`Helper ${i}`);
  }
  if (helpers.length) found.push(`Organizers: ${helpers.join(', ')}`);
  else assumptions.push('No organizers were mentioned. Add names later to assign tasks and purchases.');

  // Suggested name: who it's for plus the occasion ("Leo's 7th Birthday Party"), with a costume note for costume parties
  let name = type === 'Party' ? (theme && theme !== 'Simple' ? `${theme.split(/[:,]/)[0]} Party` : 'Party') : type;
  if (/halloween/i.test(name) && extras.some((e) => /costume/.test(e)) && !/costume/i.test(name)) name = name.replace(/party/i, 'Costume Party');
  if (honoree) name = `${honoree}'s ${name.replace(/^(surprise )?/i, (m) => m.toLowerCase())}`.replace(/'s surprise /i, "'s Surprise ");
  name = titleCase(name);
  if (name !== 'Party') assumptions.unshift(`Suggested the name "${name}". Change it below.`);
  else assumptions.unshift('Give your event a name below.');

  return {
    draft: {
      name, type, date, startTime, durationHrs, venue, setting, venueCapacity, foodFormat, dietary,
      theme: theme || 'Simple and festive', budget, guestMin: gMin, guestExpected: gExp, guestMax: gMax, childPct, children: kids ? Math.min(gExp, Number(kids[1])) : Math.round((gExp * childPct) / 100), helpers, foodText, drinksText,
      extraFood, alcohol, softDrinks, preferences: extras.length ? extras.map((e, i) => (i ? e : e[0].toUpperCase() + e.slice(1))).join(', ') : '',
    },
    assumptions,
    found,
  };
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
    if (re.test(t) && !out.includes(w)) out.push(w);
  }
  return out.join(', ');
}
/** Drinks mentioned in the description, in plain words. */
function drinkWords(t: string, alcohol: Alcohol, soft: SoftDrink[]): string {
  const out: string[] = [];
  for (const [re, w] of [[/\bwater\b(?!melon)/i, 'water'], [/soda|\bpop\b|soft drinks?|coke/i, 'soda'], [/lemonade/i, 'lemonade'], [/punch/i, 'punch'], [/horchata/i, 'horchata'], [/agua fresca/i, 'agua fresca'], [/iced tea/i, 'iced tea'], [/\bjuice/i, 'juice for kids'], [/coffee/i, 'coffee'], [/cider/i, 'cider'], [/hot (?:chocolate|cocoa)|\bcocoa\b/i, 'hot chocolate'], [/eggnog/i, 'eggnog'], [/sangria/i, 'sangria'], [/seltzer|sparkling water/i, 'sparkling water'], [/mulled wine/i, 'mulled wine'], [/\btea\b/i, 'tea'], [/\bbeers?\b/i, 'beer'], [/\bwines?\b|prosecco|champagne|mimosa/i, 'wine'], [/cocktail|margarita|full bar|open bar|spirits|liquor/i, 'cocktails'], [/byob|bring (?:your|their) own/i, 'BYOB']] as [RegExp, string][]) {
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
