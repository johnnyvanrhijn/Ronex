# Ronex — Bug Tracker

> The Tester agent maintains this file. Format: one entry per bug.

## Format

```
## B-XXX: Short title
- **Severity**: critical | high | medium | low
- **Phase**: which phase was being tested
- **Status**: open | in progress | fixed | wontfix
- **Reported**: date
- **Device**: iPhone 15 Pro / Simulator iOS 17.4 / etc
- **Steps to reproduce**:
  1. ...
  2. ...
- **Expected**: what should happen
- **Actual**: what happens
- **Notes**: any additional context
```

## Severity guide

- **Critical (P0)**: app crashes, data loss, payment broken, core flow impossible
- **High (P1)**: feature broken but workaround exists, UX severely degraded
- **Medium (P2)**: annoying but not blocking, visual issues on non-primary flows
- **Low (P3)**: minor visual, typo, rare edge case

---

## Active bugs

### B-001: Email verloren bij app-close tijdens verify screen
- **Severity**: high (P1)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review (all devices)
- **Steps to reproduce**:
  1. Login met email op `/(auth)/login`
  2. OTP code wordt verstuurd, router.push naar `/(auth)/verify` met `email` param
  3. Sluit app volledig (swipe weg)
  4. Heropen app
- **Expected**: User komt terug op verify screen met zijn email ingevuld, kan code alsnog intypen
- **Actual**: AuthProvider heeft geen session dus `useProtectedRoute` redirect naar `/welcome`. De `email` param uit `useLocalSearchParams` is weg. User moet opnieuw beginnen — inclusief een nieuwe OTP aanvragen, terwijl de oude nog 5 min geldig is.
- **Notes**: Fix: persist pending email in AsyncStorage zodra `signIn` slaagt, en check op mount van welcome screen of er een pending verify is. Files: `app/(auth)/login.tsx:43-47`, `app/(auth)/verify.tsx:25`.

### B-002: Double-submit OTP bij snel dubbeltik of auto-submit race
- **Severity**: medium (P2)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Vul 6 digits snel in
  2. useEffect triggert `handleVerify` automatisch (verify.tsx:135-139)
  3. Gelijktijdig kan user op de Verify-knop drukken
- **Expected**: Eén verify call, altijd
- **Actual**: `isComplete` flipt naar true, useEffect fired; tegelijkertijd kan de knop-onPress vuren voor `loading` true wordt. Twee parallelle `verifyOtp` calls. Supabase zal de tweede afkeuren maar de UI toont "Verkeerde code" alert terwijl de eerste wél slaagde.
- **Notes**: Fix: voeg een `useRef` guard `isVerifyingRef.current` toe, of check `loading` in de useEffect dependency. `app/(auth)/verify.tsx:135-139`.

### B-003: Resend timer blijft tikken na unmount / back-navigation
- **Severity**: low (P3)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Ga naar verify screen
  2. Druk direct op back (timer staat op 60)
  3. Ga opnieuw naar verify (via login → send)
- **Expected**: Timer begint fris bij 60
- **Actual**: Timer begint correct bij 60 (nieuwe state), maar de oude setInterval in de unmounted component heeft soms nog 1 tick gedaan voor cleanup. Niet ernstig, maar je ziet een "setState on unmounted" warning in dev. `app/(auth)/verify.tsx:44-50` — de cleanup werkt, dit is cosmetisch.
- **Notes**: Negligible, maar check logs tijdens manual test.

### B-004: Verify screen crashed bij undefined email param (deep-link / refresh scenario)
- **Severity**: high (P1)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Navigeer direct naar `/(auth)/verify` zonder email param (bv. via deep link, expo-router fast refresh tijdens dev, of door `router.replace('/verify')` elders)
  2. Vul code in en druk verify
- **Expected**: User wordt netjes teruggestuurd naar login met een melding "vul eerst email in"
- **Actual**: `handleVerify` heeft een guard (`!email` return), dus geen crash, maar de knop blijft clickbaar, de loading spinner komt op, en er gebeurt niets. Stille failure = verwarrend. `otpSentTo` toont ook `Code gestuurd naar ` (lege email) — `app/(auth)/verify.tsx:170`.
- **Notes**: Fix: als email leeg is, redirect automatisch met useEffect naar `/(auth)/login`. Of toon duidelijke errorstate.

### B-005: Supabase timeout / traagheid geeft geen feedback
- **Severity**: medium (P2)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Zet device op extreem trage netwerkverbinding (Network Link Conditioner "Very Bad Network" of flight mode aan na knop tap)
  2. Druk "Stuur inloglink"
