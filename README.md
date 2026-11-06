# Mood2Party: combined working prototype

One React app that merges the team's three MVPs into the product described in the value proposition:
guest and RSVP scenarios, plan quantities, shopping, budget, tasks with owners, change impact, and post-event learning.
All of it runs off **one shared plan state**, so every screen shows the same numbers.

## Simpler screens

Explanations live behind small ⓘ buttons instead of paragraphs, and small controls share one style. Event setup no longer asks for an occasion or venue capacity (the event name sets the feel), and Indoors/Outdoors is a small toggle next to Location. The describe step reads dates said relative to a holiday ("the day before Halloween", "Christmas Eve", "the weekend before Christmas", "the Saturday after Thanksgiving", "two days before Christmas") and places in the host's own words ("Pool on the rooftop of my apartment", "Jake's place", "Nobu, Malibu"), with rooftops, pools, yards and parks counted as outdoors. When AI reads the description, a date, place or indoor/outdoor setting the built-in reader found in the text wins, and AI notes that call those missing are dropped. On the review step, a "We Filled In N Things for You" panel (open by default, foldable) shows **From your description**: tags for everything picked up (occasion, who it is for, guests, extras like a costume contest, place, food, drinks, dietary needs, organizers), and **We guessed or suggested**: the suggested event name and anything filled in by default. The describe step understands holidays (Halloween, Friendsgiving, Diwali, New Year's Eve and more), life events (birthdays with ages, showers, graduations, retirements) and themed parties ("ugly sweater party"), and uses them to suggest a name such as "Leo's 7th Birthday Party", a date near the holiday, a start time, length and theme. When AI is available, Continue uses it with the same rules; "Skip AI and read it quickly" uses the built-in reader. **Defaults that fit the party:** anything the description does not say is filled from a profile for that kind of event (about 40 profiles in `src/lib/partyDefaults.ts`: kids' and baby birthdays, sleepovers, celebrations of life, weddings, quinceañeras, showers, brunch, dinner, game night, cookouts, holidays, work events and more). Each profile sets a start time, length, guest count, share of kids, food, drinks, theme, place and a per-guest budget, so a kids' birthday starts at 2 PM with pizza, fruit and cake and juice, and a celebration of life starts at 1 PM with sandwiches, cookies and coffee. "Small" or "intimate" shrinks the default guest count; "big" grows it; "adults only" and work events plan no kids; the default budget follows the guests, kids and any bar. The reader also understands number words ("twenty-five", "a dozen", "first birthday"), couples and families, "50+", "up to 40", "40 adults and 10 kids", times without am/pm ("at 7", "from 4 to 7", "until midnight"), loose dates ("mid-December", "the first weekend of March", "Saturday the 21st", "in April") and word-edge dietary needs. **Spending levels ($ to $$$):** after Check the Details, a **Choose Your Spending** step has one slider per kind of thing (food and drinks; plates, cups and cutlery; decorations; supplies) from $ Basic through $$ Standard to $$$ Nicer, showing what each level costs for this party, an example product, and the total against the budget. Each slider moves freely: a point between two levels mixes them (some items basic, some standard), and when you let go it settles on the nearest cost the plan can actually reach. **Fit My Budget** lowers levels where it saves the most until the plan fits. Levels live in `src/lib/tiers.ts`: tableware and decorations have real product lists per level (light plastic vs. gold-look cutlery, grocery greenery vs. florist centerpieces); other items use a store-brand or premium price step. The Budget page has the same sliders under **Spending Levels**, and Ways to Save suggests the one-step drop that saves the most. In an item's editor, **Price level** sets that item on its own ($, $$, $$$) or back to its category's level. Items already bought, and prices typed in by hand, are not changed by the sliders. AI reports which parts the description gave (`stated`); only those come from AI, and the same profile fills the rest, with a note for each default. Guests and RSVPs has a **Planning For** box: one number plus a drop-down (Minimum, Expected, Maximum or My own number), with a slider over the minimum-to-maximum band: drag it to any number (letting go on Min, Expected or Max picks that option; anything else becomes My own number), or use the arrow keys. Before replies the options are a guess around your number; after replies they come from the replies. Plan and Shop rows are one line each (checkbox, name, buyer drop-down, price, edit pencil). The item editor's status is Need to buy, Bought or Already have; there is no "Not needed" status. Instead, **Delete** in the editor removes the item, with Undo on the message that follows. On Budget, Ways to Save actions (Remove Optional Items, Plan for the suggested number) show an Undo button in that section and on the message. Tasks are rows in one list with an owner drop-down, and the summary is one line under the title.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html: one self-contained file you can host or send
```

No backend, no login. The plan is saved in the browser (localStorage). Use **Reset demo** between test sessions.

## Where each MVP ended up

| From | Kept | Changed |
|---|---|---|
| **Attendance planner** (AI Studio) | RSVP groups (adults and children), confirmed / maybe / no-reply / declined, min–expected–max formula (100% / 60% / 30%), risk check, follow-up list, deadline, research feedback question | Now drives the whole plan. The "planning for" number feeds quantities, cost and budget. Turnout weights are editable, and they are learned from past events |
| **Figma prototype** (Build_Mood2Party_Prototype) | Design system (cream, forest green, coral, gold, DM Sans), item drawer with retailer options, package math, "still sufficient" logic, "your quantity vs recommendation" choice, optimize drawer, sample-price labels | Quantities are rule-based instead of hard-coded 40/55 values, so any guest count works. Strategies are computed by trying every store combination instead of fixed lists, and they are marked incomplete when a store cannot supply an item |
| **Task MVP** (Lovable) | Describe-it or fill-a-form setup, assumptions list, generated checklist with helper owners and due dates, Needs attention / Coming up / Completed sections, blockers, "affected by change" flags from event edits | Plain React instead of TanStack Start. Task flags now also fire when the **guest count** changes. Moving the event date shifts open due dates |

New pieces that connect them:
- **Change banner + "What changed" drawer**: compares the plan against the last reviewed headcount. It shows before and after quantities, items that need more packages, packages that are still enough, cost change, venue and tables, tasks to recheck, and next actions.
- **Cost for each scenario** (overview and budget) makes the uncertainty visible in dollars.
- **Budget page**: other costs, where the money goes, and three computed ways to save.
- **After the event**: actual turnout plus "ran out / about right / lots left" ratings adjust the next plan.
- **Optional Claude features** (only when opened as a claude.ai artifact): read a free-text description, explain a change in plain language, and turn an inspiration photo into items. Without Claude, the built-in rules handle everything.

## Onboarding

Onboarding starts on the **homepage** and follows the real flow:

1. First visit: a three-screen welcome on the homepage ends with **Show me around** or **Skip the tour**.
2. The 11-step tour loads a sample party and walks the same path a new user takes:
   homepage (Create an event) → describe your event → check what we understood → plan overview → needs attention → guest range → shopping list → budget → tasks and helpers → after the event → back to the homepage.
3. The homepage then switches to **Ready to plan your own event?** with one main button, **Start planning my event**. The sample party is one click away.
4. The person's own plan skips the welcome and tour and keeps the **Getting started** checklist, which ticks itself off as they use the app.

**Hide** on the Getting started checklist minimizes it to one line (progress and next step) with a **Show** button; it only closes for good once every step is done. Skipping the tour at any point is allowed. A "Take the 1-minute tour" link stays on the homepage. **Help: replay the tour** in the sidebar or menu replays it: the full flow in the sample party, or a short in-plan version for your own event. **Reset demo** clears everything and returns to the homepage with the welcome, ready for the next test participant. **Start over** on your own plan returns to the homepage without showing the welcome or tour again. Generating a plan opens the Overview. Every visit or refresh opens on the homepage (so does returning to a tab the browser kept in memory, or coming back after 15+ minutes away); if parties are saved, the top of the homepage shows **all of them**: the next upcoming party in a large card (countdown, date, time and guests, tasks done, items ready, budget left, any overdue or blocked tasks, and **Continue Planning**), and up to three other upcoming parties as small cards with a "% ready" ring and an overdue/blocked flag, plus a **New Party** card. With no other upcoming parties, the most recent past ones show faded instead. **See All** opens the full Your events panel. If you were last working on a different party than the next one, a **Pick up where you left off** line in the big card opens it. The sample party shows here only when no real party is saved.

## Organizers

The **Tasks and Organizers** page has an Organizers section listing you and every helper, with their open tasks, items to buy and anything blocked. Pick a name in the **Show tasks for** bar above the list to see only that person's tasks. **Add a helper** adds a name (empty names, duplicates and "You" are refused with a message); new helpers appear right away as task owners and buyers everywhere. Removing a helper asks for confirmation first, moves their open tasks to you and puts their purchases back to "No buyer yet". Removing someone in **Edit event details** does the same. Every shopping item on **Plan and shop** has a **buyer drop-down menu** ("No buyer yet" is highlighted in amber), and every task row has an **owner drop-down menu** to reassign it in one step (a confirmation appears; the task drawer still opens from the task name or arrow). **Plan and shop** also has a **Who buys** filter (Anyone buys / No buyer yet / You / each helper): it shows only that person's items, a summary line with their item count and total, and category subtotals for just those items. The section starts minimized to one line (helper names and any blocked tasks); **Show** opens it and **Hide** minimizes it again, and the choice is remembered in that browser. In event setup and **Edit event details**, helpers are added one name at a time as removable chips, with the same checks (no duplicates, no "You", no commas, up to 40 characters, up to 20 helpers).

## Getting back home

The homepage hero shows a party illustration (a checklist with balloons, a cake and confetti, colored for both themes) instead of a sample-event card, so no made-up numbers appear before someone starts. A **Homepage** button (house icon, outline pill) sits under the logo in the sidebar and phone menu, and a house button sits in the phone header. The logo itself stays the theme easter egg.

## Your events

Every plan you make is saved in the browser under **Your events**. The party card in the sidebar (and phone menu) is a slim ticket: a gradient bar with the party name and a ⇅ switcher, then the date and days to go, two small buttons (pencil: **Edit Event Details**; person-plus: **Invite a Co-host**, with a count badge once co-hosts join), and a progress bar with "% ready" (shopping items and tasks done). The account card at the bottom of the sidebar shows your photo or initials, name and email, and a small status tag: **Saved** (green), **Saving**, **Offline** (amber) or **Not saved** (red); tapping it opens Sign Out. Tapping the event name opens the **event switcher**: your other events, **New event**, and **Copy, delete or manage**, which opens the full Your events panel (also reachable from **See All** on the homepage). From there you can **Open** another event, **Copy as new event** (same items, tasks, helpers and guest list, with nothing bought, done or answered yet; the copy opens on Edit event details so you can set its name and date) or **Delete** one. Creating a new event keeps the current one saved. **Start over** deletes only the event that is open. **Reset demo** can also delete all saved events, for a clean usability-test session. What you learned from past events and your onboarding progress follow you between events. The sample party is never listed as one of your events. Events stay in that one browser until accounts are added.

## Budget and item statuses

The Budget page shows three numbers: **Total budget** (with a visible **Edit** button), **Projected total cost** (percent of budget, still to spend and a progress bar) and **Remaining budget** (budget minus what is spent, with what is spent so far and what would be left after buying the rest). Overview, Plan and shop and the homepage use the same labels.

Every bought item has a **Paid $** box (on its Plan and shop row, in its details and in **What you've bought** on the Budget page). Empty means the estimate is used, and the item is tagged "Using estimate"; once an amount is entered it replaces the estimate everywhere, including the projected cost, so a finished purchase never keeps an outdated estimate. **Other costs** has quick-add buttons for a restaurant minimum spend, a party or room fee, a cake cutting fee, service charges or tips, and rentals. A **minimum spend** only adds the part your food and drinks don't already reach.

Every item has one of three plainly labeled states, used the same way in the list, the filters and the item details: **Need to buy**, **Bought** (green, with a check) and **Already had it** (teal, with a house icon). Tick the box when something is bought; tap **I have it** on the row when you already own it (and **Need to buy it after all** to undo).

## Guests and RSVPs

Guest entry comes first: one **Add a Guest Group** form (1 adult by default, plus-ones, status, and optional kids, dietary needs, allergies and a note). There are three statuses: **Confirmed**, **Not sure yet** and **Can't come**. One box, **How Many People Are You Planning For?**, sets the number the whole plan uses. Four options sit under it: **Minimum** (confirmed only), **Expected** (confirmed plus a share of not-sure guests, 45% by default, adjustable and learned from past events; it updates as replies come in), **Maximum** (everyone who hasn't said no) and **My Own Number** (typing in the box picks this). Before anyone replies, the box is simply your own guess. Kids are optional and low-key: setup shows an **Any kids coming?** link under the guest count (kids are part of that number), the guest form keeps **Kids** under "Kids, dietary needs, allergies and notes", and the Guests page shows a Kids box and an adults/kids split only when there are kids. Kids change food amounts a little, are left out of alcohol, and add juice pouches. Allergies and dietary needs are summarized above the guest list.

## Plan and Shop

One **Compare Stores** button (top right, showing the possible saving) finds the cheapest mix of stores for everything still to buy, counting delivery fees once per store. Categories fold with a click on their name (folded ones show item count, how many are left to buy and the total), and **Collapse All / Expand All** folds them all; the choice is remembered in the browser. **Edit** on each row opens one short form: status (Need to buy, Bought with a Paid $ box, Already have, Not needed), name, amount and unit (with "Use suggested"), category, who buys it, store, pack size and price per pack (sample prices can be overridden, or pick your own store), optional, and notes; a folded **Compare Stores for This Item** section lists each store's total. **Add Item** and **Add a Vendor** sit beside the list and at the bottom of every category. **One Vendor for All of It** adds a single vendor price for a whole category. Items marked **Not needed** or already provided move to **Off the List** with a **Bring Back** button. **Check the List** offers an optional reference of often-forgotten items and one-tap "already provided" shortcuts. Items from your typed menu that have no price yet show an **Add a price** tag.

## Food and Drinks in Your Own Words

**Create an Event** and **Edit Event Details** have two free-text boxes, **Food** and **Drinks**, with tap-to-add suggestions. Known styles (taco bar, BBQ, appetizers, buffet, potluck) and drinks (water, soda, juice, coffee and tea, beer, wine, cocktails, BYOB) use the built-in items. Anything else ("pupusas", "horchata") becomes its own shopping item and task ("Order or make the pupusas", "Buy horchata"). Common dishes (pizza, cupcakes, sandwiches, fruit trays, salads, pasta, wings, ice cream, lemonade and similar) come with amounts and sample prices; others get an estimated amount and an **Add a price** tag. When AI is available (Claude here, Gemini on the public site), it fills in amounts and prices for those items after you create the plan or save changes. Editing the text later adds new items and tasks, sets aside ones you removed, and keeps the main food task's wording in step. The guest count in setup is a single number.

## Tasks and Organizers

Organizers are the people helping you plan and buy, not every guest (the page and menus call them organizers). Each person has **Assign** (tick the tasks and purchases they're responsible for, in one drawer) and **Send list**, which writes a ready-to-send message with their tasks and purchases to copy or open in Messages or email. Mood2Party never messages anyone by itself, and the page says so. Tasks can be **sorted by deadline or priority**, high-priority tasks are tagged, and each task can say what it **needs** (a car, cash, a hand). A **Heads up** section lists tasks that haven't started and are due within 3 days, or that need something, alongside **Needs attention** (late, blocked or affected by a change).

## Calendar and stores

- **Add to calendar** on the Overview opens the event in Google Calendar or Outlook.com, or saves a calendar file (.ics) for Apple Calendar and others. The calendar file is only offered on GitHub Pages and other regular websites, because the page published inside Claude cannot save that file type.
- **Shop by store** on Plan and shop groups everything still to buy by store, with a **Find** link that searches the store's website for each item, **Copy list** for each store, and **Open** the store. Item details also have "Look it up at" links for every store option. Real checkout with stores would need their partner programs; these links need no accounts.

## Less clutter

Short explanations moved behind small **?** info buttons (how guest numbers work, how the shopping list works, why cost changes with turnout). The Overview keeps the summary cards, Needs your attention and the next three tasks (the turnout table and helper workload live on Budget and Tasks). Getting started shows only the next step, with **Show all 6 steps**. Long lists start short: guest groups show 10 with **Show all**, Coming up tasks show 5, and Completed tasks fold away. On phones, shopping rows drop the arrow (tap the name instead). The app name is bigger, and the welcome screens and tour use larger text (18px).

## Optional items

Every shopping item is treated as a must-buy unless it's marked **Optional**. Each row on **Plan and shop** has a small **Optional** checkbox, so it can be changed without opening the item; the item details and **Add an item** forms have the same checkbox. Optional items that haven't been bought yet are what the Budget page's **Skip optional items** suggestion offers to remove. (This replaced an earlier Essential / Recommended / Optional setting after user feedback; older saved plans treat "Recommended" as essential.)

## Change Notices

When the planning number changes, the "Your planning count went up/down… Review What Changed" notice appears only on **Plan and Shop** and **Budget**, and only when amounts or cost actually moved (more than $1). Overview lists it under Your Next Steps. Task sections (Needs Attention, Heads Up, Coming Up, Completed) fold with a click on their title; Completed starts folded and the choice is remembered in the browser.

## Titles and Layout

Page titles, section headings, panel titles and button labels use title case ("Plan and Shop", "Add Item"); descriptions and help text stay in sentence case. Form fields in the same row line up at the top, toolbars keep filters on one line and actions on the other, and on phones header buttons share the width evenly and the status filter scrolls sideways instead of wrapping.

## Colors

Palette "Blue and pink": cobalt blue `#3050D8` for buttons, links and navigation; pink `#FF4F9A` (text-safe `#C2185B`) for highlights, progress bars, badges and change alerts; cool white `#F7F7FC` background with dark navy text `#1E1F36`. Status colors stay fixed: green for within budget, amber for maybe, red for over budget, blocked and overdue. All colors are defined once in `src/index.css`.

