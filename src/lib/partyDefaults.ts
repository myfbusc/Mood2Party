// Sensible starting values for anything a party description doesn't say, chosen to fit the kind of party.
// A 7-year-old's birthday gets an afternoon start, mostly kids, pizza and juice; a dinner party gets 10 guests at 6:30 PM;
// a celebration of life gets a calm theme and a light lunch. Every value stays editable on the review step.

import type { Setting } from './types';

export interface Profile {
  key: string;
  start: string; // HH:MM
  hours: number;
  guests: number; // everyone, kids included
  kidsShare: number; // share of guests who are kids, 0..1
  perGuest: number; // budget in USD per guest, before drinks
  food: string; // what goes in the Food box
  drinks: string; // what goes in the Drinks box
  theme: string;
  venue: string;
  setting?: Setting; // only when the kind of party decides it (a picnic is outside)
  /** One short reason the defaults look like this, for the notes ("a kids' birthday") */
  label: string;
}

type P = Omit<Profile, 'key'>;
const base: P = { start: '18:00', hours: 4, guests: 30, kidsShare: 0, perGuest: 20, food: 'appetizers', drinks: 'water, soda', theme: 'Simple and festive', venue: 'Home', label: 'a party' };
const mk = (key: string, p: Partial<P>): Profile => ({ key, ...base, ...p });

