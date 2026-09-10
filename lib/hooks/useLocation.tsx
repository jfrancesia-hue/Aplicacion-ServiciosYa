// hooks/useLocation.ts
import { queryOptions, useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import type { LocationData } from "../../types/location";

export const PERMISSION_DENIED_ERROR =
  "El permiso para acceder a la ubicación fue denegado.";

export const fetchUserLocation = async (): Promise<LocationData> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error(PERMISSION_DENIED_ERROR);
  }

  const currentPosition = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = currentPosition.coords;

  const addressResponse = await Location.reverseGeocodeAsync({
    latitude,
    longitude,
  });

  const city = addressResponse?.[0]?.city ?? null;
  const country = addressResponse?.[0]?.country ?? null;

  return {
    latitude,
    longitude,
    city,
    country,
    fullAddress: addressResponse || [],
  };
};

export const fetchUserLocationFromIP = async (): Promise<LocationData> => {
  const response = await fetch("https://ipwho.is/");
  if (!response.ok) {
    throw new Error(`ipwho.is returned ${response.status}`);
  }
  const data = await response.json();
  if (
    data.success !== true ||
    typeof data.latitude !== "number" ||
    typeof data.longitude !== "number"
  ) {
    throw new Error(data.message || "No se pudo estimar la ubicación por IP.");
  }

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    city: data.city || "N/A",
    country: data.country_code || "N/A",
    fullAddress: [],
  };
};

export const userLocationQueryOptions = queryOptions({
  queryKey: ["user", "location"],
  queryFn: async () => {
    try {
      return await fetchUserLocation();
    } catch (error) {
      if (error instanceof Error && error.message === PERMISSION_DENIED_ERROR) {
        return await fetchUserLocationFromIP();
      }
      throw error;
    }
  },

  // --- KEY CHANGE HERE ---
  // The data will never be considered stale. This prevents automatic refetches
  // on mount, window focus, or reconnect. Data is fetched once and then
  // cached indefinitely until a manual refetch is triggered.
  staleTime: Number.POSITIVE_INFINITY,

  // This is now somewhat redundant due to staleTime: Infinity, but it's
  // good practice to be explicit about your intent.
  refetchOnWindowFocus: false,

  // Also disable refetch on reconnect
  refetchOnReconnect: false,

  // Retry logic remains useful for the *initial* fetch.
  retry: (failureCount, error) => {
    if (error.message === PERMISSION_DENIED_ERROR) {
      return false;
    }
    return failureCount < 2;
  },
});

export function useLocation() {
  const {
    data: location,
    isLoading,
    isError,
    error,
    refetch,
    // You can also get the status to differentiate initial loading from fetching
    isFetching,
  } = useQuery(userLocationQueryOptions);

  return { location, isLoading, isError, error, refetch, isFetching };
}
