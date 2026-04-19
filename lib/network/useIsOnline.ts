/**
 * lib/network/useIsOnline.ts
 *
 * Thin wrapper around `expo-network`'s state listener that exposes two primitives:
 *
 *   1. `useIsOnline()`       — React hook returning a boolean. Re-renders when
 *                              connectivity flips.
 *   2. `subscribeOnline()`   — non-React subscription for code running outside
 *                              the component tree (e.g. the sync engine in
 *                              lib/sync/syncActiveWorkout.ts). Fires on every
 *                              flip, is called once with the initial value.
 *   3. `getIsOnline()`       — synchronous read of the last-known state. Useful
 *                              for early-return checks before kicking off a
 *                              sync attempt.
 *
 * Why expo-network (not @react-native-community/netinfo)?
 * -------------------------------------------------------
 * expo-network is part of the Expo SDK, so no extra native-build configuration
 * is needed and it tracks Expo versions automatically. NetInfo is more feature-
 * rich (e.g. signal strength, SSID) but we don't need any of that — a boolean
 * "can I reach the internet right now?" is sufficient for sync decisions.
 *
 * Definition of "online"
 * ----------------------
 * We treat `isConnected === true && isInternetReachable !== false` as online.
 * expo-network returns `isInternetReachable: true | false | null`. `null` means
 * "unknown" (e.g. right after boot before a probe has run); we optimistically
 * treat unknown as online so the first sync attempt isn't blocked on a probe.
 * If it genuinely fails, the sync engine's retry-backoff will handle it.
 *
 * This is a deliberate trade-off: we MIGHT attempt a sync on a captive-portal
 * wifi that has `isConnected=true, isInternetReachable=false` — that attempt
 * will fail, fall into the retry queue, and eventually surface as `error`
 * status. Users on gym wifi see correct state within ~2-4s.
 */

import { useEffect, useState } from 'react';
import {
  addNetworkStateListener,
  getNetworkStateAsync,
  type NetworkStateEvent,
} from 'expo-network';

// Last-known online state. Shared between hook consumers + sync engine.
// Initialized pessimistically to `true` so first-mount sync attempts aren't
// blocked by a not-yet-resolved probe. A real "offline at boot" state will
// flip this within ~100ms via the initial getNetworkStateAsync() call below.
let cachedOnline = true;

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();

function deriveOnline(event: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  const connected = event.isConnected === true;
  // `isInternetReachable` can be null = unknown; treat unknown as online so
  // we don't false-negative on first probe. See module doc for trade-off.
  const reachable = event.isInternetReachable !== false;
  return connected && reachable;
}

function pushState(next: boolean): void {
  if (next === cachedOnline) return;
  cachedOnline = next;
  for (const l of listeners) {
    try {
      l(next);
    } catch (err) {
      // A buggy listener must not break other listeners. Log and move on.
      console.warn('[useIsOnline] listener threw:', err);
    }
  }
}

// Start the expo-network subscription exactly once, at module load. This is
// safe because we're in a RN module (no SSR), and the subscription cost is
// negligible (one native event listener).
let initialized = false;
function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  // Kick off an initial probe to populate cachedOnline quickly. The listener
  // will also fire when the native layer reports its first event, but the
  // probe shortens the "unknown" window at cold start.
  void getNetworkStateAsync()
    .then((state) => pushState(deriveOnline(state)))
    .catch(() => {
      // Probe failure = keep optimistic default. The event listener will
      // correct us when the native layer reports actual state.
    });

  addNetworkStateListener((event: NetworkStateEvent) => {
    pushState(deriveOnline(event));
  });
}

/**
 * Subscribe to connectivity flips from non-React code. Returns an unsubscribe
 * function. The listener is invoked synchronously with the current cached
 * value on subscription so callers don't have to separately call
 * `getIsOnline()` on mount.
 */
export function subscribeOnline(listener: Listener): () => void {
  ensureInitialized();
  listeners.add(listener);
  // Fire-once with current value so the subscriber doesn't have to special-case
  // the "I just subscribed, what's the state?" path.
  try {
    listener(cachedOnline);
  } catch (err) {
    console.warn('[useIsOnline] initial listener call threw:', err);
  }
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Synchronous read of the last-known online state. May be stale by up to the
 * event-delivery latency (~100ms), but for sync-gate decisions that's
 * acceptable — worst case a single request fails and retries.
 */
export function getIsOnline(): boolean {
  ensureInitialized();
  return cachedOnline;
}

/**
 * React hook. Re-renders when connectivity flips. Safe to use in multiple
 * components simultaneously — they all share the same expo-network listener.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    ensureInitialized();
    return cachedOnline;
  });

  useEffect(() => {
    const unsubscribe = subscribeOnline(setOnline);
    return unsubscribe;
  }, []);

  return online;
}
