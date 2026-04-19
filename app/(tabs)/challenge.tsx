/**
 * app/(tabs)/challenge.tsx
 *
 * Challenge-tab landing screen (T-117, scaffold implementation).
 *
 * Reads before editing: docs/SPEC.md §13 + §14, docs/TONE.md.
 *
 * Content order on this screen
 * ----------------------------
 * SPEC §13 prescribes, top-to-bottom:
 *   1. Leaderboard (own league + neighbours + CTA)
 *   2. Today's volume
 *   3. Primary CTA: "Challenge someone"
 *   4. Active challenges
 *   5. Training log preview
 *   6. Next workout suggestion
 *   7. Full history CTA
 *
 * Johnny's 2026-04-19 call: tab-bar stays uniform, "logging dominance"
 * must come from CONTENT on THIS screen. To honour that AND SPEC §13:
 *   - Leaderboard stays at top (anchors the viral hook; tier reads as
 *     the screen-title, so the leaderboard preview sits directly under
 *     it with zero extra heading).
 *   - **Next workout moves up** from §13 position 6 to position 2 — it
 *     sits directly under the leaderboard and BEFORE Volume, the Send
 *     Challenge CTA, and the social sections. That puts the lime Start
 *     button squarely in the top-third (SPEC §14 Rule 4), which is the
 *     strongest placement for logging dominance without touching the
 *     tab bar.
 *   - Volume, send-challenge CTA, active challenges, training log, and
 *     history-link follow in the SPEC order, pushed down by one slot.
 * See the numbered comments below for per-section anchoring.
 *
 * Data wiring
 * -----------
 * No live data yet. A single `MOCK_DATA` boolean toggles between empty
 * and populated states so both can be validated visually. Remove in
 * T-2xx once Supabase bindings land (challenges, leagues, workouts).
 *
 * Open sub-question decisions (this agent)
 * ----------------------------------------
 *  1. Section-title casing → small-caps-label for every subordinate
 *     section. Screen-title (display-lg) carries the user-state ("Gold
 *     League" or "Train vandaag"). Mixing casing at section level would
 *     create a 4th typographic level (SPEC §14 Rule 5: max 3).
 *  2. History CTA destination → placeholder route `/history`. Real
 *     screen lands in a later task; wired as `as any` push so the
 *     intent is traceable in logs.
 *  3. Next-workout for loose users → show the section label and a
 *     one-line prompt ("Start een workout."), keep the lime Start
 *     button. No fake plan-suggestion, but no "hide" either — the
 *     Start intent stays one tap away.
 *  4. Pre-league screen-title → fallback "Train vandaag" for users
 *     with zero logged volume. A brand-new user has no league yet (by
 *     definition — leagues materialise after first log, T-724). Once
 *     populated, title becomes "{tier} League".
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import LeaderboardPreview, {
  type LeaderboardRow,
} from '@/components/challenge/LeaderboardPreview';
import NextWorkoutCard, {
  type NextWorkoutVariant,
} from '@/components/challenge/NextWorkoutCard';
import ActiveChallengeRow from '@/components/challenge/ActiveChallengeRow';
import LogPreviewRow from '@/components/challenge/LogPreviewRow';
import ResumeCard from '@/components/workout/ResumeCard';
import { useActiveWorkout } from '@/stores/activeWorkout';
import { useRestTimer } from '@/stores/restTimer';
import { useElapsedTime } from '@/hooks/useElapsedTime';

/**
 * T-117 scaffold-pattern toggle. Flip to false to see the empty/pre-
 * league state of every section; true shows populated state with mock
 * neighbours, mock plan-day, mock active challenge, mock logs.
 *
 * Remove when T-2xx wires Supabase. Callers: NONE (local to this file).
 */
const MOCK_DATA = true;

// ─── Mock fixtures — removed in T-2xx ────────────────────────────────

type MockActiveChallenge = {
  id: string;
  opponentName: string;
  status: 'waitingForOpponent' | 'waitingForReveal' | 'yourTurn';
};

