import * as Location from "expo-location";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { resolveArgentineProvince } from "../lib/utils/geoSegmentation";
import { zustandStorage } from "../lib/storagev2";
import type { Coords, LocationSource } from "../types/location";

type LocationState = {
  source: LocationSource;
  deviceLocation: Coords | null;
  customLocation: Coords | null;
  isLoading: boolean;
  error: string | null;
  effectiveLocation: Coords | null;
  requestDeviceLocation: () => Promise<void>;
  setCustomLocation: (coords: Coords) => Promise<void>;
  useDeviceLocation: () => void;
  clearCustomLocation: () => void;
};

function normalizeArgentineLocation(coords: Coords): Coords {
  const country = String(coords.country ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
  const insideArgentina =
    coords.latitude >= -56 &&
    coords.latitude <= -21 &&
    coords.longitude >= -74 &&
    coords.longitude <= -53;
  const isArgentina =
    insideArgentina || ["ar", "arg", "argentina"].includes(country);
  const canonicalProvince = isArgentina
    ? resolveArgentineProvince(coords.province) ||
      resolveArgentineProvince(coords.city) ||
      resolveArgentineProvince(coords.locality)
    : null;

  return {
    ...coords,
    province: canonicalProvince ?? coords.province ?? null,
    locality: coords.locality ?? coords.city ?? null,
  };
}

async function resolveLocationFromCoords(coords: Coords): Promise<Coords> {
  if (coords.city && coords.province) {
    return normalizeArgentineLocation({
      ...coords,
      locality: coords.locality ?? coords.city,
      country: coords.country ?? "Argentina",
    });
  }

  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    return normalizeArgentineLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? null,
      city: coords.city ?? place?.city ?? place?.subregion ?? null,
      province: coords.province ?? place?.region ?? null,
      locality: coords.locality ?? place?.district ?? place?.subregion ?? null,
      country: coords.country ?? place?.country ?? null,
    });
  } catch {
    return normalizeArgentineLocation({
      ...coords,
      accuracy: coords.accuracy ?? null,
    });
  }
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      source: "device",
      deviceLocation: null,
      customLocation: null,
      isLoading: false,
      error: null,
      effectiveLocation: null,

      // Solo se llama desde un botón elegido por el usuario.
      requestDeviceLocation: async () => {
        set({ isLoading: true, error: null });

        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            set({
              deviceLocation: null,
              source: "device",
              effectiveLocation: null,
              isLoading: false,
              error:
                "Permiso de ubicación rechazado. Elegí una ciudad manualmente o habilitá el permiso en Android.",
            });
            return;
          }

          const lastKnown = await Location.getLastKnownPositionAsync();
          const lastKnownAge = lastKnown
            ? Date.now() - lastKnown.timestamp
            : Number.POSITIVE_INFINITY;
          let position =
            lastKnown && lastKnownAge <= 2 * 60 * 1000 ? lastKnown : null;

          if (!position) {
            position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
          }

          const resolved = await resolveLocationFromCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });

          set((state) => ({
            deviceLocation: resolved,
            source: "device",
            effectiveLocation:
              state.source === "custom" ? state.customLocation : resolved,
            isLoading: false,
            error: null,
          }));
        } catch (error: unknown) {
          console.warn(
            "No se pudo obtener la ubicación GPS:",
            error instanceof Error ? error.message : error,
          );
          set({
            deviceLocation: null,
            source: "device",
            effectiveLocation: null,
            isLoading: false,
            error:
              "No pudimos obtener tu ubicación. Revisá que el GPS esté activo o elegí una ciudad manualmente.",
          });
        }
      },

      setCustomLocation: async (coords) => {
        set({ isLoading: true, error: null });
        const resolved = await resolveLocationFromCoords(coords);
        set({
          customLocation: resolved,
          source: "custom",
          effectiveLocation: resolved,
          isLoading: false,
          error: null,
        });
      },

      useDeviceLocation: () =>
        set((state) => ({
          source: "device",
          effectiveLocation: state.deviceLocation,
          error: null,
        })),

      clearCustomLocation: () =>
        set((state) => ({
          customLocation: null,
          source: "device",
          effectiveLocation: state.deviceLocation,
          error: null,
        })),
    }),
    {
      name: "location-store",
      storage: createJSONStorage(() => zustandStorage),
      version: 2,
      migrate: (persistedState: unknown, persistedVersion: number) => {
        const state = persistedState as Partial<LocationState> | undefined;
        if (!state) return persistedState as unknown as LocationState;

        // Las versiones anteriores podían guardar una ubicación aproximada
        // por IP o el centro de una ciudad. Al actualizar, se pide una única
        // confirmación explícita para no reutilizarla como si fuera exacta.
        if (persistedVersion < 2) {
          return {
            ...state,
            source: "device",
            deviceLocation: null,
            customLocation: null,
            effectiveLocation: null,
            error: null,
          } as LocationState;
        }

        if (state.source !== "ip") return state as LocationState;
        return {
          ...state,
          source: "device",
          deviceLocation: null,
          effectiveLocation: null,
          error: null,
        } as LocationState;
      },
    },
  ),
);