- **Expected**: Na bv. 10s timeout, heldere error "Geen verbinding"
- **Actual**: `signInWithOtp` heeft geen timeout. Spinner blijft oneindig draaien. User kan niks. Geen cancel-knop. `lib/auth.ts:8-21`.
- **Notes**: Fix: wrap calls in `Promise.race` met een timeout van ~15s, of catch specifieke Supabase error codes. Zelfde geldt voor `verifyOtp`.

### B-006: AsyncStorage corrupt / unreadable geeft stille faal
- **Severity**: medium (P2)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Hypothetisch: AsyncStorage is corrupt of onleesbaar (kan gebeuren na iOS restore, low disk)
  2. `supabase.auth.getSession()` in AuthProvider mount
- **Expected**: App start in logged-out state, geen crash
- **Actual**: `getSession().then(...)` heeft geen `.catch()` (providers/AuthProvider.tsx:34-37). Als de promise rejected, blijft `isLoading` forever true → oneindige blank screen.
- **Notes**: Fix: `.catch((err) => { console.warn('Session restore failed', err); setIsLoading(false); })`. Critical voor robustness.

### B-007: Expired OTP session (5 min) geeft generieke "Er ging iets mis"
- **Severity**: medium (P2)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Vraag OTP aan
  2. Wacht 6+ minuten
  3. Typ code in
- **Expected**: "Code verlopen. Vraag een nieuwe aan." (de key `auth.otpExpired` bestaat al)
- **Actual**: Supabase error.message komt ruw door (bv. "Token has expired or is invalid"), engels, geen gebruik van de NL key. `app/(auth)/verify.tsx:105-108`.
- **Notes**: Fix: parse de error code/message en map naar i18n keys (`otpExpired` vs `otpInvalid`).

### B-008: Welcome screen heeft twee identieke knoppen (beide naar /login)
- **Severity**: medium (P2)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Open app
  2. Welcome screen toont "Ik wil trainen" + "Ik heb een uitdagingscode"
  3. Beide navigeren naar `/(auth)/login`
- **Expected**: "Ik heb een uitdagingscode" routeert naar een code-entry flow
- **Actual**: Beide doen exact hetzelfde. `app/(auth)/welcome.tsx:40, 51`.
- **Notes**: Phase 0 scope bevat nog geen challenge flow, dus mag. Maar: of de tweede knop nu verbergen tot Phase 4, of visueel duidelijk maken dat het "binnenkort" is. Ook: gebruiker die per ongeluk de code-knop kiest snapt niet waarom ie hetzelfde login scherm ziet. @PM om te bevestigen of dit bewust is.

### B-009: Email trim/lowercase inconsistentie tussen login en resend
- **Severity**: low (P3)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. In login.tsx wordt email ge-trimmed en ge-lowercased bij send (login.tsx:43)
  2. Email param wordt zo doorgestuurd naar verify
  3. Resend in verify.tsx:122 gebruikt `email` direct (al lowercased, oké)
  4. verifyOtp in verify.tsx:103 gebruikt `email` direct
- **Expected**: consistent
- **Actual**: OK in huidige flow, maar fragiel. Als iemand in de toekomst de email source wijzigt (bv. uit een URL param die NIET gelowercased is) gaat dit stuk zonder test.
- **Notes**: Defensief: normalize email op één plek (helper `normalizeEmail`). Low priority, technical debt.

### B-010: Geen rate-limit feedback bij te vaak OTP aanvragen
- **Severity**: low (P3)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Vraag OTP aan
  2. Ga terug, vraag opnieuw aan
  3. Herhaal 5+ keer binnen 1 minuut
- **Expected**: Supabase rate-limit (default 1/60s per email) komt door als user-friendly bericht
- **Actual**: Supabase geeft "Email rate limit exceeded" — dit toont ruw in de alert. Users weten niet dat ze gewoon moeten wachten.
- **Notes**: Map error → `auth.resendCodeIn`-achtig bericht. De resend-flow in verify.tsx heeft al een 60s cooldown, dus dit raakt vooral users die heen-en-weer navigeren.

### B-011: Auto-focus timer (400ms) veroorzaakt keyboard-flicker bij snelle navigatie
- **Severity**: low (P3)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review (likely more visible on SE / older devices)
- **Steps to reproduce**:
  1. Login screen mount → 400ms timer focus
  2. User tikt snel op back binnen 400ms
