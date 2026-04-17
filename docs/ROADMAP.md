# Ronex — Roadmap

> 12-week plan, 8 phases. The PM agent uses this as the strategic backbone. Tasks per phase live in `tasks.json`.

## Strategic priorities (in order)

1. **Speed to MVP** — ship something usable fast
2. **Low cost** — stay on free tiers, avoid premature optimization
3. **Premium native feel** — once core works, polish matters
4. **Android later** — iOS first, Android after product-market fit

## Phase overview

| # | Phase | Weeks | Goal | Exit criteria |
|---|-------|-------|------|--------------|
| 0 | Foundation | 1 | "Hello world" on iPhone via Expo Go | Auth works, basic nav, i18n setup |
| 1 | Exercise DB + Onboarding | 2 | User can sign up and save profile | Onboarding flow complete, exercises seeded |
| 2 | Workout Logging | 3-4 | Core logging works offline | Start → log → complete → PR detected |
| 3 | AI Workout Generator | 5 | Workouts generated from inputs | Edge Function returns valid workouts |
| 4 | Stats & Dashboard | 6 | User sees progression **← TestFlight validation moment** | Graphs, PR history, global stats |
| 5 | Training Plan | 7-8 | User gets a weekly plan | Plan generated, displayed, logged against |
| 6 | Monetization | 9 | Paywall works | RevenueCat integrated, is_pro flag synced |
| 7 | Challenges & Leagues | 10-11 | Viral mechanics work | Challenge flow end-to-end, leagues populated |
| 8 | Polish & App Store | 12 | App submitted | Submitted to Apple review |

## Phase 0 — Foundation

**Week 1 — Goal: "Hello world" on your iPhone**

- Expo project initialized with TypeScript
- Supabase project created, RLS enabled by default
- Auth working (magic link email)
- Basic navigation with Expo Router
- NativeWind (Tailwind for RN) configured
- **i18n setup with i18next + expo-localization (NL + EN)**
- Design tokens defined (colors, spacing, typography)
- Expo Go works on physical iPhone
- CI-ready (eas.json, app.json)

**Exit:** You can scan a QR code, open the app, log in with email, see a home screen in your device language.

## Phase 1 — Exercise DB + Onboarding

**Week 2 — Goal: User signs up, chooses plan/loose, profile saved**

- Canonical exercises table in Supabase (~100-150 exercises, seeded)
- Exercise categories (muscle groups)
- User profile table with: name, gender, experience_level, usage_type, plan_preferences, injuries
- Welcome screen: "challenge code" vs "start training"
- Full onboarding flow (6-8 screens)
- Minimal onboarding flow (3 screens for challenge invitees)
- All copy in NL + EN

**Exit:** A new user can complete onboarding end-to-end and their profile is in Supabase.

## Phase 2 — Workout Logging (core)

**Weeks 3-4 — Goal: The app's reason to exist**

This is the most important phase. If logging feels bad, nothing else matters.

- Workout creation: pick exercises, set targets
- Active workout UI (big buttons, gym-friendly)
- Per-set logging: weight + reps
- Offline-first: local state, sync when online
- Historical data surfacing: "last time X kg for Y reps"
- Progression suggestion: same weight + more reps, OR more weight + min reps
- Workout complete flow
- PR detection and storage
- Workout history screen

**Exit:** You can go to the gym without internet, log a full workout, and see your PR updated when you get home.

## Phase 3 — AI Workout Generator

**Week 5 — Goal: App suggests workouts**

- Supabase Edge Function: `generate-workout`
- Claude API integration (via Anthropic)
- Prompt engineering: takes user profile + muscle groups + duration + exercise list → returns structured workout
- JSON schema validation on response
- Integration with logging flow from Phase 2
- Error handling: fallback to template workouts if API fails
- Rate limiting per user

**Exit:** User picks 3 muscle groups + 45 min, gets a sensible workout with exercises from the canonical DB.

## Phase 4 — Stats & Dashboard — **TestFlight beta moment**

**Week 6 — Goal: Show progression, validate with real users**

