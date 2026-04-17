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