- **Expected**: geen keyboard
- **Actual**: Keyboard pops up even na unmount (als de setTimeout afvuurt op een unmounted input). Cleanup werkt, maar de focus race is onzeker. `app/(auth)/login.tsx:29-34`, `verify.tsx:36-41`.
- **Notes**: Overweeg `requestAnimationFrame` of `InteractionManager.runAfterInteractions`.

### B-012: Missing i18n key voor back-knop aria-label toetst niet op ontbrekende NL strings
- **Severity**: low (P3)
- **Phase**: 0 — i18n
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Alle `t('common.back')`, `t('common.error')`, etc — present in beide files, OK
  2. `t('auth.otpSentTitle')` — present beide, OK
  3. Gecheckt: alle keys gebruikt in welcome/login/verify screens bestaan in nl.json en en.json
- **Expected**: complete coverage
- **Actual**: No missing keys found in auth screens. Good. BUT: there's no automated check, so future PRs can break this silently.
- **Notes**: Niet echt een bug nu. Suggestie voor later: script dat i18n keys uit source extract en vergelijkt met JSON files.

### B-013: `useProtectedRoute` segments check faalt voor nested routes
- **Severity**: medium (P2)
- **Phase**: 0 — auth / routing
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. Stel er komt later een `/(auth)/onboarding/name` route
  2. `segments[0] === '(auth)'` werkt dan nog, OK
  3. Maar stel een `/(modal)/something` of `/+not-found` — segments[0] is niet `(auth)` → redirect to welcome als session weg is
- **Expected**: Modal en not-found routes zijn toegankelijk zonder session (of met expliciete handling)
- **Actual**: Alle non-(auth), non-(tabs) routes zullen redirecten naar welcome zodra er geen session is. Prima voor nu, maar fragile. `app/_layout.tsx:80-98`.
- **Notes**: Overweeg een whitelist van public routes. Low impact voor Phase 0.

### B-014: Session listener update kan race met verifyOtp setSession
- **Severity**: low (P3)
- **Phase**: 0 — auth
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review
- **Steps to reproduce**:
  1. `verifyOtp` in AuthProvider roept `authVerifyOtp` en doet `setSession(newSession)` (providers/AuthProvider.tsx:57)
  2. Tegelijkertijd vuurt `onAuthStateChange` met dezelfde (of nieuwere) session
- **Expected**: Geen duplicate renders, geen stale state
- **Actual**: Twee `setSession` calls met dezelfde waarde. React dedupes dit meestal. Geen echte bug, wél unnecessary re-render. Simpler: niet zelf setSession doen na verifyOtp, gewoon `onAuthStateChange` laten doen.
- **Notes**: Refactor opportunity, niet blocking.

### B-015: iPhone SE small-screen: OTP boxes (48w x 60h) passen met 6 boxes + justify-between mogelijk niet
- **Severity**: medium (P2)
- **Phase**: 0 — layout
- **Status**: open
- **Reported**: 2026-04-17
- **Device**: static review (target iPhone SE 1st/2nd gen, 320-375pt wide)
- **Steps to reproduce**:
  1. Open verify screen op SE (375pt wide)
  2. 6 boxes × 48 = 288pt + 2×24 padding (px-6) = 48 → 336 content width. Past.
  3. Op SE 1st gen (320pt) — 288pt + padding = past krap, justify-between werkt
- **Expected**: Altijd past, geen overflow
- **Actual**: Theoretisch past het, maar met dynamic type large settings kunnen de boxes visueel groter worden dan 48pt. Geen `adjustsFontSizeToFit`. Overflow of boxes wrappen is mogelijk.
- **Notes**: Manual test op SE echt nodig. `app/(auth)/verify.tsx:174-213`.

---

### B-016: Injuries flush race — `setInjuries` via React setState is async but `flushOnboardingDraft` reads store synchronously

- **Severity**: high (P1)
- **Phase**: 1 — onboarding
- **Status**: FIXED 2026-04-19 (commit TBD by Johnny)
- **Reported**: 2026-04-19
- **How fixed**: Changed `flushOnboardingDraft` signature to accept an optional `FlushOverrides` object; any field passed here takes precedence over the zustand store. Updated `injuries.tsx` to pass `{ injuries: selected }` explicitly and removed the `setInjuries(selected)` write that created the ordering dependency. Race is now structurally impossible — the payload is built from the local `selected` array, not from a store that may or may not have committed yet. Files: `lib/onboarding.ts:177-199`, `app/(onboarding)/injuries.tsx:253`.
- **Device**: static review (all)
- **Steps to reproduce**:
  1. Op injuries screen, selecteer 1+ injuries (of "Niks aan de hand")
  2. Tap Start
  3. `handleStart` roept `setInjuries(selected)` (zustand setter via hook wrapper)
  4. Direct daarna `await flushOnboardingDraft()` → `useOnboardingDraft.getState()`
