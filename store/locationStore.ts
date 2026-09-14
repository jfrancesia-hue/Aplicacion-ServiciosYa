import * as Location from "expo-location";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "../lib/storagev2";
import type { Coords, LocationSource } from "../types/location";
import queryClient from "../lib/reactQuery";
import { locationIpInfoQueryOptions } from "../lib/queryOptions";
import { resolveArgentineProvince } from "../lib/utils/geoSegmentation";

type LocationState = {
  source: LocationSource; // "device" | "custom" | "ip"

  deviceLocation: Coords | null;
  customLocation: Coords | null;

  isLoading: boolean;
  error: string | null;

  // derived
  effectiveLocation: Coords | null;

  // actions
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

/**
 * Reverse-geocode GPS coordinates → city & country
 */
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
      locality: coords.locality ?? place?.subregion ?? place?.city ?? null,
      country: coords.country ?? place?.country ?? null,
    });
  } catch {
    return normalizeArgentineLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? null,
      city: coords.city ?? null,
      province: coords.province ?? null,
      locality: coords.locality ?? null,
      country: coords.country ?? null,
    });
  }
}

/**
 * IP-based fallback (no permissions, low accuracy)
 */
async function resolveLocationFromIP(): Promise<Coords> {
  const { latitude, longitude, city, province, locality, country } =
    await queryClient.ensureQueryData(locationIpInfoQueryOptions);

  return normalizeArgentineLocation({
    latitude,
    longitude,
    accuracy: null,
    city,
    province,
    locality,
    country,
  });
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      source: "device",

      deviceLocation: null,
      customLocation: null,

      isLoading: false,
      error: null,

      effectiveLocation: null,

      /**
       * Request GPS ONCE.
       * If permission denied or GPS fails → fallback to IP.
       */
      requestDeviceLocation: async () => {
        set({ isLoading: true, error: null });
        console.log("Requesting device location...");

        try {
          const { status } = await Location.requestForegroundPermissionsAsync();

          // 🚨 Permission denied → IP fallback
          if (status !== "granted") {
            const ipLocation = await resolveLocationFromIP();

            set({
              deviceLocation: ipLocation,
              source: "ip",
              effectiveLocation: ipLocation,
              isLoading: false,
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
          }));
        } catch {
          // ⚠️ Any failure → IP fallback
          try {
            const ipLocation = await resolveLocationFromIP();

            set({
              deviceLocation: ipLocation,
              source: "ip",
              effectiveLocation: ipLocation,
              isLoading: false,
            });
          } catch (e: unknown) {
            console.log(`Failed to resolve location: ${e}`);
            const message =
              e instanceof Error ? e.message : "Failed to resolve location";
            set({
              error: message,
              isLoading: false,
            });
          }
        }
      },

      /**
       * Manually set a custom location (map picker, search, etc.)
       */
      setCustomLocation: async (coords) => {
        set({ isLoading: true, error: null });

        const resolved = await resolveLocationFromCoords(coords);

        set({
          customLocation: resolved,
          source: "custom",
          effectiveLocation: resolved,
          isLoading: false,
        });
      },

      /**
       * Switch back to device (GPS or IP)
       */
      useDeviceLocation: () =>
        set((state) => ({
          source: state.deviceLocation ? "device" : state.source,
          effectiveLocation: state.deviceLocation,
        })),

      /**
       * Clear custom override
       */
      clearCustomLocation: () =>
        set((state) => ({
          customLocation: null,
          source: "device",
          effectiveLocation: state.deviceLocation,
        })),
    }),
    {
      name: "location-store",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
