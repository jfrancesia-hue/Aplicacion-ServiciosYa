import * as Location from "expo-location";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "../lib/storagev2";
import type { Coords, LocationSource } from "../types/location";
import queryClient from "../lib/reactQuery";
import { locationIpInfoQueryOptions } from "../lib/queryOptions";

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
    setCustomLocation: (
        coords: Pick<Coords, "latitude" | "longitude">
    ) => Promise<void>;
    useDeviceLocation: () => void;
    clearCustomLocation: () => void;
};

/**
 * Reverse-geocode GPS coordinates → city & country
 */
async function resolveLocationFromCoords(
    coords: Pick<Coords, "latitude" | "longitude" | "accuracy">
): Promise<Coords> {
    try {
        const [place] = await Location.reverseGeocodeAsync({
            latitude: coords.latitude,
            longitude: coords.longitude,
        });

        return {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy ?? null,
            city: place?.city ?? place?.subregion ?? null,
            province: place?.region ?? null,
            locality: place?.subregion ?? null,
            country: place?.country ?? null,
        };
    } catch {
        return {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy ?? null,
            city: null,
            province: null,
            locality: null,
            country: null,
        };
    }
}

/**
 * IP-based fallback (no permissions, low accuracy)
 */
async function resolveLocationFromIP(): Promise<Coords> {
    const { latitude, longitude, city, province, locality, country } = await queryClient.ensureQueryData(locationIpInfoQueryOptions);

    return {
        latitude,
        longitude,
        accuracy: null,
        city,
        province,
        locality,
        country,
    };
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
                    const { status } =
                        await Location.requestForegroundPermissionsAsync();

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

                    let position = await Location.getLastKnownPositionAsync();

                    if (!position) {
                        position = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced});
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
                            state.source === "custom"
                                ? state.customLocation
                                : resolved,
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
                        const message = e instanceof Error ? e.message : "Failed to resolve location";
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
        }
    )
);