- **Expected**: Payload bevat precies de selectie die net getoond werd
- **Actual**: `setInjuries` is de zustand setter die via een hook-subscribed ref was gelezen; bij zustand is `set()` doorgaans synchroon dus dit werkt meestal correct. MAAR: omdat `setInjuries` als memoized function is gelezen via `useOnboardingDraft((s) => s.setInjuries)`, en zustand synchroon commits, is de risicoklasse meer "fragiel" dan "broken". Bij een React batched render (React 18 automatic batching) kunnen store-writes die binnen event-handlers gebeuren gewoonlijk synchroon doorkomen — maar een toekomstige refactor die de setter async maakt (bv. voor async validation) breekt dit stilzwijgend. Zie `app/(onboarding)/injuries.tsx:244-247`.
- **Notes**: Veiliger: geef `selected` direct mee als argument aan `flushOnboardingDraft(overrides)` of roep `useOnboardingDraft.setState({ injuries: selected })` synchroon aan. @backend. Niet blocking voor Phase 1 exit want zustand `set()` is synchroon, maar wel noteren.

### B-017: `mapError` substring `display_name` matches ANY error message mentioning that column → verwarrende "naam niet beschikbaar" toast

- **Severity**: medium (P2)
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. Trigger een unrelated update-fout waar Postgres toevallig `display_name` in de errorstring noemt (bv. permission-denied error of RLS-violation op een rij met display_name-colom in het policy-log)
  2. Of: wijzig profiles.display_name CHECK constraint ooit en Postgres rapporteert `new row for relation "profiles" violates check constraint "profiles_display_name_check"` — bevat subtring `display_name`
- **Expected**: Blocklist trigger → `nameNotAvailable`; CHECK length → `nameNotAvailable`; andere errors die toevallig "display_name" bevatten → `generic`
- **Actual**: `lowered.includes('display_name')` vangt te breed. Elke Postgres-error-message die "display_name" noemt (incl. irrelevante ones) wordt ten onrechte als `nameNotAvailable` gemapt. Zie `lib/onboarding.ts:97-101`.
- **Notes**: Precieze check: `lowered.includes('display_name contains prohibited word')` voor trigger en `lowered.includes('profiles_display_name_check')` voor CHECK constraint (Postgres error_code 23514 + specific constraint name). @backend.

### B-018: `mapError` network-detectie te eng — `AuthRetryableFetchError` / Supabase offline geeft vaak generieke msg zonder "network"

- **Severity**: medium (P2)
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. Airplane mode aan tijdens injuries-screen Start tap
  2. `supabase.from('profiles').update(...)` faalt met gotrue/PostgREST-specifieke error
- **Expected**: User ziet "Geen verbinding" toast en kan retry
- **Actual**: Supabase-js geeft in offline scenarios soms `{ message: 'TypeError: Network request failed' }` of `AuthRetryableFetchError`. De huidige check zoekt alleen op de tokens `network` / `fetch` / `timeout` / `offline`. `AuthRetryableFetchError` bevat "fetch" dus die slaagt — maar puur `Network request failed` in sommige RN-builds komt door als `TypeError` zonder die tokens. Zie `lib/onboarding.ts:103-110`.
- **Notes**: Voeg `typeerror` toe aan de match-lijst, of catch op de Supabase error-code/class. Ook: huidige code heeft geen timeout op de update-call → user met slecht netwerk ziet submitting-state voor eeuwig. @backend.

### B-019: Skip-link op experience screen triggert geen zichtbare feedback → user twijfelt of het werkte

- **Severity**: low (P3)
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. Op experience screen, tap "Weet ik niet precies"
  2. Direct router.push naar usage-type
- **Expected**: Duidelijk dat keuze is "geen antwoord" (haptic + push)
- **Actual**: Er wordt een haptic gefired, maar de bucket-rows staan nog gewoon in un-selected state en er is geen visueel confirmatiemoment. User kan denken dat hij per ongeluk heeft geskipt zonder te willen. `app/(onboarding)/experience.tsx:116-120`. @designer/PM.
- **Notes**: Nice-to-fix: kleine toast "Overgeslagen" of een heel korte 200ms flash. Niet blocking.

