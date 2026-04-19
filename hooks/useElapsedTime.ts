/**
 * hooks/useElapsedTime.ts
 *
 * Ticks every second and returns a formatted elapsed string for a given
 * ISO-8601 start timestamp.
 *
 * Format
 * ------
 *   < 60 min  -> "m:ss"   (e.g. "12:03")
 *   >= 60 min -> "h:mm:ss" (e.g. "1:12:03")
 *
 * Returns `'0:00'` when `startedAt` is null so call sites can always
 * render a string.
 *
 * Perf note
 * ---------
 * setInterval on JS thread is fine here — one tick/sec for one mount.
 * We clear on unmount + on startedAt change.
 */

import { useEffect, useState } from 'react';

export function formatElapsed(startedAt: string | null, nowMs?: number): string {
  if (!startedAt) return '0:00';
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return '0:00';
  const now = nowMs ?? Date.now();
  const deltaMs = Math.max(0, now - start);
  const totalSec = Math.floor(deltaMs / 1000);

  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function useElapsedTime(startedAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return formatElapsed(startedAt, now);
}

/**
 * Same as useElapsedTime but from a plain "started at" JS timestamp (ms).
 * Used by the rest-timer in WorkoutHeader (a local stopwatch not tied to
 * any ISO string).
 */
export function useStopwatch(startedAtMs: number | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAtMs == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAtMs]);

  if (startedAtMs == null) return '0:00';
  const totalSec = Math.max(0, Math.floor((now - startedAtMs) / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