**Gradient look.** A soft gradient glow fades into the background at the top and bottom of the screen (fixed while scrolling, page area only, not the sidebar; soft in the light theme at 12% / 9%, stronger in the dark theme at 26%; set with `--m2p-glow-top` and `--m2p-glow-bottom` in `src/index.css`). Page titles and the wordmark use gradient text, and main buttons, the active menu item, ticked checkboxes and the **Party ready!** banners use a gradient fill (light: blue `#3050D8` to pink `#C2185B`; the glow passes through purple to `#FF4F9A`). Titles, section headings and buttons use the rounded **Fredoka** font (bundled in the build, so it works offline); body text stays DM Sans. Buttons are pill-shaped and cards have rounder corners. Completion bars (shopping progress, items ready, tasks done, Getting started) are candy-striped in dark and light pink; budget bars keep solid status colors. Ticking any checkbox sends a soft ring pulse (off when the device asks for reduced motion). Each shopping category has a colored icon (pink food, blue tableware, yellow decorations, teal supplies). A **Party ready!** banner appears on Plan and shop when everything is bought and on Tasks when every task is done.

Easter egg: clicking the **Mood2Party logo** (top left, on every page) switches to the **Midnight and sunshine** theme: deep navy background, light blue main color (`#7EA2FF`) and sunshine yellow accent (`#FFC93C`). The logo icon becomes a moon. Its gradient is soft blue `#7EA2FF` to pink `#FF9EC7`, with sunshine-yellow candy stripes on progress bars. Clicking it again switches back. The choice is remembered in that browser. Both themes use the same color roles, defined in `src/index.css` under `:root` and `:root[data-theme='midnight']`.

