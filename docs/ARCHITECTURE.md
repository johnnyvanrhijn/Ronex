# Ronex — Technical Architecture

> Skeleton architecture doc. Backend agent maintains this as the system evolves.

## Setup log

### 2026-04-17 — T-001: Expo project initialized
- Expo SDK 54 (latest stable) with tabs template
- React Native 0.81.5, React 19.1.0
- TypeScript 5.9.2, strict mode enabled
- Expo Router v6 with typed routes (`experiments.typedRoutes: true`)
- New Architecture enabled (`newArchEnabled: true`)
- iOS-first: `supportsTablet: false`, bundleIdentifier `app.ronex.ios`
- Android config preserved for later: package `app.ronex.android`
- Deep link scheme: `ronex`
- Path alias `@/*` configured in tsconfig.json

## Stack overview

```
┌─────────────────────────────────────┐
│   iPhone (React Native + Expo)     │
│   - Expo Router (navigation)        │
│   - NativeWind (Tailwind)           │
│   - i18next (NL + EN)               │
│   - Zustand (state)                 │
│   - TanStack Query (data)           │
│   - AsyncStorage (offline cache)    │
└─────────────────────────────────────┘
              │ HTTPS
              ▼
┌─────────────────────────────────────┐
│  Supabase (Backend-as-a-Service)   │
│  - Postgres (data)                  │
│  - Auth (magic link)                │
│  - Storage (images)                 │
│  - Edge Functions (Deno):           │
│    - generate-workout               │
│    - generate-plan                  │
│    - revenuecat-webhook             │
│    - weekly-league-rollover (cron)  │
│  - RLS policies (security)          │
└─────────────────────────────────────┘
              │
   ┌──────────┼──────────┐
   ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌─────────────┐
│Claude│  │Rev.  │  │Vercel        │
│ API  │  │Cat   │  │(landing page │
│      │  │      │  │ for challenge│
│      │  │      │  │ codes)       │
└──────┘  └──────┘  └─────────────┘
```

## Key decisions

### Why Supabase?
- Postgres (real database, not key-value)
- Auth built-in
- Edge Functions without separate server
- RLS for security
- Free tier generous enough for MVP
- Scales to paid when needed

### Why React Native + Expo (not Swift)?
- Solo builder, faster iteration
- Android later for free (same codebase)
- TypeScript = familiar
- EAS Build handles iOS complexity
- Hot reload during development

### Why RevenueCat (not direct StoreKit)?
- iOS IAP is complex (receipts, webhooks, sandbox)
- RevenueCat free until $2.5k MTR
- One API across iOS + Android
- Dashboard for debugging

### Why canonical exercise DB (not free AI generation)?
- Reliable PR tracking (stable exercise_id)
- Consistent AI outputs
- Smaller prompts = cheaper AI calls
- Easier to ship

### Why offline-first logging?
- Gym reception is terrible
- Non-negotiable for core flow
- Data integrity > syncing convenience

## Data model (initial)

Core tables:

### `profiles`
User metadata, linked to auth.users
```
id (uuid, PK, = auth.users.id)
name (text)
gender (enum: male, female, other)
experience_level (enum: beginner, intermediate, advanced)
usage_type (enum: loose, plan)
bodyweight_kg (numeric, nullable)
locale (text, default 'en')
is_pro (bool, default false)
created_at (timestamp)
```

### `exercises` (canonical, seeded)
```
id (uuid, PK)
slug (text, unique)
name_en (text)
name_nl (text)
primary_muscle (enum)
secondary_muscles (enum[])
equipment (enum: barbell, dumbbell, machine, bodyweight, cable)
is_compound (bool)
```

### `workouts`
```
id (uuid, PK)
user_id (uuid, FK)
started_at (timestamp)
completed_at (timestamp, nullable)
source (enum: ai_generated, plan, manual, challenge)
plan_id (uuid, FK, nullable)
challenge_id (uuid, FK, nullable)
```

### `workout_sets`
```
id (uuid, PK)
workout_id (uuid, FK)
exercise_id (uuid, FK)
set_number (int)
weight_kg (numeric)
reps (int)
completed (bool)
logged_at (timestamp)
```

### `personal_records`
```
id (uuid, PK)
user_id (uuid, FK)
exercise_id (uuid, FK)
max_weight_kg (numeric)
reps_at_max (int)
achieved_at (timestamp)
workout_id (uuid, FK)
-- unique (user_id, exercise_id)
```

### `plans`
```
id (uuid, PK)
user_id (uuid, FK)
frequency_per_week (int)
split_type (enum: ppl, upper_lower, full_body, custom)
focus_muscles (enum[])
injuries (text[])
weekly_schedule (jsonb) -- array of workout templates
created_at (timestamp)
```

