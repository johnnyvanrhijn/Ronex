# Ronex

A fitness app for consistent training, progressive overload, and measurable progression. Built with React Native + Expo.

## What this is

Ronex is an iOS app (Android later) that focuses on three things:
- **Workout logging** — sets, reps, weights, PRs
- **Progression tracking** — visible, motivating, data-driven
- **Viral competition** — challenges with handicap reveals, leagues

Everything else is secondary.

## Project structure

```
ronex/
├── .claude/agents/         # Subagent definitions (PM, Designer, Backend, Copy, Tester)
├── docs/                   # Living documentation
│   ├── SPEC.md            # Product specification
│   ├── ROADMAP.md         # 8-phase roadmap
│   ├── TONE.md            # Brand voice guide
│   ├── ARCHITECTURE.md    # Technical architecture
│   ├── tasks.json         # All tasks across phases (dashboard data source)
│   ├── tasks.schema.json  # JSON schema for tasks
│   └── BUGS.md            # Bug tracker
├── dashboard/              # Local project dashboard (Vite + React)
├── app/                    # (Future) Expo Router screens
├── components/             # (Future) Shared UI components
├── lib/                    # (Future) Utilities, Supabase client
├── supabase/               # (Future) Migrations and Edge Functions
└── OPSTART.md              # Step-by-step getting started guide
```

## Getting started

See `OPSTART.md` for the complete setup checklist.

Quick start:
```bash
# 1. Start the project dashboard
cd dashboard
npm install
npm run dev
# Dashboard runs at http://localhost:3001

# 2. Talk to the PM agent in Claude Code
# Ask: "Wat pakken we deze week op?"
```

## The team

Ronex is built with a team of 5 Claude Code subagents:

- **PM** — Project manager, maintains roadmap and tasks
- **Designer** — Frontend + UX, React Native + Expo
- **Backend** — Supabase, Edge Functions, RevenueCat
- **Copy** — Bilingual (NL + EN), sharp dry tone
- **Tester** — QA, bug hunting, edge cases

Each agent has a specialized system prompt. See `.claude/agents/` for details.

## Tech stack

- **Frontend**: React Native + Expo (iOS, later Android)
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Monetization**: RevenueCat (iOS IAP)
- **AI**: Claude API via Supabase Edge Functions
- **i18n**: i18next + expo-localization (NL + EN)
- **Deployment**: EAS Build → TestFlight → App Store