type MockLogEntry = {
  id: string;
  daysAgo: number; // 0 = today, 1 = yesterday, >1 = "n days ago"
  title: string;
  exercises: number;
  sets: number;
  volumeKg: number;
};

const MOCK_LEAGUE_TIER: 'gold' = 'gold';

// 3 neighbours AROUND the user (SPEC: neighbours not top-3). Johnny
// approved: actionable > spectator. User sits at rank 9 of 20.
const MOCK_LEADERBOARD: LeaderboardRow[] = [
  { rank: 8, name: 'Mark', volumeKg: 6200, isYou: false },
  { rank: 9, name: 'You', volumeKg: 5840, isYou: true },
  { rank: 10, name: 'Sanne', volumeKg: 5610, isYou: false },
];
const MOCK_ACTIVE_TODAY = 12;
const MOCK_LEAGUE_SIZE = 20;

const MOCK_NEXT_WORKOUT: NextWorkoutVariant = {
  kind: 'plan',
  title: 'Push A',
  summary: '5 oefeningen \u00B7 ~45 min', // TODO(copy): polish, localise min/exercises labels
};

const MOCK_ACTIVE_CHALLENGES: MockActiveChallenge[] = [
  { id: 'c1', opponentName: 'Lisa', status: 'waitingForOpponent' },
  { id: 'c2', opponentName: 'Bram', status: 'yourTurn' },
];

const MOCK_LOGS: MockLogEntry[] = [
  {
    id: 'l1',
    daysAgo: 0,
    title: 'Pull B',
    exercises: 5,
    sets: 16,
    volumeKg: 4720,
  },
  {
    id: 'l2',
    daysAgo: 1,
    title: 'Push A',
    exercises: 5,
    sets: 15,
    volumeKg: 4380,
  },
  {
    id: 'l3',
    daysAgo: 3,
    title: 'Legs',
    exercises: 4,
    sets: 14,
    volumeKg: 5900,
  },
];

const MOCK_VOLUME_TODAY = 4720;

// ─── Small helpers ──────────────────────────────────────────────────

function tierTitleKey(tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond') {
  switch (tier) {
    case 'bronze':
      return 'challenge.leagueBronze';
    case 'silver':
      return 'challenge.leagueSilver';
    case 'gold':
      return 'challenge.leagueGold';
    case 'platinum':
      return 'challenge.leaguePlatinum';
    case 'diamond':
      return 'challenge.leagueDiamond';
  }
}

/**
 * Small reusable section label (level-3 small-caps-label). Used for all
 * subordinate sections. Screen-title lives outside and uses display-lg.
 */