### `challenges`
```
id (uuid, PK)
code (text, unique, 6 chars) -- ABC-123
sender_id (uuid, FK)
recipient_id (uuid, FK, nullable) -- filled on acceptance
workout_template (jsonb) -- exercises, sets, weights
sender_workout_id (uuid, FK, nullable)
recipient_workout_id (uuid, FK, nullable)
handicap_multiplier (numeric, nullable) -- applied to recipient
status (enum: pending, in_progress, completed, expired)
created_at (timestamp)
expires_at (timestamp) -- created + 7 days
completed_at (timestamp, nullable)
```

### `friendships`
```
user_id (uuid, FK)
friend_id (uuid, FK)
status (enum: pending, accepted)
created_at (timestamp)
-- composite PK (user_id, friend_id)
-- max 100 per user enforced in app logic
```

### `leagues`
```
id (uuid, PK)
tier (enum: bronze, silver, gold, platinum, diamond)
members (uuid[], max 20)
week_start (date) -- Monday
```

### `league_daily_volume`
```
user_id (uuid, FK)
league_id (uuid, FK)
date (date)
total_volume_kg (numeric)
-- composite PK (user_id, date)
```

### `league_weekly_totals`
Materialized from daily, used for promotion/degradation.

## RLS policies (critical)

Every table gets RLS enabled. Default DENY. Explicit policies per access pattern.

Example for `workouts`:
```sql
-- User can read own workouts
CREATE POLICY "users_read_own_workouts" ON workouts
  FOR SELECT USING (auth.uid() = user_id);

-- User can insert own workouts
CREATE POLICY "users_insert_own_workouts" ON workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User can update own unfinished workouts
CREATE POLICY "users_update_own_workouts" ON workouts
  FOR UPDATE USING (auth.uid() = user_id AND completed_at IS NULL);
```

Challenge visibility is more nuanced: both sender and recipient need access post-acceptance. Landing page (public) uses a separate read-only view with limited fields.

## Edge Functions

### `generate-workout`
Input: user_id, muscle_groups[], duration_min, onboarding_context
→ Calls Claude API with structured prompt
→ Returns JSON: exercises[] with sets/reps
→ Rate-limited per user (e.g., 5 per hour for free, unlimited pro)

### `generate-plan`
Input: user_id, preferences
→ Calls Claude API with larger prompt
→ Returns JSON: weekly schedule with workout templates
→ Gated to 1 free, then pro-only

### `revenuecat-webhook`
Input: RevenueCat webhook payload (signed)
→ Verifies signature
→ Updates `profiles.is_pro` accordingly
→ Logs event

### `weekly-league-rollover` (cron)
- Runs Monday 00:00 UTC (adjust per timezone later)
- Calculates weekly totals per league
- Top 3 promote, Bottom 3 degrade
- Redistributes leagues to keep ~20/league
- Emits events for user notifications

## Frontend architecture

### State management
- **Zustand** for client state (current workout in progress, UI state)
- **TanStack Query** for server state (cached queries, optimistic updates)
- **AsyncStorage** for offline persistence

### Offline workout flow
1. User starts workout → local Zustand store
2. Every set logged → also persisted to AsyncStorage
3. Workout complete → queued for sync
4. Network available → sync to Supabase, clear queue
5. On app start → check queue, retry pending syncs

### Navigation structure
```
/app
  /(auth)
    /welcome
    /login
    /onboarding
  /(tabs)
    /home
    /workout
    /challenges
    /leaderboard
    /profile
  /workout/[id]  -- active workout
  /challenge/[code]  -- direct link handling
```

## Deployment

- **Development**: `expo start` with Expo Go on physical device
- **Internal testing**: EAS Build dev profile, install via link
- **Beta**: EAS Build preview profile → TestFlight
- **Production**: EAS Build production profile → App Store
- **OTA updates**: EAS Update for JS-only changes (no native deps)

## Environment variables

```
# .env.local (gitignored)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=

# Edge Function secrets (set via Supabase CLI)
ANTHROPIC_API_KEY=
REVENUECAT_WEBHOOK_SECRET=
```

## Security notes

- API keys never in client code (only public keys like Supabase anon)
- All Claude API calls go through Edge Functions
- RLS on every table, no exceptions
- Challenge codes expire, one-time use
- RevenueCat webhooks verified via signature
- User bodyweight is optional and private (not shown to others)

## Monitoring (later)

Not MVP, but candidates for later:
- Sentry for crash reporting
- PostHog for product analytics
- Supabase built-in query analytics

## Open architectural questions

Things to decide during building:
- [ ] Local DB: plain AsyncStorage vs WatermelonDB vs MMKV?
- [ ] Image generation for Story reveal: client-side (Skia) vs server-side (Edge Function with satori)?
- [ ] Push notifications: Expo Push vs OneSignal?
- [ ] Analytics: now vs post-launch?
