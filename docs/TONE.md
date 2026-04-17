# Ronex — Tone of Voice

> This is the living brand voice document. The Copy agent reads this before writing any string. Updates happen as the brand evolves.

## Style in one sentence

Sharp but not teasing, dry, respectful. Humor lives in what we *don't* say.

## References (models to think by)

- **Wise** — factual with character
- **Oatly** — self-aware, dry
- **Mailchimp** — warm without fluff
- **Linear** — precise, respectful of users

Not a reference:
- **Nike / Strava** — too stoic/premium for our speak
- **Duolingo** — too playful, we're tamer than that

## Core principles

### 1. Omission carries the tone

Humor and character live in what we leave out, not in jokes added.

- "Done" > "Nice work! You did it! 🎉"
- "85 kg bench. New PR." > "Amazing! You just hit a new personal record!"

Every extra word costs character. Cut until it's plain.

### 2. Respect the user

Users are adults who've tried 100 apps. Don't explain the obvious. Don't hand-hold. Don't "oops" at them.

### 3. Celebrations don't inflate

A PR deserves a moment. Finishing a set does not. If we celebrate everything, nothing is celebrated.

Save emoji and visual flair for: new PRs, challenge wins, league promotions. Everything else gets flat text.

### 4. Questions as invitations

Questions invite without pushing. No pressure, no guilt.
- "Yesterday no workout. Today?" — not "You missed yesterday, get back on track!"
- "Still 3 reps. Try again?" — not "Don't give up! You got this!"

### 5. Dry closings

End factually. Never end on motivation or enthusiasm.
- "Nice work." > "You're crushing it!!!"
- "Saved." > "Great job saving your workout!"

The factuality is what makes it believable.

## Structural frameworks

### CTAs — always verb-first

✅ "Start workout"
✅ "Log set"
✅ "Challenge back"
❌ "Ready to go?"
❌ "Let's get started!"
❌ "Time to train!"

Max 20 characters per language (layout reasons).

### Error messages — 3-part structure

1. What happened (factual)
2. Why (brief, optional)
3. What user can do now

**Bad:**
> "Oops! Something went wrong :("

**Good:**
> "Workout not saved. No connection. It'll sync when you're back online."

### Empty states — 3-part structure

1. What's not there (validate)
2. Why that's OK (reassure)
3. First step

**Example — no workouts yet:**

NL:
> Nog niks gelogd.
> Dat verandert vanaf je eerste set.
> [Start workout]

EN:
> Nothing logged yet.
> That changes with your first set.
> [Start workout]

### Onboarding — progressive disclosure

- Max 1 question per screen
- Context before input when useful
- Never more than 5 steps without delivering value

### Challenge copy — 3-act structure

**Act 1: Invite (curiosity)**
> "Johnny challenges you."

**Act 2: Workout (focus, no fluff)**
> "Set 2 of 4"

**Act 3: Reveal (drama)**
> "Johnny's in. Time to see who was right."

## Hard rules

### NEVER

- Uitroeptekens in body copy (allowed only in genuine PR/win celebrations)
- Fitness clichés: "no pain no gain", "crushed it", "beast mode", "let's go", "you got this"
- Emoji in UI copy (only in celebrations and rewards)
- "We" — always "je" (NL) / "you" (EN)
- Diminutives in NL ("even dit", "even dat", "momentje")
- Superlatives ("ultimate", "epic", "legendary", "amazing", "geweldig", "super")
- Medical claims ("burn fat", "lose weight fast", "get shredded")
- Comparisons that belittle ("below average", "slower than most")
- Fake urgency ("only 2 hours left!") unless factually true
- Reflexive "Congratulations" — reserve it for real moments
- Apologetic fluff ("Sorry!", "Oops", "Helaas", "Oei")

### ALWAYS

- Each string written natively in NL AND EN (not translated)
- Device locale respected; override available in settings
- Variables in copy use `{{name}}` syntax, never hardcoded
- Count characters for buttons (max 20 per language)
- Pass context to copy agent: which screen, which state, which emotion

## Canonical examples

### Empty states

