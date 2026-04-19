/**
 * components/challenge/LeaderboardPreview.tsx
 *
 * Top-of-screen leaderboard preview for the Challenge tab (T-117).
 *
 * SPEC §13 shape
 * --------------
 * - Populated: own league tier (already rendered as screen-title), 3
 *   neighbours AROUND the user (not top-3 — Johnny approved: neighbours
 *   are actionable, top-3 is spectator content) + "X of 20 active today"
 *   + CTA to full sub-screen.
 * - Empty (pre-league, no activity): dashed surface with reassurance copy
 *   ("Bronze League starter — train to promote").
 *
 * Scope note
 * ----------
 * T-117 is scaffold-only (no live data). This component is driven by
 * props so the mock-vs-empty toggle on the parent screen exercises both
 * states for Johnny + Tester. Real data lands in T-724/T-741 (leagues
 * schema + full sub-screen).
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

export type LeaderboardRow = {
  rank: number;
  name: string;
  volumeKg: number;
  isYou: boolean;
};

type LeaderboardPreviewProps = {
  /** null = empty state (pre-league / fallback). */
  rows: LeaderboardRow[] | null;
  activeToday: number;
  leagueSize: number;
  onPressCta: () => void;
};

function formatVolume(kg: number): string {
  // No localised number formatting — NL/EN both read thousands fine as
  // raw digits at preview size. Full leaderboard sub-screen (T-741) will
  // take the Intl.NumberFormat call.
  return `${kg.toLocaleString('nl-NL')}`;
}

export default function LeaderboardPreview({
  rows,
  activeToday,
  leagueSize,
  onPressCta,
}: LeaderboardPreviewProps) {
  const { t } = useTranslation();

  if (rows === null || rows.length === 0) {
    // Empty state: dashed surface, reassurance copy. No CTA — the user
    // lands in a league the moment they log their first set.
    return (
      <View className="rounded-card border border-dashed border-surface-elevated bg-surface p-5">
        <Text className="text-body font-inter-semibold text-content">
          {t('challenge.leaderboardEmptyTitle')}
        </Text>
        <Text className="mt-1 font-inter text-body text-content-secondary">
          {t('challenge.leaderboardEmptyHelper')}
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-card bg-surface p-5">
      {/* Helper meta: "X of 20 active today" — small-caps-label casing. */}
      <Text className="text-small-caps uppercase text-content-secondary mb-4">
        {t('challenge.leaderboardActiveToday', {
          active: activeToday,
          total: leagueSize,
        })}
      </Text>

      {/* 3 neighbour rows. User row gets lime-accent rank + bold name. */}
      <View className="gap-y-3">
        {rows.map((row) => (
          <View
            key={row.rank}
            className="flex-row items-center justify-between"
            accessibilityRole={row.isYou ? 'header' : undefined}
          >
            <View className="flex-row items-center">
              <Text
                className={`text-body font-inter-semibold w-8 ${
                  row.isYou ? 'text-primary' : 'text-content-secondary'
                }`}
              >
                {t('challenge.leaderboardPosition', { rank: row.rank })}
              </Text>
              <Text
                className={`ml-3 text-body ${
                  row.isYou
                    ? 'font-inter-semibold text-content'
                    : 'font-inter text-content'
                }`}
                numberOfLines={1}
              >
                {row.isYou ? t('challenge.leaderboardYou') : row.name}
              </Text>
            </View>
            <Text className="font-inter-semibold text-body text-content-secondary">
              {formatVolume(row.volumeKg)} kg
            </Text>
          </View>
        ))}
      </View>

      {/* CTA to full leaderboard sub-screen (T-741). Placeholder route
          until T-741 ships. */}
      <Pressable
        onPress={onPressCta}
        className="mt-5 py-2"
        accessibilityRole="button"
        accessibilityLabel={t('challenge.leaderboardCta')}
        hitSlop={8}
      >
        <Text className="text-small-caps uppercase text-primary">
          {t('challenge.leaderboardCta')}
        </Text>
      </Pressable>
    </View>
  );
}
