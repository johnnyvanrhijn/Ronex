# Ronex — Product Specification

> This is the source of truth for what Ronex is and does. Every agent reads this before acting.

## 1. Core vision

Ronex is about **simple training, consistent execution, and measurable progression**.

- No focus on exotic exercises
- No excessive complexity
- The core is: consistent training, heavier training (progressive overload), insight into performance and progress.

The app actively steers users toward:
- Repeating exercises
- Improving performance
- Training deliberately based on previous results

## 2. Target audience

- Men and women
- All levels: beginner, intermediate, advanced
- Must be accessible for beginners
- Must remain valuable for advanced users
- No intimidation or complexity

## 3. First-time user experience

### Two entry paths

**Path A: Direct download (no challenge)**
Full onboarding — name, gender, years of experience, usage type (plans vs loose workouts), training preferences, focus muscle groups, injuries.

**Path B: Challenge invite (via magic code)**
Minimal onboarding — name, gender, level only (3 questions, ~30 seconds). Full onboarding deferred until after the reveal, via a gentle upsell card.

### Welcome screen

On first app open, user sees two clear options:
- "I have a challenge code"
- "I want to train"

### Onboarding for path A

- Name
- Gender
- Years of training experience (level indicator)
- Usage type: loose workouts OR plan-based training

If "plan" is chosen, additional questions:
- Training frequency per week
- Preferred split (PPL, Upper/Lower, other)
- Focus muscle groups
- Injuries or pain points

## 4. Core functionality

### 4.1 Workout generation (loose workouts)

User can start a workout and pick:
- Up to 4 muscle groups
- Desired duration

App generates a workout matching selection + onboarding level.

### 4.2 AI-generated workouts

Workout is assembled based on:
- Onboarding input
- Generator selections

Output contains:
- Exercises (from canonical exercise database)
- Sets and reps
- Logical order

### 4.3 Workout logging (critical)

During an active workout, per exercise the user can input:
- Weight
- Reps

Each set within each exercise is logged individually.

### 4.4 Smart progression steering

During logging, historical data is consulted:

**If exercise exists in dashboard:**
- Max weight is retrieved
- Last performance is shown

**In the workout UI:**
- "Last time: X kg for Y reps"
- Suggestion: same weight with more reps, or higher weight with minimum X reps

### 4.5 Workout completion

On completing a workout, per exercise:

**Check:** Does this exercise exist in the dashboard?

- **No:** add with max weight
- **Yes:** check for PR; if PR, overwrite max value

### 4.6 Workout history

- All workouts saved
- History available
- Data used for progression, suggestions, statistics

## 5. Statistics & dashboard

### Per exercise
- Max weight (PR)
- Last performance
- Historical performances (graph)

### Global statistics
- Total weight moved (all time, per period)
- Performance per period (monthly, weekly)

### "Fun facts" / insights
- Total kg benched this month
- Total squats this month
- Total training load
- Purpose: motivation, tangible progression

## 6. Training plan functionality

If user opts for plan-based training:

### Generation
- User can generate 1 plan for free
- Based on: onboarding input, frequency, preferred split, focus groups, injuries

### Output
- Full weekly schedule
- Structured training days
- Tailored to user

### In-app behavior
- User actively steered to log workouts
- Progression linked to plan

## 7. Social & viral features

No traditional community (no chat, no posts). Strong viral elements via challenges.

### 7.1 Sharing workouts

User can share a workout with someone else. Recipient:
- Opens via link
- Creates account (minimal onboarding)
- Can start workout directly

### 7.2 Challenges — mechanics

**Initiation:**
- User taps "challenge someone"
- Auto-generates:
  - Unique 6-character code (format: `ABC-123`, no confusing chars like 0/O, 1/I/L)
  - Landing page URL (`ronex.app/c/[code]`)
  - Personal message
- Shared via WhatsApp / system share

**Challenge code properties:**
- 6 chars: uppercase + digits (no 0/O/1/I/L)
- Expires after 7 days
- Single-use (one recipient per code)

**Recipient experience:**

If app not installed:
- Clicks link → landing page on `ronex.app/c/[code]`
- Page shows: sender info + challenge preview + download button
- Code is prominently displayed AND auto-copied to clipboard
- iOS App Store link

If app already installed:
- Universal Link opens app directly on challenge screen

First app open after install:
- "Do you have a challenge code?" screen
- Clipboard auto-detect: prefills code if present
- Enter code → match in Supabase → challenge loaded
- Alternative: "Continue without code" → regular onboarding

**Challenge invitee onboarding (minimal):**
- 3 questions: name, gender, level
- Duration: ~30 seconds
- Then straight into workout

