import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/db.overrides.types";

// Configuración de Supabase (asegúrate de reemplazar con tus claves de Supabase)
const supabaseUrl = "https://dhhhftzdfpqthzvkrqoz.supabase.co"; // Reemplaza con tu URL de Supabase
const supabaseKey =
  "sb_publishable_KKEalDuwBI5TvVta4LLO8A_bLFmnFA0"; // Clave pública vigente del proyecto
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