## Number boxes

Number fields (guest counts, the custom planning count, turnout percentages, adults and kids, hours, budget and other costs) can be emptied while typing, so you can clear a "0" and type a new number. Clicking into a box selects its number, so typing replaces it. Leaving a box empty puts back its minimum (usually 0), and values above a limit (like 100%) are capped when you leave the box.

## Accounts, saving and AI (public site)

The public site runs on **Cloudflare Pages**, which serves the app and one small server function. Three services are involved; setup steps are in the setup guide.

- **Google sign-in and saving: Firebase.** Anyone can look around without an account: the homepage, the tour, the sample party and describing an event. **Saving a party needs a Google account**: on the review step the button reads **Sign In and Generate My Plan**, and **Copy as new event** asks you to sign in first. Every party is then saved to the account and opens on any device. Each event is stored as a main document (settings and summary) plus one small document per guest group, item and task, so two people (or two devices) can change different things at once; the app merges changes live. New events made while signed in are saved automatically. Events that were already in the browser before signing in are listed under **This device only** in Your events, with **Save to my account**. Signing out removes the account's events from that browser (they stay in the account). What past events taught the app (turnout, item amounts) is saved with the person's account. The account button sits at the bottom of the sidebar, in the phone menu and at the top of the homepage, with a save status line (Saved / Saving / Offline / Couldn't save).
- **AI: Gemini (free tier) through `/api/ai`.** The browser never sees the API key: `functions/api/ai.ts` (logic in `server/aiHandler.ts`) checks the person's Firebase sign-in token (`server/firebaseToken.ts`, using Google's public keys), accepts requests only from the same site, applies an optional daily limit per person (Cloudflare KV binding `AI_USAGE`, default 60 a day), and calls Gemini (`gemini-3.5-flash-lite` unless `GEMINI_MODEL` is set). The three AI features (read your description, explain a change, ideas from a photo) appear only when the AI is set up and the person is signed in; signed out, event setup shows "Want AI to read your description? Sign in with Google". Photos are shrunk to 1600 px before sending.
- **Co-hosts.** The host opens **Invite a Co-host** (under Edit Event Details on the party ticket; it reads **Co-hosts · N** once people have joined) and taps **Create Invite Link**, then copies it or sends it by text or email. Whoever opens the link sees a **You're invited** card on the homepage, signs in with Google and joins; the party opens for them, their first name is added to Organizers so they can be given tasks and purchases, and it stays in their account. Co-hosts can see and edit everything, and changes show up for everyone within seconds. Only the host can invite, remove co-hosts (× next to their name), turn the link off or make a new one (the old link then stops working), and delete the party. A co-host can **Leave This Party**. Someone who is removed, or whose party is deleted, gets a message and the party disappears from their device. Organizers on the Tasks page are different: just names to give work to, no account needed.
- **RSVP link.** On Guests and RSVPs, **Send RSVP Link** creates one link for everyone you invite, with **Copy**, **Text It** and **Email It** (the message includes the party name, date, time and reply-by date). Guests open a page with the party details and reply without an account: Yes / Not sure yet / Can't make it, adults and kids, dietary needs, allergies and a note. They can change their reply later from the same device. Replies land in the guest list right away on the host's and co-hosts' devices, with a notification: a group already on the list is updated when the name matches (ignoring "The" and capitals), otherwise a new group is added; an older reply never overwrites a newer one. The page's party details follow the plan. **Make a New Link** stops the old one; **Turn Off Link** stops replies; replies already in stay. Inside claude.ai, where there are no accounts, the panel offers **See What Guests See**, and a reply sent from it is added to the guest list.
- **Inside claude.ai** (the published Claude page) accounts and co-hosts are hidden, parties are saved in the browser, and the AI features keep using Claude.
- **Security rules** for Firestore are in `firestore.rules`: only the host and co-hosts can read or edit a party; only the host can change the invite link, remove co-hosts or delete it; someone with the current invite code can add only themselves, as a co-host; a co-host can remove only themselves; anyone with the current RSVP code can read the party's public RSVP page (name, date, time, place, reply-by date, host's first name) and send or change a reply with checked fields and sizes, and only the host and co-hosts can read replies.