/** Most specific first. `re` is tested against the occasion and the description together. */
const PROFILES: { re: RegExp; when?: (c: Ctx) => boolean; p: Profile }[] = [
  { re: /./, when: (c) => c.birthday && c.age !== null && c.age <= 2, p: mk('baby-birthday', { start: '11:00', hours: 3, guests: 20, kidsShare: 0.3, perGuest: 15, food: 'sandwiches, fruit tray, cake', drinks: 'water, juice, lemonade', theme: 'Soft and sweet', label: "a baby's first birthday" }) },
  { re: /sleepover|slumber party/i, p: mk('sleepover', { start: '18:00', hours: 4, guests: 8, kidsShare: 0.75, perGuest: 20, food: 'pizza, snacks', drinks: 'juice, water', theme: 'Cozy movie night', label: 'a sleepover' }) },
  { re: /./, when: (c) => c.birthday && c.kidsParty, p: mk('kids-birthday', { start: '14:00', hours: 3, guests: 20, kidsShare: 0.6, perGuest: 15, food: 'pizza, fruit tray, cake', drinks: 'juice, water', theme: 'Bright and playful', label: "a kids' birthday" }) },
  { re: /./, when: (c) => c.kidsParty, p: mk('kids-party', { start: '14:00', hours: 3, guests: 20, kidsShare: 0.6, perGuest: 15, food: 'pizza, fruit tray', drinks: 'juice, water', theme: 'Bright and playful', label: "a kids' party" }) },
  { re: /celebration of life|memorial(?! day)|\bwake\b|funeral|repast/i, p: mk('memorial', { start: '13:00', hours: 3, guests: 50, kidsShare: 0.1, perGuest: 20, food: 'sandwiches, fruit tray, cookies', drinks: 'water, coffee, lemonade', theme: 'Warm and simple, with photos', label: 'a celebration of life' }) },
  { re: /wedding|reception|vow renewal/i, p: mk('wedding', { start: '17:00', hours: 5, guests: 100, kidsShare: 0.05, perGuest: 60, food: 'buffet', drinks: 'water, soda', theme: 'Elegant', venue: 'Reception venue', label: 'a wedding celebration' }) },
  { re: /quincea|quince\b|sweet (?:16|sixteen)|bar mitzvah|bat mitzvah|b'nai mitzvah/i, p: mk('coming-of-age', { start: '18:00', hours: 5, guests: 80, kidsShare: 0.1, perGuest: 45, food: 'buffet, cake', drinks: 'water, soda', theme: 'Elegant', venue: 'Event hall', label: 'a big milestone celebration' }) },
  { re: /fundrais|gala|charity|benefit\b|nonprofit/i, p: mk('fundraiser', { start: '18:00', hours: 4, guests: 100, perGuest: 50, food: 'appetizers', drinks: 'water, soda', theme: 'Elegant', venue: 'Event venue', label: 'a fundraiser' }) },
  { re: /graduat|\bgrad party\b/i, p: mk('graduation', { start: '14:00', hours: 4, guests: 50, kidsShare: 0.15, perGuest: 25, food: 'buffet, cake', drinks: 'water, soda, lemonade', theme: 'School colors', label: 'a graduation party' }) },
  { re: /bridal shower|wedding shower/i, p: mk('bridal-shower', { start: '12:00', hours: 3, guests: 25, perGuest: 25, food: 'appetizers, fruit tray, cupcakes', drinks: 'lemonade, water, coffee', theme: 'Florals and blush', label: 'a bridal shower' }) },
  { re: /baby shower|sip (?:and|&|n) see|gender reveal|baby sprinkle/i, p: mk('baby-shower', { start: '13:00', hours: 3, guests: 25, kidsShare: 0.05, perGuest: 25, food: 'appetizers, fruit tray, cupcakes', drinks: 'lemonade, water, coffee', theme: 'Soft pastels', label: 'a shower' }) },
  { re: /tea party|high tea/i, p: mk('tea', { start: '14:00', hours: 2, guests: 15, perGuest: 20, food: 'sandwiches, fruit tray, cookies', drinks: 'tea, lemonade, water', theme: 'Garden tea party', label: 'a tea party' }) },
  { re: /brunch|breakfast|mother'?s day/i, p: mk('brunch', { start: '11:00', hours: 3, guests: 15, perGuest: 20, food: 'buffet, fruit tray', drinks: 'coffee, juice, water', theme: 'Light and bright', label: 'a brunch' }) },
  { re: /friendsgiving/i, p: mk('friendsgiving', { start: '16:00', hours: 4, guests: 15, perGuest: 15, food: 'potluck, turkey', drinks: 'water, soda', theme: 'Autumn harvest', label: 'Friendsgiving' }) },
  { re: /thanksgiving/i, p: mk('thanksgiving', { start: '15:00', hours: 4, guests: 15, kidsShare: 0.2, perGuest: 25, food: 'turkey, side dishes, pie', drinks: 'water, soda, coffee', theme: 'Autumn harvest', label: 'Thanksgiving' }) },
  { re: /\blunch|luncheon|midday/i, p: mk('lunch', { start: '12:00', hours: 2, guests: 15, perGuest: 18, food: 'sandwiches, salad', drinks: 'water, soda', theme: 'Simple', label: 'a lunch' }) },
  { re: /super ?bowl|watch party|game day|march madness|world cup|the game\b|fight night/i, when: (c) => !/tailgat/i.test(c.text), p: mk('watch', { start: '15:00', hours: 4, guests: 15, kidsShare: 0.1, perGuest: 18, food: 'wings, appetizers', drinks: 'soda, water', theme: 'Team colors', label: 'a watch party' }) },
  { re: /tailgat/i, p: mk('tailgate', { start: '11:00', hours: 4, guests: 20, perGuest: 15, food: 'BBQ', drinks: 'water, soda', theme: 'Team colors', venue: 'Stadium parking lot', setting: 'outdoors', label: 'a tailgate' }) },
  { re: /dinner|supper|murder mystery/i, p: mk('dinner', { start: '18:30', hours: 3, guests: 10, perGuest: 35, food: 'pasta, salad', drinks: 'water, soda', theme: 'Simple and elegant', label: 'a dinner' }) },
  { re: /game night|board game|poker|trivia|movie night|bingo|card night|karaoke night/i, p: mk('game-night', { start: '19:00', hours: 4, guests: 10, perGuest: 12, food: 'pizza, snacks', drinks: 'soda, water', theme: 'Casual and cozy', label: 'a game or movie night' }) },
  { re: /picnic/i, p: mk('picnic', { start: '12:00', hours: 3, guests: 20, kidsShare: 0.2, perGuest: 15, food: 'sandwiches, fruit tray', drinks: 'lemonade, water', theme: 'Gingham and wildflowers', venue: 'Park', setting: 'outdoors', label: 'a picnic' }) },
  { re: /pool party|swim party/i, p: mk('pool', { start: '13:00', hours: 4, guests: 25, kidsShare: 0.2, perGuest: 20, food: 'BBQ, fruit tray', drinks: 'lemonade, water, soda', theme: 'Summer pool', venue: 'Pool', setting: 'outdoors', label: 'a pool party' }) },
  { re: /reunion/i, p: mk('reunion', { start: '12:00', hours: 5, guests: 50, kidsShare: 0.25, perGuest: 20, food: 'BBQ', drinks: 'water, soda, lemonade', theme: 'Name tags and old photos', venue: 'Park', setting: 'outdoors', label: 'a reunion' }) },
  { re: /block party/i, p: mk('block', { start: '14:00', hours: 5, guests: 60, kidsShare: 0.25, perGuest: 15, food: 'BBQ', drinks: 'water, soda, lemonade', theme: 'Neighborhood fun', venue: 'Our street', setting: 'outdoors', label: 'a block party' }) },
  { re: /cookout|bbq|barbecue|grill ?out|fourth of july|4th of july|july 4|independence day|memorial day|labor day|father'?s day|luau|crawfish boil|fish fry/i, p: mk('cookout', { start: '14:00', hours: 5, guests: 30, kidsShare: 0.2, perGuest: 18, food: 'BBQ', drinks: 'water, soda, lemonade', theme: 'Backyard summer', venue: 'Backyard', setting: 'outdoors', label: 'a cookout' }) },
  { re: /new year'?s eve|\bnye\b/i, p: mk('nye', { start: '20:00', hours: 5, guests: 30, perGuest: 25, food: 'appetizers', drinks: 'soda, water', theme: 'Black and gold countdown', label: "a New Year's Eve party" }) },
  { re: /hallowe'?en|spooky|trick[- ]or[- ]treat/i, p: mk('halloween', { start: '19:00', hours: 4, guests: 30, perGuest: 20, food: 'appetizers', drinks: 'soda, water', theme: 'Halloween: costumes, orange and black', label: 'a Halloween party' }) },
  { re: /christmas|xmas|holiday party|hanukkah|chanukah|kwanzaa|ugly sweater|winter party|festivus/i, p: mk('holiday', { start: '18:00', hours: 4, guests: 30, kidsShare: 0.1, perGuest: 25, food: 'appetizers', drinks: 'water, soda, coffee', theme: 'Festive and cozy', label: 'a holiday party' }) },
  { re: /(?:office|work|team|company|coworker|co-worker|staff|department|employee|client)\b/i, p: mk('work', { start: '17:00', hours: 3, guests: 30, perGuest: 25, food: 'appetizers', drinks: 'water, soda', theme: 'Simple and polished', venue: 'Office', label: 'a work event' }) },
  { re: /\bclub\b|student org|chapter|society|sorority|fraternity|meetup|meeting/i, p: mk('club', { start: '18:00', hours: 3, guests: 20, perGuest: 10, food: 'pizza, snacks', drinks: 'water, soda', theme: 'Simple', venue: 'Meeting room', label: 'a club event' }) },
  { re: /anniversary|engagement/i, p: mk('couple', { start: '18:00', hours: 4, guests: 40, kidsShare: 0.05, perGuest: 35, food: 'appetizers, cake', drinks: 'water, soda', theme: 'Elegant', label: 'a celebration for a couple' }) },
  { re: /./, when: (c) => c.birthday && c.age !== null && c.age >= 30 && c.age % 10 === 0, p: mk('milestone-birthday', { start: '19:00', hours: 4, guests: 40, perGuest: 30, food: 'appetizers, cake', drinks: 'water, soda', theme: 'Black and gold', label: 'a milestone birthday' }) },
  { re: /./, when: (c) => c.birthday && c.age !== null && c.age >= 13 && c.age <= 19, p: mk('teen-birthday', { start: '18:00', hours: 4, guests: 20, perGuest: 20, food: 'pizza, cake', drinks: 'soda, water', theme: 'Their favorite colors', label: 'a teen birthday' }) },
  { re: /birthday|bday/i, p: mk('birthday', { start: '19:00', hours: 4, guests: 25, perGuest: 25, food: 'appetizers, cake', drinks: 'water, soda', theme: 'Balloons and confetti', label: 'a birthday party' }) },
  { re: /open house/i, p: mk('open-house', { start: '13:00', hours: 4, guests: 40, kidsShare: 0.1, perGuest: 15, food: 'appetizers', drinks: 'water, soda, lemonade', theme: 'Simple and welcoming', label: 'an open house' }) },
  { re: /retire/i, p: mk('retirement', { start: '17:00', hours: 3, guests: 40, perGuest: 25, food: 'appetizers, cake', drinks: 'water, soda', theme: 'Simple and festive', label: 'a retirement party' }) },
  { re: /housewarming|house warming|going[- ]away|farewell|send[- ]off|welcome home|homecoming|launch|cocktail party|happy hour|mixer/i, p: mk('social', { start: '18:00', hours: 3, guests: 30, perGuest: 20, food: 'appetizers', drinks: 'water, soda', theme: 'Simple and festive', label: 'a get-together' }) },
  { re: /easter/i, p: mk('easter', { start: '11:00', hours: 3, guests: 20, kidsShare: 0.35, perGuest: 20, food: 'buffet, fruit tray', drinks: 'juice, water, coffee', theme: 'Spring pastels', label: 'an Easter gathering' }) },
  { re: /potluck/i, p: mk('potluck', { start: '17:00', hours: 3, guests: 25, kidsShare: 0.1, perGuest: 8, food: 'potluck', drinks: 'water, soda', theme: 'Simple and festive', label: 'a potluck' }) },
];

export interface Ctx {
  text: string; // the whole description
  type: string; // the occasion, e.g. "7th birthday party"
  birthday: boolean;
  age: number | null;
  kidsParty: boolean;
}

/** The kind of party, for defaults. Always returns something (a general party at worst). */
export function profileFor(c: Ctx): Profile {
  const hay = `${c.type} ${c.text}`;
  for (const x of PROFILES) {
    if (x.when && !x.when(c)) continue;
    if (x.re.test(hay)) return x.p;
  }
  return mk('party', {});
}

/** "a small get-together", "just close friends" → fewer guests; "a big party", "everyone we know" → more. */
export function sizeFactor(t: string): number {
  if (/\b(?:tiny|intimate|small|little|low[- ]key|just (?:a few|close|us|family|immediate)|a few (?:friends|people|close)|close friends|immediate family|handful)\b/i.test(t)) return 0.5;
  if (/\b(?:huge|massive|giant|everyone we know|whole (?:neighborhood|town|school|office|company)|big|large)\b/i.test(t)) return 1.6;
  return 1;
}

/** Budget for a party of this kind and size, rounded to $50. Drinks with alcohol cost more per guest. */
export function defaultBudget(p: Profile, guests: number, kids: number, alcohol: string): number {
  const adults = Math.max(0, guests - kids);
  const perAdult = p.perGuest + (alcohol === 'full-bar' ? 15 : alcohol === 'beer-wine' ? 8 : alcohol === 'byob' ? -3 : 0);
  const raw = adults * perAdult + kids * p.perGuest * 0.6;
  return Math.max(100, Math.round(raw / 50) * 50);
}