### B-020: Injuries "Niks aan de hand" — eerste mount toont `noneSelected=false` ook als DRAFT al `[]` was uit back-nav → user ziet geen "nog steeds geselecteerd" state

- **Severity**: medium (P2)
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. User selecteert "Niks aan de hand" op injuries-screen
  2. Tapt BackChevron → terug naar plan-preferences (of usage-type)
  3. Tapt Continue → opnieuw op injuries-screen
- **Expected**: "Niks aan de hand"-kaart is nog steeds in de geselecteerde (tinted) staat
- **Actual**: `noneSelected` wordt altijd `false` op mount omdat de store geen `noneSelected` persisteert. Injuries-array is `[]` maar de UI-distinctie tussen "user confirmeerde nothing" vs "user heeft nog niks gedaan" is weg. Als user Continue drukt zonder opnieuw op de kaart te tikken, wordt `[]` weggeschreven — same result. Maar de visual feedback is inconsistent met de rest van de funnel (experience/usage-type onthouden wel de selectie op back-nav). Zie `app/(onboarding)/injuries.tsx:157`.
- **Notes**: Fix: persist een `noneConfirmed: boolean` flag in de draft store, of hydrateer `noneSelected=true` als `storedInjuries.length === 0` EN de user eerder op deze screen is geweest (track via separate flag). @designer + @backend. Niet blocking — DB-state klopt uiteindelijk — maar gebruikerservaring op back-nav is suboptimaal.

### B-021: Back-nav van plan-preferences naar usage-type en daarna "Wijzig naar loose" → plan-fields gecleared, maar als user terug-swipet naar plan-preferences (die nu niet meer bereikbaar is via Continue) zien ze oude UI-state

- **Severity**: low (P3)
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. Kies plan op usage-type → push naar plan-preferences
  2. Kies frequency=4 + split=ppl
  3. Back → usage-type
  4. Wijzig naar loose → push naar injuries (store clear plan fields)
  5. Back → usage-type
  6. Swipe-back in stack (als gestureEnabled:true) → LANDT op plan-preferences? Of niet?
- **Expected**: Stack navigation rondom usage-type is voorspelbaar; als user terug swipt komt hij op de logische vorige screen
- **Actual**: Onduidelijk uit de code — `Stack` default pakt alleen het vorige frame. In scenario hierboven is het vorige frame plan-preferences (uit stap 2) óf usage-type na de loose-selectie route-push — depends on whether `router.push` stackt of replacet. Bij default push-gedrag blijft plan-preferences in de stack → swipe-back ZOU 'm weer tonen. Dan: store heeft `trainingFrequencyPerWeek=null` en `preferredSplit=null`, maar de lokale useState in dat screen laat mogelijk stale data zien? Nee — op mount wordt store gelezen, dus `freq=null, split=null` en isValid=false → Continue disabled. Geen crash maar wel een verwarrende visit. Bovendien is injuries NOG verder in stack — swipe-back van injuries na de loose-switch levert plan-preferences op, wat UX-onlogisch is.
- **Notes**: Fix-opties: (a) gebruik `router.replace` bij path-switch op usage-type zodat plan-preferences uit stack valt, (b) reset stack na path-switch. @designer. Priority laag want user kan alsnog voortgaan — alleen semantisch vreemd.

### B-022: Onboarding complete-gate flipt naar `true` na succesvolle flush, maar bij re-mount van AuthProvider (hot reload, app-resume via push) wordt `fetchProfile` opnieuw aangeroepen zonder caching → extra roundtrip op elke mount

- **Severity**: low (P3)
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. Complete onboarding → profile row heeft `onboarding_completed_at` gevuld
  2. Background de app en resume na 10s
  3. AuthProvider mount effect fires opnieuw, `getSession` + `fetchProfile`
- **Expected**: OK, voor correctness is re-fetch fine
- **Actual**: Werkt correct. Maar elke resume doet een extra profiles SELECT. Niet fout, wel wasteful voor toekomstige frequent mounts. Zie `providers/AuthProvider.tsx:120-153`.
- **Notes**: Niet blocking. Overweeg client-side cache met stale-while-revalidate (React Query o.i.d.) — post-MVP technical debt.

### B-023: RLS test via MCP niet uitvoerbaar in deze tester-sessie → RLS validatie puur code-review