Testing without Firebase: add `?testcloud=1` to the address to use a stand-in backend kept in the browser (sign-in asks for a name). Each tab acts as a separate device, so two tabs can test syncing and co-hosting (open the invite link in a new tab with `&testcloud=1` added).

Settings: `.env.example` lists the variables. Build variables (Cloudflare Pages): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (not secret). Server variables: `GEMINI_API_KEY` (secret), `FIREBASE_PROJECT_ID`, optional `GEMINI_MODEL`, `AI_DAILY_LIMIT`.

## Code map

```
src/lib/types.ts        data model (single source of truth)
src/lib/attendance.ts   RSVP scenarios, planning count, risk
src/lib/catalog.ts      item rules, sample retailer options and fees
src/lib/plan.ts         quantities, packages, totals, strategies, change impact
src/lib/tasks.ts        task generation, event-change rules
src/lib/actions.ts      state updates (save event, accept changes, learning)
src/lib/parse.ts        free-text event parser (no AI needed)
src/lib/demo.ts         demo event: Maya's graduation party, 28 guest groups
src/pages/*             Welcome, Setup, Overview, Guests, Plan, Budget, Tasks, WrapUp
src/components/*        Shell, drawers, UI kit, Onboarding (intro, tour, checklist), EventTicket, AccountMenu
src/lib/cloud/*         sign-in and saving: Firebase backend, test backend, merge logic, useCloud hook
src/lib/ai.ts           AI features: Claude inside claude.ai, Gemini via /api/ai elsewhere
functions/api/ai.ts     Cloudflare Pages Function (the only server code)
server/*                its logic: sign-in token check, Gemini call, daily limit
firestore.rules         Firestore security rules to paste into Firebase
```

## Suggested usability-test script (8–12 people)

1. Start on the homepage and let the participant go through the welcome and tour (or skip it, to compare). Open the sample party, then ask: "How many people should Maya plan for, and why?" (Guests page)
2. Ask them to trigger new RSVPs (**Try it** in Getting started, or **Simulate new replies** on the Guests page), then: "What do you need to buy now, and what is already enough?"
3. "Is Maya still within budget? What would you do?" (Optimize shopping / ways to save)
4. "Which of Maya's helpers has something blocked?" (Tasks)
5. Record time, errors and confidence. Press **Reset demo** before the next participant.

Prices are sample values for concept testing, not live retailer data.