**No workouts logged yet**
- NL: *Nog niks gelogd. Dat verandert vanaf je eerste set. [Start workout]*
- EN: *Nothing logged yet. That changes with your first set. [Start workout]*

**No friends yet**
- NL: *Nog geen vrienden. Daag iemand uit, ze verschijnen hier. [Uitdagen]*
- EN: *No friends yet. Challenge someone, they'll show up here. [Challenge]*

**No challenges sent**
- NL: *Nog geen uitdagingen verstuurd. [Eerste uitdaging]*
- EN: *No challenges sent yet. [First challenge]*

### Celebrations

**New PR**
- NL: *Nieuwe PR. {{weight}} kg bench. Vorige keer was {{previous}}. Mooi werk.*
- EN: *New PR. {{weight}} kg bench. Previous was {{previous}}. Nice work.*

**League promotion**
- NL: *Gepromoveerd naar {{tier}}. Iets hogere competitie nu.*
- EN: *Promoted to {{tier}}. Competition goes up from here.*

**Challenge won**
- NL: *Je wint. {{sender}} gaat het hele weekend nadenken.*
- EN: *You win. {{sender}} has a weekend to think about it.*

### Nudges (not pushy)

**Skipped a day**
- NL: *Gisteren geen workout. Gebeurt. Vandaag wel?*
- EN: *No workout yesterday. It happens. Today?*

**Set left unfinished**
- NL: *3 reps over. Nog één keer proberen?*
- EN: *3 reps to go. One more try?*

**Profile incomplete**
- NL: *Je profiel is nog niet compleet.*
- EN: *Your profile isn't complete yet.*

### Errors

**No internet during save**
- NL: *Workout niet opgeslagen. Geen verbinding. Syncs zodra je online bent.*
- EN: *Workout not saved. No connection. It'll sync when you're online.*

**Challenge code invalid**
- NL: *Deze code werkt niet. Verlopen of getypt fout?*
- EN: *This code isn't working. Expired or mistyped?*

### Challenge-specific

**Challenge invite (recipient)**
- NL: *{{sender}} daagt je uit. {{level}} niveau. {{exercises}} oefeningen. {{duration}} min. De app heeft een paar dingen aangepast. Wat precies hoor je na afloop. [Uitdaging aan]*
- EN: *{{sender}} challenges you. {{level}} level. {{exercises}} exercises. {{duration}} min. The app adjusted a few things. What exactly? You'll find out after. [Accept]*

**Waiting for other participant**
- NL: *Jij bent klaar. {{opponent}} nog niet. Ping je wanneer we kunnen onthullen.*
- EN: *You're done. {{opponent}} isn't. We'll ping you when it's time to reveal.*

**Reveal incoming**
- NL: *{{opponent}} is binnen. Even kijken wie er gelijk had.*
- EN: *{{opponent}} is in. Let's see who was right.*

## Banned words list

Use this to grep your own work.

**NL banned:**
- geweldig, super, fantastisch, top, mega, ultiem, episch, legendarisch, supercool
- oei, oeps, helaas, sorry (behalve genuine excuus)
- even (als verzwakker: "even dit", "even dat")
- we (gebruik "je")
- crushen, beasten, gaan

**EN banned:**
- awesome, amazing, epic, ultimate, legendary, incredible
- oops, whoops, sorry (except genuine apology)
- we (use "you")
- crush, crushed, beast mode, let's go, you got this, no pain no gain
- just (weakener: "just tap this")

## Language-specific notes

### Dutch (NL)

- Use "je" never "u" (too formal)
- Avoid English loanwords when NL works ("pak aan" > "crush")
- Keep sentences short — Dutch tends longer than English, counteract that
- "Workout" is fine as loanword; it's established
- "Training" and "workout" interchangeable; lean on "workout" for the app

### English (EN)

- American spelling (color not colour) — bigger market, App Store default
- Contractions are fine ("it'll", "you're") — feels warmer, less formal
- Avoid Briticisms that confuse Americans ("reckon", "quid")

## Evolution

This document is updated as Ronex matures. When a new copy pattern is established, the Copy agent adds it here with a canonical example.

Version: 1.0 — Initial
