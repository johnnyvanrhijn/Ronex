import { Redirect } from 'expo-router';

/**
 * `(tabs)/index` exists only to resolve the group-default route. Expo Router
 * requires a concrete route when the user lands on `/(tabs)` (cold start,
 * external deep link, or legacy `router.replace('/(tabs)')` calls). Without
 * this file Expo renders its "screen doesn't exist" not-found page.
 *
 * The Tabs layout's `initialRouteName: 'challenge'` handles *intra-tab*
 * navigation but NOT the group-level default — that's this redirect's job.
 */
export default function TabsIndex() {
  return <Redirect href="/(tabs)/challenge" />;
}