- **Severity**: medium (P2) — niet een bug, een test-gap
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review only
- **Steps to reproduce**: N/A
- **Expected**: Tester kan via MCP `execute_sql` een tweede user simuleren en cross-user update proberen
- **Actual**: MCP Supabase tool niet beschikbaar in deze agent-sessie. Code-review: policies zien er OK uit (migration 20260418000000 lines 194-213):
  - `profiles_select_own`: `using (auth.uid() = id)` → OK
  - `profiles_update_own`: `using (auth.uid() = id) with check (auth.uid() = id)` → correct, both sides gated
  - `profiles_insert_own`: `with check (auth.uid() = id)` → OK
  - Geen DELETE policy → default deny (goed, want rij-cleanup gebeurt via `on delete cascade` op `auth.users`)
  - `banned_display_names`: `for all using (false)` → tabel niet direct leesbaar door clients (alleen via SECURITY DEFINER trigger). OK.
- **Notes**: Handmatig runtime verifiëren met 2 accounts of Supabase Studio is alsnog aanbevolen. Code zelf is correct. @backend om eventueel sanity-test te draaien.

### B-024: `preferred_split` enum-check via unknown-value injection → niet live te testen in statische review

- **Severity**: low (P3)
- **Phase**: 1 — onboarding / backend
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. Zou willen: patch de zustand store via devtools om `preferredSplit='bogus'` te zetten
  2. Tap Start op injuries
  3. Observe Supabase response
- **Expected**: Postgres weigert met "invalid input value for enum split_type_t"; client toont `generic` error toast
- **Actual**: Code-review: migration 20260419000000 creëert het enum correct (`ppl | upper_lower | full_body | custom`). Kolom is gealtered met USING-cast. `supabase.from('profiles').update({ preferred_split: 'bogus' })` wordt door PostgREST ge-serialiseerd en faalt op DB-level. `mapError` valt door op `generic`. OK in theorie. BUT: ik zie de mapError niet specifiek een "invalid input value for enum" tokeniseren. Toast wordt `common.errorToast` ("Niet gelukt. Probeer opnieuw.") — dat is prima, want dit is een client-side bug-pad die normale users niet raken.
- **Notes**: Manual verify gewenst. @backend om via SQL editor te testen: `update profiles set preferred_split='bogus' where id = 'a8830f1e-...';` → expect enum violation.

### B-025: Empty string `display_name` bypass — flush stuurt `draft.displayName.trim()` zonder validatie dat trimmed length >= 1

- **Severity**: high (P1)
- **Phase**: 1 — onboarding
- **Status**: FIXED 2026-04-19 (commit TBD by Johnny)
- **Reported**: 2026-04-19
- **How fixed**: Added a client-side guard in `flushOnboardingDraft` that returns `{ success: false, error: 'generic' }` when the trimmed display name is empty, BEFORE hitting Supabase. Prevents silent corruption from a draft with an empty or whitespace-only `displayName` and avoids the confusing "name not available" toast that would otherwise fire due to the overly-broad `display_name` substring match in `mapError` (which is itself B-017, intentionally left as P2 for Phase 2). Files: `lib/onboarding.ts:201-211`.
- **Device**: static review
- **Steps to reproduce**:
  1. Op identity screen, type "   " (alleen spaces) — maar `trimmedName.length >= 1` check blokkeert Continue, OK
  2. ALTERNATIEF: patch draft store via hot reload / devtools / vorige sessie met corrupt draft, zodat `displayName = ''`
  3. Start injuries Continue → flush stuurt `display_name: ''`
- **Expected**: DB CHECK `char_length(display_name) between 1 and 40` rejects → `nameNotAvailable` toast
- **Actual**: CHECK is `display_name is null OR char_length(...) between 1 and 40`. LEGE STRING IS GEEN NULL, is ook niet tussen 1-40 → rejected. Goed. Error-message bevat "display_name" substring → `mapError` → `nameNotAvailable` toast. User ziet verwarrend bericht ("Deze naam kan niet gebruikt worden") voor wat eigenlijk een edge-case is van een corrupte draft, niet een naam-keuze. Zie `lib/onboarding.ts:172`.
- **Notes**: Fix: client-side guard in flush: `if (!payload.display_name || payload.display_name.length < 1) return { success: false, error: 'generic' }`. Of: force re-entry to identity screen. @backend.

### B-026: Timezone-resolve met fallback `Europe/Amsterdam` — dit is wrong default voor non-NL users

