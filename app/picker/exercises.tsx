/**
 * app/picker/exercises.tsx
 *
 * Exercise picker modal (T-206).
 *
 * Flow
 * ----
 *   Caller           ->  router.push('/picker/exercises')
 *   Picker           ->  user searches / filters / taps a row
 *   Picker           ->  writes exerciseId to useExercisePickerResult
 *                        + router.back()
 *   Caller (focus)   ->  reads + clears the store, uses the id
 *
 * See `stores/exercisePickerResult.ts` for the contract rationale.
 *
 * Layout (top-to-bottom)
 * ----------------------
 *   1. Modal-header: title ("Kies oefening") + close X (top-right).
 *   2. Sticky search input (48pt tall).
 *   3. Muscle filter pills (horizontal scroll).
 *   4. Equipment filter pills (horizontal scroll).
 *   5. Result list — grouped by muscle OR flat, depending on filters.
 *
 * Grouping logic (T-206 decision 9)
 * ---------------------------------
 *   - No muscle filter                → grouped per muscle (section headers).
 *   - Exactly one muscle filter       → flat list (section header would be
 *                                       redundant with the active pill).
 *   - Two or more muscles (multi)     → grouped per muscle.
 *   - Equipment-only filter, no
 *     muscle filter                   → grouped per muscle.
 *
 * Sort (T-206 decision 8)
 * -----------------------
 *   Within the data source: compound DESC, then name ASC (handled by
 *   `useExercises`). The list preserves that ordering; groupings are
 *   built on top of it so each muscle's section keeps compound-first.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SectionList,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  type ListRenderItemInfo,
  type SectionListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import {
  useExercises,
  type Exercise,
  type MuscleGroup,
  type Equipment,
  type LoggingType,
} from '@/lib/queries/useExercises';
import { useExercisePickerResult } from '@/stores/exercisePickerResult';
import { colors } from '@/lib/theme';
import FilterPill from '@/components/picker/FilterPill';
import ExerciseRow from '@/components/picker/ExerciseRow';

// Canonical enum-order, mirrors supabase/migrations/20260418010000_exercises.sql.
const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
];

const EQUIPMENT_TYPES: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'smith_machine',
  'bands',
];

// i18next v17 has strict literal-key typing. The dynamic muscle /
// equipment lookups below are safe by construction (enum values come
// from Postgres, keys exist in both locale bundles) but TS can't see
// that. Widening via `any` at the lookup sites matches the codebase
// pattern for typed-routes forward-refs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFn = (...args: any[]) => string;

function loggingKey(
  type: LoggingType,
):
  | 'picker.loggingType.weightReps'
  | 'picker.loggingType.repsOnly'
  | 'picker.loggingType.timeSeconds' {
  switch (type) {
    case 'weight_reps':
      return 'picker.loggingType.weightReps';
    case 'reps_only':
      return 'picker.loggingType.repsOnly';
    case 'time_seconds':
      return 'picker.loggingType.timeSeconds';
    case 'distance_weight':
      // Seed data (T-105) currently has no distance_weight rows; fall
      // back to the closest weighted label so the UI never blanks out
      // if one is added later.
      return 'picker.loggingType.weightReps';
  }
}

export default function ExercisePickerScreen() {
  const { t: tTyped } = useTranslation();
  // Widen to accept runtime-constructed keys (muscleGroups.*, equipment.*)
  // whose string shapes exist in the locale bundle but aren't visible to
  // i18next's literal-type inference.
  const t = tTyped as unknown as TFn;
  const router = useRouter();

  const { data: exercises, isLoading, error } = useExercises();
  const setSelectedExerciseId = useExercisePickerResult(
    (s) => s.setSelectedExerciseId,
  );

  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(
    null,
  );
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null,
  );

  // Filter + search are applied in one pass over the pre-sorted array.
  const filtered = useMemo<Exercise[]>(() => {
    if (!exercises) return [];
    const needle = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (selectedMuscle && ex.primary_muscle !== selectedMuscle) return false;
      if (selectedEquipment && ex.equipment !== selectedEquipment) return false;
      if (needle && !ex.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [exercises, search, selectedMuscle, selectedEquipment]);

  // Grouping decision lives here — see file-header comment.
  const shouldGroupByMuscle = selectedMuscle === null;

  const sections = useMemo(() => {
    if (!shouldGroupByMuscle) return [];
    const byMuscle = new Map<MuscleGroup, Exercise[]>();
    for (const ex of filtered) {
      const bucket = byMuscle.get(ex.primary_muscle);
      if (bucket) {
        bucket.push(ex);
      } else {
        byMuscle.set(ex.primary_muscle, [ex]);
      }
    }
    // Iterate canonical muscle order so sections are deterministic.
    return MUSCLE_GROUPS.filter((m) => byMuscle.has(m)).map((muscle) => ({
      muscle,
      title: t('picker.sectionHeader', {
        muscle: t(`picker.muscleGroups.${muscle}`),
      }),
      data: byMuscle.get(muscle) ?? [],
    }));
  }, [filtered, shouldGroupByMuscle, t]);

  const handleSelectExercise = useCallback(
    (exerciseId: string) => {
      void Haptics.selectionAsync();
      setSelectedExerciseId(exerciseId);
      router.back();
    },
    [router, setSelectedExerciseId],
  );

  const handleClose = useCallback(() => {
    void Haptics.selectionAsync();
    router.back();
  }, [router]);

  const renderRow = useCallback(
    (item: Exercise) => (
      <ExerciseRow
        exercise={item}
        muscleLabel={t(`picker.muscleGroups.${item.primary_muscle}`)}
        equipmentLabel={t(`picker.equipment.${item.equipment}`)}
        compoundLabel={t('picker.compound')}
        unilateralLabel={t('picker.unilateral')}
        loggingLabel={t(loggingKey(item.logging_type))}
        onPress={handleSelectExercise}
      />
    ),
    [t, handleSelectExercise],
  );

  const renderSectionItem = useCallback(
    ({ item }: SectionListRenderItemInfo<Exercise, { title: string }>) =>
      renderRow(item),
    [renderRow],
  );

  const renderFlatItem = useCallback(
    ({ item }: ListRenderItemInfo<Exercise>) => renderRow(item),
    [renderRow],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/*
       * Viewport hierarchy (durable principle feedback_viewport_hierarchy):
       * primary content ≥60% viewport, chrome ≤40%.
       *
       * iPhone SE (375×667pt, safe-area top ~44pt, effective height ~623pt):
       *   header (title + close):          46pt
       *   search bar (h-12 + mb-3):        60pt
       *   muscle filter row (h-9 + py):    44pt
       *   equipment filter row (h-9 + py): 44pt
       *   gap before list (mt-4):          16pt
       *   ────────────────────────────────────
       *   chrome total:                   210pt  (≈34% of 623pt) ✓
       *   exercise list:                  413pt  (≈66% of 623pt) ✓
       *   → at 88pt per row = ~4.7 rows visible. ExerciseRow min-h is
       *     ~64pt (min-h-16 + py-3 + 2 text lines ≈ 68pt) so the real
       *     count is 5-6 rows visible above the fold.
       *
       * iPhone 15 Pro (393×852pt) has more room — list hits ~70%+.
       */}

      {/* ── Modal header ───────────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Text
          className="text-display-lg text-content"
          accessibilityRole="header"
        >
          {t('picker.title')}
        </Text>
        <Pressable
          onPress={handleClose}
          className="h-11 w-11 items-center justify-center"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={28} color={colors.content.secondary} />
        </Pressable>
      </View>

      {/* ── Search ─────────────────────────────────────────────── */}
      <View className="mb-3 px-5">
        <View className="h-12 flex-row items-center rounded-input bg-surface px-3">
          <Ionicons
            name="search"
            size={18}
            color={colors.content.muted}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('picker.searchPlaceholder')}
            placeholderTextColor={colors.content.muted}
            className="ml-2 flex-1 text-body font-inter text-content"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('picker.searchPlaceholder')}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.content.muted}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Muscle filter pills ──────────────────────────────────
          Compact: h-9 row, pills h-8 inside. No vertical gap above —
          sits directly under the search bar. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          gap: 8,
          alignItems: 'center',
        }}
        style={{ height: 36, flexGrow: 0 }}
      >
        <FilterPill
          label={t('picker.filterAll')}
          active={selectedMuscle === null}
          onPress={() => setSelectedMuscle(null)}
        />
        {MUSCLE_GROUPS.map((muscle) => (
          <FilterPill
            key={muscle}
            label={t(`picker.muscleGroups.${muscle}`)}
            active={selectedMuscle === muscle}
            onPress={() =>
              setSelectedMuscle((cur) => (cur === muscle ? null : muscle))
            }
          />
        ))}
      </ScrollView>

      {/* ── Equipment filter pills ───────────────────────────────
          Same compact treatment, 8pt gap above the muscle row. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          gap: 8,
          alignItems: 'center',
        }}
        style={{ height: 36, flexGrow: 0, marginTop: 8 }}
      >
        <FilterPill
          label={t('picker.filterAll')}
          active={selectedEquipment === null}
          onPress={() => setSelectedEquipment(null)}
        />
        {EQUIPMENT_TYPES.map((eq) => (
          <FilterPill
            key={eq}
            label={t(`picker.equipment.${eq}`)}
            active={selectedEquipment === eq}
            onPress={() =>
              setSelectedEquipment((cur) => (cur === eq ? null : eq))
            }
          />
        ))}
      </ScrollView>

      {/* ── Results ──────────────────────────────────────────────
          mt-4 gap between the last filter row and the list. */}
      <View className="mt-4 flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary.DEFAULT} />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-body font-inter-semibold text-content">
              {t('errors.loadFailed')}
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-body font-inter-semibold text-content">
              {t('picker.emptySearchTitle')}
            </Text>
            <Text className="mt-1 font-inter text-body text-content-secondary">
              {t('picker.emptySearchHelper')}
            </Text>
          </View>
        ) : shouldGroupByMuscle ? (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderSectionItem}
            renderSectionHeader={({ section }) => (
              <View className="bg-background px-5 pb-2 pt-4">
                <Text className="text-small-caps uppercase text-content-secondary">
                  {section.title}
                </Text>
              </View>
            )}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <SectionList
            // Same SectionList, zero sections, flat data — avoids shipping
            // a second list component for the single-filter path.
            sections={[{ title: '', data: filtered }]}
            keyExtractor={(item) => item.id}
            renderItem={renderFlatItem}
            renderSectionHeader={null as never}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 4,
              paddingBottom: 32,
            }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
