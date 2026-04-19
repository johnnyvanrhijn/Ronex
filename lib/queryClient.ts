/**
 * lib/queryClient.ts
 *
 * Single shared TanStack Query client (T-206 introduced it for the
 * exercise picker). Lives in `lib/` so any hook can import the same
 * instance — we do NOT create a new client per screen.
 *
 * Defaults chosen for Ronex:
 *  - `staleTime: Infinity` on the canonical exercise library (T-206),
 *    set per-query on the hook level. Global default stays 0 so
 *    short-lived queries (workout history, leaderboard) re-fetch when
 *    the user returns to the tab.
 *  - `retry: 1` — one retry on network error, then surface the error.
 *    The user is on a phone in a gym; a silent retry storm is worse
 *    than a clear "try again" toast.
 *  - `refetchOnWindowFocus: false` — noop on React Native, but keeps
 *    web-dev behaviour quiet when running via `expo web`.
 *
 * Provider wiring lives in `app/_layout.tsx`.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
