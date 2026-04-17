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

## 12. What Ronex is NOT

- Not a video workout library
- Not a community / chat platform  
- Not a nutrition tracker
- Not a cardio/running app
- Not a coaching platform
- Not a gym-management tool

If a feature doesn't serve logging, progression, or viral competition — it doesn't belong.
