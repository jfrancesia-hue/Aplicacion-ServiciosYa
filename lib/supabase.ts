import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/db.overrides.types";

const productionSupabaseUrl = "https://dhhhftzdfpqthzvkrqoz.supabase.co";
const productionSupabaseKey =
  "sb_publishable_KKEalDuwBI5TvVta4LLO8A_bLFmnFA0";

const releaseChannel =
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL?.trim().toLowerCase() ?? "production";
const configuredSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const configuredSupabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (
  releaseChannel === "internal" &&
  (!configuredSupabaseUrl || !configuredSupabaseKey)
) {
  throw new Error(
    "La build interna requiere EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY de un entorno de pruebas.",
  );
}

const supabaseUrl = configuredSupabaseUrl || productionSupabaseUrl;
const supabaseKey = configuredSupabaseKey || productionSupabaseKey;
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