### 7.3 Challenge competition mechanism

After both participants complete the workout:
- Winner determined by **total weight moved** over entire workout
- Handicap system applied (see 7.4)

### Rematch mechanic

After the reveal, only the **loser** can initiate a rematch.

- Button "Revanche eisen" / "Demand rematch" appears on loser's reveal screen
- Winner's reveal screen does NOT show this button (winner can only accept)
- Same workout, same weights as original challenge
- Push notification to winner when rematch is claimed
- No limit on rematches per challenge chain in MVP (monitor behavior, adjust later based on data)
- Available from profile / challenge history at any time — no time limit
- Each rematch gets its own reveal and its own potential rematch

Rationale: Loss is a stronger emotional driver than winning. Giving only the loser control makes rematch feel like agency, not bullying. Scarcity (only-one-person-can-press-this) increases perceived value of the action.

### 7.4 Challenge handicap system

**Automatic:** App applies handicap automatically based on both participants' data (gender + level + bodyweight combined into single multiplier).

**Technical approach (Option X):** Same workout, same weights. Scoring is adjusted behind the scenes via multiplier on total volume.

**Example:**
- Johnny (M, advanced, 90kg) and Lisa (F, intermediate, 60kg) both do 80kg bench for 8 reps × 4 sets
- Raw totals: Johnny 2560kg, Lisa 1280kg
- Lisa gets multiplier (combination of F + intermediate vs Johnny's M + advanced) of ~1.6x
- Adjusted: Johnny 2560kg, Lisa 2048kg
- Winner determined on adjusted totals

**What recipient sees on invite page:**
- Sender's name
- Sender's level (Beginner/Intermediate/Advanced)
- Sender's gender
- Vague hint: "This challenge is adjusted to level"
- **Never** the actual handicap math

**Social spark built in:**
Recipient sees sender's self-reported level, then chooses own level. Creates ego tension ("if he's advanced, what am I?"). Fuels the reveal moment.

**Sender's level source:**
Static — comes from their onboarding choice. User can update in settings later.

**What's asked of magic-link recipient:**
- Name
- Gender
- Level (Beginner/Intermediate/Advanced)

Bodyweight is optional (asked later if needed for better calibration).

### 7.5 Reveal & Instagram Story visual

After both participants complete the workout, a 3-phase Instagram Story visual is auto-generated:

**Phase 1:** Raw scores side by side
> "Johnny: 5000 kg — Lisa: 4500 kg"
> Looks like Johnny wins.

**Phase 2:** Handicap reveal
> "Challenge adjusted: +15% for Lisa"

**Phase 3:** Adjusted scores + winner
> "Lisa: 5175 kg — WINNER"

**Format:** Instagram Story dimensions (1080×1920). Animated (MP4 / GIF) ideally, static acceptable for MVP.

### 7.6 Profile & achievement overview

In user profile:
- Total challenges done
- Total challenges won
- Win percentage

### 7.7 Leaderboard system

**Default view: Leagues (Model C)**
- Tiers: Bronze → Silver → Gold → Platinum → Diamond
- ~20 users per league
- Everyone starts Bronze
- Promotion/degradation based on weekly total volume

**Metric:** Total weight moved (kg)

**Daily view (home screen):**
- Shows only users who trained today
- Ranked by today's total volume
- "X of 20 league members active today"
- Rest days: user disappears from today's list (no penalty, no negative positioning)

**Weekly ranking:**
- Accumulates daily totals over the week
- Reset Monday 00:00 local time
- Top 3 → promote, Bottom 3 → degrade
- All league members visible (including those not active today)

**Secondary view: Friends tab**
- Mutual follow (both sides accept)
- Max 100 friends
- All-time total volume metric
- Tab shown alongside League

**Challenges are separate:**
- W/L tracked in profile
- No impact on league position
- Challenges and leagues are parallel systems

## 8. Monetization

- First 14 days free
- Then: €3.99/month OR one-time lifetime price
- **iOS IAP required** (not Stripe) — via **RevenueCat**
- Free tier: 1 free plan generation, unlimited loose workouts, limited history

## 9. Core of the app

1. Generating workouts — fast, simple, personal
2. Logging performance — per exercise, per set
3. Monitoring progression — insightful, motivating, data-driven
4. Steering improvement — based on previous performance, during workout
5. Viral growth via competition — challenges, sharing, comparing, winning/losing

## 10. Key differentiation

- Focus on **basic exercises**
- Emphasis on **progression over variation**
- Active guidance during training
- Combination of: personal data + competition + shareability

## 11. Design principles

### Bilingual by default
- NL and EN are equal from day 1
- Copy agent writes each string natively in both, never translates
- Device locale detection with user override in settings

### Offline-first logging
- Workout logging must work without internet
- Local state → sync to Supabase when online
- Gym reception is bad, this is non-negotiable

### Canonical exercise database
- ~100-150 base exercises, centrally maintained
- AI picks from this list, does not free-generate
- Ensures reliable PR tracking across sessions

### Tone of voice
See `TONE.md`. Sharp but not teasing, dry, respectful. Humor through omission, not jokes.

## 12. Differentiation & Viral Mechanics

### Three core principles

1. **Ego as fuel** — The handicap reveal triggers ego responses. A woman beating a strong male friend, or a gym bro losing to someone he underestimated, must be shared. Ego vs ego vs app = sharing.

2. **Mystery > Information** — Deliberately don't tell users everything upfront. "Adjusted to level" without saying how. This creates tension that pays off in the reveal. Transparent apps don't create drama.

3. **Personal competition > Global competition** — A leaderboard with 100,000 people where you're #8473 is demotivating. A leaderboard of 20 in your league where you can promote is addictive. A challenge against 1 person you know is emotional.

### What makes Ronex unique

- **Handicap Reveal** — No other fitness app does automatic fairness adjustments with a dramatic 3-phase reveal. This is the killer mechanic.
- **Social level confession** — Recipient sees sender's claimed level and must choose their own. Creates ego tension before the workout even starts.
- **Challenge code as game element** — Deep-linking reframed as a game mechanic (secret code, auto-clipboard, "enter your code" as rite of passage).
- **Rest-day-friendly leagues** — Competitive system that doesn't punish healthy training. No daily pressure; rest days make you invisible, not penalized.

### What is NOT our differentiator (must-haves, not selling points)

- AI workout generation (everyone does this now)
- PR tracking (Hevy, Strong, dozens of others)
- Offline logging (expected)
- Training plans (MyFitnessPal, Fitbod, etc.)

These must work excellently, but they don't acquire users.

### Marketing implication

Do not message "AI-driven workouts for progression" — that's generic. Message around the viral mechanic:
- "Challenge your friends. The app determines the fair winner."
- "She claimed 'advanced'. What will you claim?"
- "Same workout. Different scoring. You'll find out how."

## 13. Information Architecture & Hierarchy

### Core principle: "Viral visibility, logging dominance"

- Challenges and leagues are immediately visible on app open (acquisition + social hook)
- Logging dominance is communicated via CONTENT, not via the tab bar itself (decision 2026-04-19):
  - Challenge-tab shows a prominent "Start workout" CTA / next-workout card in the top-third
  - The Workout-tab's own landing page has a large Start button visually dominant within its content
- Tab bar stays uniform and symmetric for quiet scannability. A 4-tab bar does not support a centre-weighted accent on position 2 without reading asymmetric.

Rationale: Challenges are not a daily habit (0-2× per week). Logging is (3-5× per week). We acquire via viral moments but retain via daily logging value.

### Bottom tab navigation

Four tabs (decision 2026-04-18: Leaderboard is NOT a standalone tab; it lives as a subsection at the top of the Challenge tab, with a CTA to a full leaderboard sub-screen).

1. **Challenge** (default landing tab on app open — contains Leaderboard subsection at top)
2. **Workout**
3. **Stats**
4. **Profile**

All 4 tabs render at 24pt Ionicons. Active state = lime tint on icon + label; inactive = content-secondary. No size-based or tint-based dominance on any single tab.

### Landing screen (Challenge tab) content order

From top to bottom:
1. **Leaderboard subsection** — own league tier + position + "X of 20 active today" + top 3-5 preview + "View full leaderboard" CTA (routes to sub-screen)
2. Own league status detail (if not fully covered in the Leaderboard subsection)
3. Today's volume (positively framed)
4. Primary CTA: "Send challenge"
5. Active challenges (waiting for reveal / waiting for opponent)
6. Training log preview (last 2-3 workouts)
7. Next workout suggestion widget
8. CTA to full history

The full leaderboard sub-screen (reached via the CTA) shows the complete ~20-member league ranking, weekly totals, promotion/degradation zones, and a secondary Friends toggle.

### Empty states as virality drivers

Every empty state promotes social behavior:
- No challenges: "Challenge someone — get a response within 5 minutes"
- No friends: "Add someone to see them on your leaderboard"
- Bronze League starter: "Start where everyone begins. Train to promote"

### Pitfalls to avoid

- Never frame league position negatively ("you're #18 of 20" becomes "Gold League — train today to climb")
- Challenges are visible but never mandatory (user can use app 100% without ever sending a challenge)
- Competition pressure must never overshadow the basic logging experience

## 14. UX Principles

### The goal: every screen understood in <1 second

When a user opens a screen, their brain has 600-800ms to answer three questions:
1. Where am I?
2. What can I do here?
3. What should I do now?

If any of these are unclear in the first second, attention is lost.

### The seven rules

**Rule 1: One screen, one job**
Every screen has one primary task, one primary action. Everything else is secondary. Lime-accent button for the most important thing. Gray button for "also possible but not required".

**Rule 2: Title tells what, not where**
Anti-pattern: "Home", "Dashboard", "My Profile"
Pattern: "Gold League", "Train Today", "Your Stats"
Titles that tell user state feel alive. Titles that describe navigation structure feel dead.

**Rule 3: Space is communication**
Whitespace (or in dark theme: ink-space) between elements tells the user what belongs together. 8px = related. 40px = conceptually separate. Use gap-y-2 for related items, gap-y-8 for distinct sections.

**Rule 4: The top third rule**
Users scan in an F-pattern. The top third of every screen is your only guarantee of attention. Important content lives in the top third. Nice-to-have lives below.

**Rule 5: Maximum three typographic levels per screen**
- Level 1: screen title or primary data (display-lg, 28-32px)
- Level 2: sections or secondary info (body, 16-18px)
- Level 3: labels, metadata (small caps, 11-12px)
Four levels is confusing. Two is flat. Three is the sweet spot.

**Typography tokens: casing variants within `small-caps` (level 3)**

The `small-caps` token has two permitted casing variants. Both share the same size (11-12px), weight (600), and tracking (1.5px) — only the casing rule differs. Both count as the SAME level in the 3-level hierarchy; choosing between them does not add a 4th level.

- `small-caps-label` — applied via the `uppercase` utility. Used for 1-2 word labels, tab labels, timestamps, metadata (e.g. "NAME", "CODE", "STAP 1 VAN 5"). This is the default and the most common variant.
- `small-caps-helper` — no `uppercase` utility, sentence-case preserved. Used for multi-line explanatory or helper text where uppercase would read as shouting (e.g. privacy disclosure under a sensitive form field). Introduced in T-108 on the onboarding identity screen, directly under the biological-sex selector.

Use `small-caps-helper` only for multi-line secondary text where `small-caps-label` would feel aggressive. For single-word labels, always use `small-caps-label`. When in doubt, uppercase wins.

**Rule 6: If you have to explain, the design is broken**
If a screen needs a tour to explain what it does, the design isn't done. Good apps show, they don't explain. Tooltips and onboarding overlays are last-resort patches.

**Rule 7: Progressive disclosure, not hide-and-seek**
Complexity reveals itself through user action, not hidden behind hamburger menus. Tap a workout → details unfold. NOT: complex options hidden in Settings.

### Per-screen checklist (Designer must answer before coding)

Every new screen requires these 7 answers documented in the task notes:

1. What is the ONE JOB of this screen?
2. What is the primary action? (the button that stands out)
3. What is the title? (tells what, not where)
4. What does a user see in the top third?
5. Which states are handled? (loading, empty, error, success, edge)
6. What happens if user does NOT take the primary action?
7. Can I halve the content of this screen?

The last question is the killer. Most screens are twice as full as they should be.

### Required states per screen

A screen is not complete until all states are defined:
1. Loading state: what the user sees while data loads
2. Empty state: first time, no data
3. Error state: network dead, API broken
4. Success state: everything works
5. Edge state: one item / many items / very many items

Many apps design only the success state and hope the rest resolves itself. That's how most UX bugs are born.

## 15. What Ronex is NOT

- Not a video workout library
- Not a community / chat platform  
- Not a nutrition tracker
- Not a cardio/running app
- Not a coaching platform
- Not a gym-management tool

If a feature doesn't serve logging, progression, or viral competition — it doesn't belong.

## 16. Future Considerations (Post-MVP)

Features intentionally deferred to post-launch. Documented here so they don't get lost.

### Weekly Hero
Auto-generated shareable Instagram Story visual for the user with the most challenge wins each week. Reset every Monday. Requires critical mass (~1000+ active users) to be impactful. Revisit after MVP validation.

### Friend Gauntlet
Challenge 5 friends simultaneously with the same workout, mini-leaderboard across the 5. Complex mechanic (1-to-N instead of 1-to-1). Requires validated 1-to-1 challenges first. Revisit at earliest Phase 9.

### Deferred on 2026-04-18 (MVP scope-cut)

**Fun facts widget** (was T-405 in Phase 4)
Deferred from MVP on 2026-04-18 — Stats screen already provides core progression insight; fun facts are motivational polish that can wait. Reconsider once beta feedback confirms users want additional motivational hooks on the Stats surface.

**Plan regeneration (paid)** (was T-510 in Phase 5)
Deferred from MVP on 2026-04-18 — 1 free plan + paywall hint sufficient for MVP; paid regeneration is revenue optimization for post-launch. Revisit after Phase 6 monetization data lands.

**Friends tab UI** (was T-727 in Phase 7)
Deferred from MVP on 2026-04-18 — Leagues + Challenges carry the viral load for MVP; Friends layer adds scope without proven lift. Revisit if users ask for it in beta or if league engagement plateaus.

**Friend search + invite flow** (was T-728 in Phase 7)
Deferred from MVP on 2026-04-18 — Cascade of the Friends tab deferral. No friends tab → no need for search/invite yet. Revisit alongside Friends tab.

**Rematch button in profile / challenge history** (was T-736 in Phase 7)
Deferred from MVP on 2026-04-18 — Reveal-screen rematch CTA covers the immediate emotional moment; profile-history rematch is week-later discovery, revisit with usage data. The T-739 analytics instrumentation will reveal whether delayed rematch claims are a real pattern.

### Pro mode (post-MVP)

Optionele global toggle in user profile: "Competitive mode — uitsluitend rauwe totaalscore voor challenges, geen handicap". Als beide users in een challenge Pro mode aan hebben, wordt handicap geskipt en rauwe scores vergeleken.

- Opt-in, niet default
- Globaal in profielsettings (niet per-challenge)
- Doel: gym-bro segment dat pure kracht-vergelijking wil zonder handicap-complexiteit
- Niet in MVP omdat: (1) handicap is killer feature, optionele mechanic ondermijnt viraal potentieel, (2) same-gender same-level scenario's krijgen al automatisch minimale handicap (zie Scenario C in t-101 proposal), (3) eerst valideren of er user-demand is
- Revisit criterium: na 1000+ MVP users. Als 10%+ klaagt over "willen geen handicap" → implementeer in V1.1.

### Unilateral time_seconds Reset — dual-side clear

MVP-gedrag (T-209 Fase 2): Reset wist alleen de huidige kant (L óf R). Intuïtief voor het meest-voorkomende scenario ("één kant verprutst, probeer opnieuw") zonder de al-gelogde tegenkant te verliezen.

Post-launch overwegingen als user-feedback het vraagt:
- Long-press Reset = wis beide sides (één interactie, ontdekbaar via long-press-patroon elders in de app)
- Of: twee expliciete reset-opties post-stop ("Reset deze kant" / "Reset beide")

Revisit-criterium: als tijdens beta meer dan één user rapporteert per ongeluk één kant behouden te hebben, of andersom.

### Deferred on 2026-04-19 (product decisions tranche)

**"Herhaal deze workout" CTA on workout-detail view**
Post-MVP action on read-only workout-detail screen: one-tap duplicate van complete historische workout (exercises + target weights/reps) naar een nieuwe active workout. Krachtig voor plan-users die een goede sessie willen herhalen. Phase 5 territory — hoort bij training-plan functionaliteit omdat duplicate-then-progress het natuurlijke plan-execution-patroon is. Revisit zodra T-506 (weekly schedule display) ship.

**PR-celebration sound toggle**
Post-MVP profile-tab setting: optional subtle success sound on PR-detection (default OFF). T-215 MVP ship levert alleen haptic + visual. Sound-toggle wordt relevant zodra users feedback geven dat PR-acknowledgement te subtiel is — niet voor MVP.

**Profile-tab post-MVP**
Bundle of profile features explicitly out of MVP scope:
- Profielfoto upload (Supabase Storage + cropper)
- Bio / beschrijving (140 chars, moderated)
- Notifications preferences (Phase 7+ zodra challenges push-driven zijn)
- Data export (GDPR Article 20, Phase 8+ compliance hardening)
- Theme switcher (dark-only bij launch; licht/system-follow pas als user-base het vraagt)

### Other candidates tracked for consideration
- Android version
- HealthKit integration
- Apple Watch companion
- Video exercise demos
- Rematch limit adjustment (monitor behavior 4 weeks post-launch)
- Equipment availability filtering — MVP kiest optie A (negeren). Post-launch: overweeg onboarding equipment-preferences of in-workout swap mechanic als user-feedback het vraagt.