- Per-exercise history view (graph over time)
- Per-exercise PR display
- Global stats screen:
  - Total weight moved (all-time, this month, this week)
  - Total reps per exercise
  - Training load graphs
- "Fun facts" widgets:
  - "This month you benched [x] kg total"
  - "You're on a [n]-day streak"
- Home screen shows: next workout suggestion + today's progress

**Exit + validation moment:** Submit a TestFlight build. Invite 5-10 friends to test logging end-to-end. Listen carefully. This is the moment to kill or double down.

## Phase 5 — Training Plan

**Weeks 7-8 — Goal: Plan-based training**

- Plan generation Edge Function (extends Phase 3)
- Plan preferences in onboarding already captured — use them now
- Weekly schedule UI: "Monday: Push, Wednesday: Pull, ..."
- Current plan view on home screen
- Plan progress tracking (weeks completed)
- 1 free plan limit enforced (paywall preview)
- Plan regeneration (paid feature)

**Exit:** User can request a plan, sees their week laid out, and logs workouts against specific plan days.

## Phase 6 — Monetization

**Week 9 — Goal: Accept payments, unlock premium**

- RevenueCat account + SDK integrated
- Subscription product configured in App Store Connect
- 14-day trial logic
- Paywall screen
- `is_pro` flag on user profile
- Webhook from RevenueCat → Supabase Edge Function → update is_pro
- Feature gating:
  - Free: 1 plan, unlimited loose workouts, 30-day history
  - Pro: Unlimited plans, full history, advanced stats

**Exit:** You can run a full subscription lifecycle in sandbox: start trial → convert → cancel → resubscribe.

## Phase 7 — Challenges & Leagues

**Weeks 10-11 — Goal: Viral growth mechanics**

- Challenge creation flow
- Challenge code generation (6-char, unique, 7-day expiry)
- Landing page on web (hosted Vercel, free tier): `ronex.app/c/[code]`
- Universal Links configured (app opens directly if installed)
- Clipboard auto-copy on landing page
- First-app-open "challenge code" input screen
- Challenge workout flow (reuses logging from Phase 2)
- Handicap calculation logic (gender + level + bodyweight → multiplier)
- 3-phase reveal (raw → handicap reveal → adjusted winner)
- Instagram Story visual generation (1080×1920)
- Share flow to Instagram / WhatsApp
- Daily league leaderboard
- Weekly promotion/degradation cron job
- Friends tab (mutual follow, max 100)
- Friend invitations

**Exit:** You can send a challenge to someone who doesn't have the app, they install, do the workout, see the reveal, and share on Instagram.

## Phase 8 — Polish & App Store

**Week 12 — Goal: Ship it**

- Bug bash (review all of `BUGS.md`)
- Empty states for every screen
- Error handling for every network call
- Loading states
- Accessibility pass (VoiceOver labels)
- Performance audit (image sizes, render times)
- App Store assets:
  - Icon (1024×1024)
  - Screenshots (3-5 per device size)
  - App Store description (NL + EN)
  - Keywords
  - Privacy policy page
  - Support URL
- Final EAS build
- Submit to App Review

**Exit:** Ronex is in App Review.

## Not in 12-week plan (future)

Future candidates for post-launch:
- Android version
- HealthKit integration
- Apple Watch companion
- Social feed / posts
- Video exercise demos
- Nutrition integration
- Cardio tracking
- Coaching / PT marketplace

## Milestones

- **End of Week 1**: Project is real, can run on phone
- **End of Week 4**: Core logging works (internal milestone)
- **End of Week 6**: TestFlight beta with real testers
- **End of Week 9**: Payments flow complete
- **End of Week 11**: First viral challenge sent
- **End of Week 12**: Submitted to App Store

## Notes

- Phase durations are estimates. Some will go faster, some slower. The PM agent adjusts as we learn.
- TestFlight validation at end of Phase 4 is sacred. Do not skip.
- Phase 7 is the viral growth investment. It's the biggest risk AND the biggest reward.
- If something drags beyond 1.5× estimated time: escalate to user, re-scope, don't just push through.
