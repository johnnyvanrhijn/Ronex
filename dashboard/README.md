# Ronex Cockpit

The local project dashboard for Ronex. Reads/writes `../docs/tasks.json`.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

This starts:
- **Server** on `http://localhost:3002` (Express, reads/writes tasks.json)
- **Client** on `http://localhost:3001` (Vite, the actual dashboard UI)

Open `http://localhost:3001` in your browser.

## Features

- **Kanban view**: drag tasks between columns (Todo → In Progress → Blocked → Done)
- **List view**: tasks grouped per phase
- **Timeline view**: chronological with dependencies visible
- **Cockpit**: phase progress at a glance + suggested next tasks
- **Filters**: by owner, by phase
- **Live updates**: when agents update tasks.json directly, dashboard reflects within ~1s
- **Edit modal**: full task editing including dependencies
- **Quick add**: create new tasks per phase

## Data flow

```
You / Agents
     ↓
  tasks.json (single source of truth)
     ↓
  Express server (file watcher + REST API)
     ↓
  React dashboard (live via WebSocket)
```

Both you and the Claude Code agents write to the same `tasks.json`. The dashboard re-renders automatically when the file changes.