- **Severity**: medium (P2)
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. User op JS runtime waar `Intl.DateTimeFormat().resolvedOptions().timeZone` throwt of undefined returnt (oudere Hermes / niet-standaard builds)
  2. Flush → `resolveTimezone()` valt terug op `'Europe/Amsterdam'`
  3. User zit in bv. New York → hele weekly league-reset logica is 6 uur verschoven
- **Expected**: Onbekende timezone → DB default (table default is óók `Europe/Amsterdam` trouwens) OF forceer detectie uit device locale
- **Actual**: Code: `resolveTimezone()` keert `'Europe/Amsterdam'` terug als Intl faalt. Voor Amsterdam-users klopt dit, voor internationale users is het een stil-fout. Zie `lib/onboarding.ts:66-74`.
- **Notes**: Overweeg `expo-localization` (Localization.timezone) als secondaire fallback vóór de Amsterdam-string. @backend. Niet blocking voor Phase 1 exit want MVP is NL-first.

### B-027: No submit-debounce gate op experience/usage-type/plan-preferences Continue tap — dubbele tap triggert potentieel twee `router.push`

- **Severity**: low (P3)
- **Phase**: 1 — onboarding
- **Status**: open
- **Reported**: 2026-04-19
- **Device**: static review
- **Steps to reproduce**:
  1. Tap Continue op experience (bv.) 2x zeer snel
  2. Beide tap-events fire `handleContinue` → `router.push` wordt 2x aangeroepen
- **Expected**: Eén navigatie
- **Actual**: Expo Router dedupet meestal snelle duplicate pushes, maar er is geen expliciete guard. injuries.tsx heeft wel `submitting` state; de andere screens niet. Niet catastrofaal want ze pushen naar dezelfde route.
- **Notes**: Niet blocking. Defensief: voeg `const [pushing, setPushing] = useState(false)` toe en gate.

---

### B-028: Finish-flow bootstrap-race — ResumeCard + lege "actieve" workout na "Klaar"

- **Severity**: high (P1)
- **Phase**: 2 — workout logging (T-209 Phase 2 device-test)
- **Status**: fixed (2026-04-19)
- **Reported**: 2026-04-19 (Johnny, device-test T-209 Phase 2)
- **Device**: physical iPhone
- **Steps to reproduce**:
  1. Log een workout met ≥1 completed set
  2. Tap "Klaar" → bevestig in FinishSheet
  3. App navigeert terug naar Challenge-tab
- **Expected**: Challenge-tab toont geen ResumeCard (workout is afgerond + gesynced)
- **Actual**: ResumeCard blijft zichtbaar met tikkende timer. Tap "Verder" → active-screen toont "Nog niks gelogd" (lege sets)
- **Root cause**: `app/workout/active.tsx` bootstrap-useEffect had `[startedAt, completedAt, startWorkout]` als deps. In de finish-flow:
  1. `completeWorkout()` zet `completedAt`
  2. 500ms timeout: `resetWorkout()` → beide null
  3. Screen is nog mounted → useEffect re-firet op dep-change
  4. Ziet `startedAt===null && completedAt===null` → `startWorkout('manual')` → startedAt = new Date()
  5. `router.back()` → Challenge-tab ziet `startedAt!==null && completedAt===null` → ResumeCard met fresh 0:00 timer
- **Fix**: Bootstrap mount-only gemaakt via `useActiveWorkout.getState()` i.p.v. reactive selectors. Effect fired nu alleen op mount, niet op state-transities tijdens teardown.
- **Notes**: Ontdekt bij T-209 Phase 2 device-test. Fix is één `useEffect` in `app/workout/active.tsx`; zelfde pattern zou elders ook misbruikt kunnen zijn — tester kan check doen of er andere bootstrap-effects met reactive deps op de store staan.

---

### B-029: Geen optie om hele oefening-bucket te verwijderen in active-workout

- **Severity**: medium (P2)
- **Phase**: 2 — workout logging
- **Status**: fixed (2026-04-19)
- **Reported**: 2026-04-19 (Johnny, device-test T-209 Phase 2)
- **Device**: physical iPhone
- **Steps to reproduce**:
  1. Voeg meerdere oefeningen toe aan een workout
  2. Probeer een hele oefening te verwijderen (bv. per ongeluk verkeerde gekozen)
