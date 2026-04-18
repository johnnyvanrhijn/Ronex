# UX Checklist — per screen

> Copy this block into the `notes` field of every designer task from Phase 1 onward.
> Designer must answer all 7 questions **before** writing code, and document the 5 states **before** marking the task done.
> Reference: SPEC.md §14 UX Principles.

---

## The 7 questions (answer before coding)

1. **ONE JOB** — What is the single job of this screen?
   →

2. **PRIMARY ACTION** — Which button stands out? (lime accent, max 1 per screen)
   →

3. **TITLE** — What is the title? (tells *what*, not *where* — e.g. "Gold League", not "Home")
   →

4. **TOP THIRD** — What does a user see in the top third? (F-pattern guarantee)
   →

5. **STATES HANDLED** — Which of loading / empty / error / success / edge are in scope?
   →

6. **NO-ACTION PATH** — What happens if the user does NOT take the primary action?
   →

7. **HALVE TEST** — Can the content of this screen be halved? (most are twice as full as needed)
   →

---

## The 5 required states (document before task = done)

| State | Description | Copy key / component |
|---|---|---|
| **Loading** | What user sees while data loads |  |
| **Empty** | First time, no data — must reassure + give first step (TONE.md) |  |
| **Error** | Network dead / API broken — 3-part error structure (TONE.md) |  |
| **Success** | Everything works |  |
| **Edge** | 1 item / many items / very many items |  |

---

## Output

Designer writes answers inline in the task `notes` field in tasks.json, or links to a mockup doc in `temp-files/` that contains them. Task cannot be marked `done` without all 7 answered and all 5 states addressed.
