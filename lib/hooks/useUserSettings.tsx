import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  queryOptions,
} from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LocationData } from "../../types/location";

/**
 * Define la estructura de la configuración del usuario.
 * Usar una interfaz de TypeScript nos da seguridad de tipos y autocompletado.
 */
export interface UserSettings {
  searchRadius: number;
  showAllCategories: boolean;
  customLocation: LocationData | null;
}

/**
 * Una clave única para almacenar la configuración en AsyncStorage.
 */
export const SETTINGS_STORAGE_KEY = "app-user-settings";

/**
 * Una clave de consulta única para que React Query administre estos datos.
 */
export const queryKey = ["user", "settings"];

/**
 * Configuración predeterminada para usuarios nuevos o si falla el almacenamiento.
 */
const defaultSettings: UserSettings = {
  searchRadius: 10000,
  showAllCategories: true,
  customLocation: null,
};

const validSearchRadii = new Set([1000, 5000, 10000, 50000]);

function sanitizeSettings(value: unknown): UserSettings {
  const stored =
    value && typeof value === "object"
      ? (value as Partial<UserSettings>)
      : {};
  const customLocation = stored.customLocation;
  const hasValidCustomLocation =
    customLocation != null &&
    Number.isFinite(customLocation.latitude) &&
    Number.isFinite(customLocation.longitude);

  return {
    searchRadius: validSearchRadii.has(Number(stored.searchRadius))
      ? Number(stored.searchRadius)
      : defaultSettings.searchRadius,
    showAllCategories:
      typeof stored.showAllCategories === "boolean"
        ? stored.showAllCategories
        : defaultSettings.showAllCategories,
    customLocation: hasValidCustomLocation ? customLocation : null,
  };
}

/**
 * Obtiene la configuración desde AsyncStorage.
 * Si no se encuentra configuración o hay un error de análisis, retorna la configuración predeterminada.
 */
export async function getSettingsFromStorage(): Promise<UserSettings> {
  try {
    const rawSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (rawSettings) {
      // Mezcla con la configuración predeterminada para asegurar que todas las claves estén presentes
      // en caso de que agreguemos nuevas configuraciones en una futura actualización de la app.
      return sanitizeSettings(JSON.parse(rawSettings));
    }
    return defaultSettings;
  } catch (error) {
    console.warn(
      "No se pudo analizar la configuración desde AsyncStorage:",
      error,
    );
    // Volver a la configuración predeterminada en caso de corrupción
    return defaultSettings;
  }
}

/**
 * Guarda el objeto completo de configuración en AsyncStorage.
 */
export async function saveSettingsToStorage(
  settings: UserSettings,
): Promise<UserSettings> {
  try {
    const rawSettings = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, rawSettings);
    return settings; // Retorna la configuración en caso de éxito
  } catch (error) {
    console.warn("No se pudo guardar la configuración en AsyncStorage:", error);
    // Relanza el error para que la mutación de React Query pueda manejarlo
    throw new Error("No se pudo guardar la configuración.");
  }
}

export async function clearSettingsToStorage() {
  try {
    await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.warn("No se pudo remover la configuración en AsyncStorage:", error);
    throw new Error("No se pudo remover la configuración.");
  }
}

export const query = queryOptions({
  queryKey,
  queryFn: getSettingsFromStorage,
  staleTime: Number.POSITIVE_INFINITY,
});

/**
 * Un wrapper de React Query para gestionar la configuración del usuario en la app.
 *
 * @returns Un objeto con la configuración actual, una función para actualizar,
 *          y estados de carga/actualización.
 *
 * @example
 * const { settings, updateSettings, isLoading, isUpdating } = useUserSettings();
 */
export function useUserSettings() {
  const queryClient = useQueryClient();

  const {
    data: settings,
    isLoading,
    isError,
    error,
  } = useSuspenseQuery(query);

  // The hook `useMutation` to handle updates.
  // THIS IS THE MODIFIED PART
  const { mutateAsync, isPending: isUpdating } = useMutation({
    // The new mutation function now accepts a PARTIAL settings object.
    mutationFn: (newPartialSettings: Partial<UserSettings>) => {
      // 1. Get the current state from the query cache.
      const currentSettings =
        queryClient.getQueryData<UserSettings>(queryKey) || defaultSettings;

      // 2. Merge the current settings with the new partial settings.
      const updatedSettings = { ...currentSettings, ...newPartialSettings };

      // 3. Save the new, complete settings object to storage.
      // We are still using the original save function here.
      return saveSettingsToStorage(updatedSettings);
    },
    // The rest of the mutation options remain the same
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(queryKey, updatedSettings);
    },
    onError: (err) => {
      console.warn("La actualización de la configuración falló:", err);
    },
  });

  // It's good practice to also update the JSDoc and the returned function name for clarity
  return {
    /** The user settings object. Falls back to defaults if needed. */
    settings,
    /**
     * A function to update the settings.
     * Pass a PARTIAL settings object (e.g., { theme: 'dark' }).
     */
    updateSettings: mutateAsync,
    /** True if settings are being fetched for the first time. */
    isLoading,
    /** True if an update operation is in progress. */
    isUpdating,
    /** True if there was an error fetching settings. */
    isError,
    /** The error object if fetching failed. */
    error,
  };
}

export function useUserSettingsSuspense() {
  return useSuspenseQuery(query);
}