- **Expected**: Mogelijkheid om exercise-bucket te verwijderen (analoog aan set-delete)
- **Actual**: Je kunt alleen per-set × tappen — je moet elke set één-voor-één wissen om een oefening te verwijderen, en zelfs dan blijft de laatste set staan (want `last-set-in-group → auto-add fresh`)
- **Notes**: Designer moet mockup voorstellen. Suggestie: klein × op exercise-header + bevestigings-modal omdat N sets tegelijk wissen een grotere destructieve actie is dan een single-set delete. Workflow: × → modal ("Verwijder [naam]? X sets gaan verloren") → confirm.
- **Fix (2026-04-19)**: Header × icon + new `DeleteExerciseModal` + store.`removeExercise(exerciseId)`. Files: `stores/activeWorkout.ts`, `components/workout/ExerciseGroup.tsx`, `components/workout/DeleteExerciseModal.tsx` (new), `app/workout/active.tsx`, `i18n/{nl,en}.json` (`workout.deleteExercise*` keys, pluralized body). Server-orphan policy mirrors `removeSet` (Phase 3 cleanup).

---

## Fixed bugs

*None yet.*

---

## Wontfix

*None yet.*

---

## Phase 0 manual test checklist

Run through these on device (iPhone 15 Pro first, dan SE of simulator 320pt als mogelijk):

### Happy path
- [ ] Open app eerste keer → welcome screen verschijnt, fonts zijn Inter, achtergrond #0A0A0A
- [ ] Tap "Ik wil trainen" → login screen, email input heeft focus na ~400ms
- [ ] Typ valid email, tap "Stuur inloglink" → verify screen, email staat in subtitle
- [ ] Ontvang email, typ 6 digits → auto-submit triggert, landing op tabs
- [ ] Kill app, heropen → direct op tabs (session restored)

### Unhappy path — netwerk
- [ ] Airplane mode aan, tap "Stuur inloglink" → nette error, geen oneindige spinner
- [ ] Airplane mode aan tijdens verify → nette error, code niet verloren

### Unhappy path — user gedrag
- [ ] Sluit app op verify screen → heropen → wat gebeurt? (bug B-001 — nu terug op welcome, dat is verkeerd)
- [ ] Tap "Stuur inloglink" 3x snel achter elkaar → 1 email, niet 3
- [ ] Typ 6 digits en tap ook snel op Verify-knop → 1 verify call, geen dubbele error alert (bug B-002)
- [ ] Typ 5 digits, tap back, ga opnieuw door login flow → timer is reset, werkt normaal
- [ ] Tap resend code → nieuwe code binnen, timer op 60 geeft nette cooldown
- [ ] Typ verkeerde code → alert, boxes leeg, focus op eerste box
- [ ] Wacht 6+ minuten, typ de code → error "code verlopen" (niet generieke error) (bug B-007)

### OTP input edge cases
- [ ] Paste een 6-digit code in de eerste box → alle boxes vullen zich
- [ ] Paste "AB12CD34" → alleen digits, max 6
- [ ] Backspace in midden van code → verwijdert vorige, focus schuift terug
- [ ] Tik op box 4 direct → focus springt daarnaartoe
- [ ] Tap op iOS auto-fill van SMS (als test met SMS) → vult automatisch in

### Auth state
- [ ] Log uit (als signOut UI bestaat) → terug naar welcome
- [ ] Zet device op andere taal (NL ↔ EN) in Settings → app start opnieuw in juiste taal
- [ ] Fresh install (delete + reinstall) → welcome screen, geen oude sessie
- [ ] Meerdere keren snel back-forward navigeren tussen login/verify → geen crashes, geen stale state

### Layout / visueel
- [ ] iPhone SE (of sim 375pt): OTP 6 boxes passen zonder overflow
- [ ] Dynamic type XL in iOS settings: UI breekt niet catastrofaal
- [ ] Dark theme correct, geen white flashes tijdens navigation
- [ ] SafeArea respecteert notch en home-indicator
- [ ] Keyboard overlapt niet de "Verifieer" knop dankzij KeyboardAvoidingView

### i18n
- [ ] Device NL: alle teksten Nederlands, geen key-strings ("auth.loginTitle") zichtbaar
- [ ] Device EN: alle teksten Engels
- [ ] Email in `otpSentTo` interpolatie werkt ({{email}} vervangen)

### Performance
- [ ] Cold start < 2s tot welcome screen (met goed netwerk)
- [ ] Transitie welcome → login smooth, geen jank
- [ ] Auto-submit van OTP voelt instant

### Supabase dashboard check (niet op device, maar handig)
- [ ] OTP length confirmed 6 (niet 8)
- [ ] RLS policies op profiles table actief (al is die table nog niet gebruikt in Phase 0)
- [ ] Email template bevat de 6-cijferige code prominent