function SectionLabel({ text }: { text: string }) {
  return (
    <Text className="text-small-caps uppercase text-content-secondary mb-3">
      {text}
    </Text>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────

export default function ChallengeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // Held in component state so hot-reload during dev doesn't lose the
  // toggle. A later task can expose this via a dev-only long-press.
  const [mockEnabled] = useState(MOCK_DATA);

  // ── Active-workout resume detection (T-204) ──────────────────────
  // Read the in-progress workout from zustand. If a session is live
  // (`startedAt !== null && completedAt === null`) we render a
  // ResumeCard at the very top of the scroll. We do NOT auto-redirect
  // — respect user intent, surface the option prominently instead.
  const wStartedAt = useActiveWorkout((s) => s.startedAt);
  const wCompletedAt = useActiveWorkout((s) => s.completedAt);
  const wReset = useActiveWorkout((s) => s.reset);
  const resetRestTimer = useRestTimer((s) => s.reset);
  const hasActiveWorkout = wStartedAt !== null && wCompletedAt === null;
  const activeElapsed = useElapsedTime(hasActiveWorkout ? wStartedAt : null);

  const hasLeaderboard = mockEnabled;
  const hasNextWorkout = mockEnabled;
  const hasActiveChallenges = mockEnabled;
  const hasLogs = mockEnabled;
  const hasVolume = mockEnabled;

  // Screen title — Rule 2: tells state, not navigation. Pre-league
  // fallback is "Train vandaag" (sub-question 4).
  const screenTitle = hasLeaderboard
    ? t(tierTitleKey(MOCK_LEAGUE_TIER))
    : t('challenge.screenTitlePreLeague');

  // Typed-routes forward-refs. None of these routes exist yet; we cast
  // through `any` so scaffolding compiles today and T-2xx wiring can
  // replace the placeholders without touching call sites.
  const routeNewWorkout = '/workout/active' as any;
  const routeWorkoutDetail = (id: string) => `/workout/${id}` as any;
  const routeLeaderboardFull = '/leaderboard' as any; // T-741
  const routeHistory = '/history' as any; // sub-question 2
  const routeNewChallenge = '/challenge/new' as any;
  const routeActiveChallenge = (id: string) => `/challenge/${id}` as any;

  const pressWithHaptic = (fn: () => void) => {
    return (_e?: GestureResponderEvent) => {
      void Haptics.selectionAsync();
      fn();
    };
  };

  const handleStartWorkout = pressWithHaptic(() => {
    router.push(routeNewWorkout);
  });

  const handleOpenLeaderboard = pressWithHaptic(() => {
    router.push(routeLeaderboardFull);
  });

  const handleSendChallenge = pressWithHaptic(() => {
    router.push(routeNewChallenge);
  });

  const handleOpenChallenge = (id: string) =>
    pressWithHaptic(() => {
      router.push(routeActiveChallenge(id));
    });

  const handleOpenLog = (id: string) =>
    pressWithHaptic(() => {
      router.push(routeWorkoutDetail(id));
    });

  const handleOpenHistory = pressWithHaptic(() => {
    router.push(routeHistory);
  });

  const handleResumeContinue = pressWithHaptic(() => {
    router.push('/workout/active' as never);
  });

  const handleResumeDiscard = pressWithHaptic(() => {
    wReset();
    resetRestTimer();
  });

  // Date-label formatter for log rows. Kept local to the screen because
  // it's one-use; if a second caller appears this moves to lib/date.ts.
  const logDateLabel = (daysAgo: number): string => {
    if (daysAgo === 0) return t('challenge.logPreviewToday');
    if (daysAgo === 1) return t('challenge.logPreviewYesterday');
    return t('challenge.logPreviewDaysAgo', { count: daysAgo });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Screen title (Rule 2: state, not nav) ────────────── */}
        <Text
          className="text-display-lg text-content mb-8"
          accessibilityRole="header"
        >
          {screenTitle}
        </Text>

        {/*
          ─── Resume-card (T-204) ────────────────────────────────
          Rendered ABOVE everything else when an active workout is
          detected. Most-prominent-possible surfacing of a session
          the user has in-flight, without stealing their agency via
          an auto-redirect.
        */}
        {hasActiveWorkout && (
          <ResumeCard
            elapsed={activeElapsed}
            onContinue={handleResumeContinue}
            onDiscard={handleResumeDiscard}
          />
        )}

        {/* ─── 1. Leaderboard (§13 position 1) ───────────────────── */}
        <View className="mb-8">
          <LeaderboardPreview
            rows={hasLeaderboard ? MOCK_LEADERBOARD : null}
            activeToday={MOCK_ACTIVE_TODAY}
            leagueSize={MOCK_LEAGUE_SIZE}
            onPressCta={handleOpenLeaderboard}
          />
        </View>

        {/*
          ─── 2. Next workout — MOVED UP from §13 position 6 ─────
          Johnny 2026-04-19: logging dominance lives in content on
          this tab. Top-third placement (SPEC §14 Rule 4) makes the
          lime Start the most-landed visual beat after the screen
          title + leaderboard.
        */}
        <View className="mb-8">
          <NextWorkoutCard
            variant={hasNextWorkout ? MOCK_NEXT_WORKOUT : { kind: 'empty' }}
            onStart={handleStartWorkout}
          />
        </View>

        {/*
          ─── 3. Today's volume — naked numeric, NO card ─────────
          Mockup decision: breaks the card-monotony deliberately.
          Empty state keeps the break but switches to muted helper
          copy instead of a zero, to avoid negative framing.
        */}
        <View className="mb-8">
          <SectionLabel text={t('challenge.volumeLabel')} />
          {hasVolume ? (
            <Text
              className="text-display-lg text-content"
              accessibilityLabel={`${MOCK_VOLUME_TODAY} ${t('challenge.volumeUnit')}`}
            >
              {MOCK_VOLUME_TODAY.toLocaleString('nl-NL')}{' '}
              <Text className="text-body font-inter-semibold text-content-secondary">
                {t('challenge.volumeUnit')}
              </Text>
            </Text>
          ) : (
            <Text className="font-inter text-body text-content-secondary">
              {t('challenge.volumeEmpty')}
            </Text>
          )}
        </View>

        {/* ─── 4. Primary CTA: "Challenge someone" (lime, 56pt) ── */}
        <Pressable
          onPress={handleSendChallenge}
          className="mb-8 h-14 items-center justify-center rounded-button bg-primary active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel={t('challenge.primaryCta')}
        >
          <Text className="text-body font-inter-semibold text-background">
            {t('challenge.primaryCta')}
          </Text>
        </Pressable>

        {/* ─── 5. Active challenges (§13 position 4) ─────────────── */}
        <View className="mb-8">
          <SectionLabel text={t('challenge.activeTitle')} />
          {hasActiveChallenges && MOCK_ACTIVE_CHALLENGES.length > 0 ? (
            <View className="rounded-card bg-surface px-5">
              {MOCK_ACTIVE_CHALLENGES.map((c, idx) => {
                const statusLabel =
                  c.status === 'waitingForOpponent'
                    ? t('challenge.activeWaitingForOpponent', {
                        opponent: c.opponentName,
                      })
                    : c.status === 'waitingForReveal'
                      ? t('challenge.activeWaitingForReveal')
                      : t('challenge.activeYourTurn');
                return (
                  <ActiveChallengeRow
                    key={c.id}
                    opponentName={c.opponentName}
                    statusLabel={statusLabel}
                    actionable={c.status === 'yourTurn'}
                    onPress={handleOpenChallenge(c.id)}
                    first={idx === 0}
                  />
                );
              })}
            </View>
          ) : (
            <View className="rounded-card border border-dashed border-surface-elevated bg-surface p-5">
              <Text className="text-body font-inter-semibold text-content">
                {t('challenge.activeEmptyTitle')}
              </Text>
              <Text className="mt-1 font-inter text-body text-content-secondary">
                {t('challenge.activeEmptyHelper')}
              </Text>
            </View>
          )}
        </View>

        {/* ─── 6. Training log preview (§13 position 5) ──────────── */}
        <View className="mb-8">
          <SectionLabel text={t('challenge.logPreviewTitle')} />
          {hasLogs && MOCK_LOGS.length > 0 ? (
            <View className="rounded-card bg-surface px-5">
              {MOCK_LOGS.slice(0, 3).map((log, idx) => (
                <LogPreviewRow
                  key={log.id}
                  dateLabel={logDateLabel(log.daysAgo)}
                  title={log.title}
                  summary={t('challenge.logPreviewSetsSummary', {
                    exercises: log.exercises,
                    sets: log.sets,
                    volume: log.volumeKg.toLocaleString('nl-NL'),
                  })}
                  onPress={handleOpenLog(log.id)}
                  first={idx === 0}
                />
              ))}
            </View>
          ) : (
            <View className="rounded-card border border-dashed border-surface-elevated bg-surface p-5">
              <Text className="text-body font-inter-semibold text-content">
                {t('challenge.logPreviewEmptyTitle')}
              </Text>
              <Text className="mt-1 font-inter text-body text-content-secondary">
                {t('challenge.logPreviewEmptyHelper')}
              </Text>
            </View>
          )}
        </View>

        {/* ─── 7. History CTA — small-caps-label, primary tint ──── */}
        <Pressable
          onPress={handleOpenHistory}
          className="items-center py-3"
          accessibilityRole="button"
          accessibilityLabel={t('challenge.historyCta')}
          hitSlop={8}
        >
          <Text className="text-small-caps uppercase text-primary">
            {`${t('challenge.historyCta')} →`}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
