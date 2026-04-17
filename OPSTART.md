# Ronex — Opstart Checklist

Stap voor stap van niets naar werkend project. Volg in volgorde, sla niks over.

## Wat je nodig hebt

Vóór je begint, zorg dat je dit hebt:

- [ ] **Mac of Windows met terminal toegang**
- [ ] **Node.js 20+** geïnstalleerd ([nodejs.org](https://nodejs.org) of via nvm)
- [ ] **Git** geïnstalleerd
- [ ] **GitHub account**
- [ ] **Cursor of VS Code** met Claude Code extensie (of Claude Code in terminal)
- [ ] **iPhone** voor testen (kan ook simulator op Mac)
- [ ] **Expo Go app** op je iPhone ([App Store link](https://apps.apple.com/app/expo-go/id982107779))

Later (niet meteen, maar binnen een week of 2):

- [ ] **Apple Developer account** ($99/jaar) — pas nodig vóór TestFlight in Phase 4
- [ ] **Supabase account** (gratis) — nodig in Phase 0/1
- [ ] **RevenueCat account** (gratis) — pas nodig in Phase 6

## Stap 1: Repository opzetten

1. Maak een nieuwe repo op GitHub: `ronex` (private)
2. Clone of push deze projectfolder erheen:
   ```bash
   cd /pad/naar/ronex
   git init
   git add .
   git commit -m "Initial scaffold"
   git branch -M main
   git remote add origin git@github.com:JOUW-NAAM/ronex.git
   git push -u origin main
   ```

## Stap 2: Dashboard installeren en starten

1. Open een terminal in de `dashboard` folder:
   ```bash
   cd dashboard
   npm install
   ```
2. Start het dashboard:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3001` in je browser.

Je ziet nu het Ronex Cockpit met alle 8 fases en ~130 voorgenerateerde taken.

**Houd dit tabblad open tijdens je werkdag.**

## Stap 3: Open Claude Code

1. Open Cursor of VS Code in de `ronex` folder
2. Open de Claude Code panel (of start `claude` in de terminal)
3. Claude Code detecteert automatisch de agents in `.claude/agents/`

## Stap 4: Eerste gesprek met de PM

In Claude Code, type:

```
Praat met de PM agent. Vraag: "Wat pakken we vandaag op?"
```

De PM agent zal:
1. `tasks.json` lezen
2. De huidige fase identificeren (Phase 0 — Foundation)
3. Voorstellen welke taken logisch zijn om nu te starten

**Verwacht antwoord ongeveer:**

> Actieve fase: Phase 0 — Foundation
> Status: 0/14 taken klaar (0%)
>
> Voorgesteld nu:
> → T-001: Initialize Expo project with TypeScript (owner: backend, est 1h)
>   Reden: Geen dependencies, blokkeert bijna alles. Begin hier.
>
> Ook mogelijk parallel:
> → T-003: Create Supabase project (owner: backend, est 0.5h)

## Stap 5: Eerste echte taak uitvoeren

Voor de eerste taak (Expo init):

```
Praat met de Backend agent. Vraag: "Voer T-001 uit: initialize Expo project met TypeScript."
```

De Backend agent zal:
1. De spec en architecture lezen
2. Het Expo project initialiseren in de huidige folder
3. Dependencies installeren
4. Wijzigingen committen

Als het klaar is, vraag de PM:
```
PM, T-001 is klaar. Markeer als done en geef volgende suggestie.
```

PM zal `tasks.json` updaten — je ziet T-001 in het dashboard van Todo naar Done verschuiven binnen ~1 seconde.

## Stap 6: Werkpatroon dat werkt

Voor elke taak:

1. **Vraag PM** wat logisch is om nu te doen
2. **Delegeer** naar de juiste agent (Backend / Designer / Copy / Tester)
3. **Test** de output (vraag Tester voor end-to-end checks bij grotere features)
4. **Markeer done** via PM of direct in dashboard
5. **Herhaal**

Tip: laat het dashboard altijd open. Je ziet voortgang real-time terwijl agents werken.

## Stap 7: Supabase setup (komt in Phase 0)

Wanneer je bij T-003 / T-004 bent:

1. Ga naar [supabase.com](https://supabase.com) en maak gratis account
2. Maak een nieuwe project: "ronex"
3. Kopieer de URL en anon key uit Settings → API
4. Maak `.env.local` in de project root:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
   ```
5. **Voeg `.env.local` toe aan `.gitignore`** (al gedaan)

## Stap 8: Eerste run op je iPhone (einde Phase 0)

Wanneer Backend agent klaar is met de basis:

```bash
npx expo start
```

1. QR code verschijnt in terminal
2. Open Expo Go app op je iPhone
3. Scan de QR code
4. App opent op je telefoon
5. Hot reload werkt — wijzigingen verschijnen binnen 2 seconden

🎉 **Phase 0 is klaar.**

## Stap 9: Doorlopende rituelen

Elke werksessie:

1. **Start van sessie**: vraag PM "Waar staan we?"
2. **Tijdens werken**: laat dashboard open
3. **Einde van sessie**: commit naar GitHub, vraag PM "Wat staat open voor volgende sessie?"

Wekelijks:

1. Bekijk fase-voortgang in dashboard
2. Vraag PM een korte status: "Hoe staan we tegenover de roadmap?"
3. Als je >1.5x estimate over een fase bent: vraag PM om scope aanpassing

## Veelgestelde vragen

**Q: Wat als een agent iets fout doet?**
A: Type "stop" of `Ctrl+C`, leg uit wat fout ging, en vraag opnieuw met meer context. Agents leren niet, maar jij wel.

**Q: Wat als ik een nieuwe feature wil toevoegen?**
A: Vraag de PM eerst. Hij/zij zal vragen of het bij MVP past, in welke fase, wat de impact is. Niet zomaar dingen aan tasks.json toevoegen — laat de PM dat doen.

**Q: Wat als de hot reload niet werkt?**
A: `r` in de Expo terminal om te reloaden. Werkt het nog niet? Stop alles, draai opnieuw `npx expo start --clear`.

**Q: Kan ik meerdere agents tegelijk laten werken?**
A: In Claude Code kan een agent een andere agent aanroepen. Maar in de praktijk werkt het beter sequentieel: PM → Backend → Designer → Copy → Tester.

**Q: Mijn dashboard updates niet meer?**
A: Check of het server-process nog draait. Restart met `Ctrl+C` en opnieuw `npm run dev`.

**Q: Ik wil een naam wijzigen (Ronex → iets anders)?**
A: Search & replace door de hele codebase. Belangrijke plekken: `tasks.json` `project.name`, `README.md`, `app.json` (als het er is), en branding in dashboard.

## Volgende stap

Als alles werkt: open je dashboard, zeg hi tegen de PM, en begin met **T-001**.

Welkom bij Ronex.
