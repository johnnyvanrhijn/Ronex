import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env"
  );
}

// Expo Router prerenders routes server-side (Node context) to build the route
// manifest. In that context there is no `window`, which AsyncStorage's web
// fallback relies on — initializing Supabase's auth with AsyncStorage during
// prerender would throw `ReferenceError: window is not defined`. Detect the
// SSR/prerender context and disable persistent session handling there; at
// runtime on the device this branch is never taken.
const isSSR = typeof window === "undefined";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isSSR ? undefined : AsyncStorage,
    autoRefreshToken: !isSSR,
    persistSession: !isSSR,
    detectSessionInUrl: false, // React Native has no URL-based auth flow
  },
});
