import type { QueryClient } from "@tanstack/react-query";
import type { LocationGeocodedAddress } from "expo-location";
import type {
  LocationData,
  LocationItem,
  LocationParams,
} from "../../types/location";
import { query } from "../hooks/useUserSettings";
import type { City } from "../../components/inputs/CityAutocomplete";
import countries from "../constants/country";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import queryClient from "../reactQuery";
import { useLocationStore } from "../../store/locationStore";
import type { UserSettings } from "../hooks/useUserSettings";

export function locationQueryString(lat: number, lng: number): string {
  return `POINT(${lng} ${lat})`;
}

export function getLocationName(location: LocationGeocodedAddress) {
  const name =
    `${location?.city}, ${location?.region}, ${location?.isoCountryCode}` ||
    "N/A";
  return name;
}

async function saveLocation(coords: { latitude: number; longitude: number }) {
  try {
    await AsyncStorage.setItem(
      "lastLocation",
      JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: Date.now(),
      })
    );
  } catch (err) {
    console.warn("Error guardando ubicación:", err);
  }
}

async function getSavedLocation() {
  try {
    const saved = await AsyncStorage.getItem("lastLocation");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const age = Date.now() - parsed.timestamp;
    if (age < 1000 * 60 * 60 * 6) {
      // menos de 6 h → válida
      return parsed;
    }
  } catch (err) {
    console.warn("Error leyendo ubicación guardada:", err);
  }
  return null;
}

export async function getLocationParamsFromClient(
  client: QueryClient,
  authLocation?: { latitude: number; longitude: number } | null
): Promise<LocationParams> {
  const settings = client.getQueryData<UserSettings>(query.queryKey);
  console.log("Solicitando ubicación al iniciar sesión...");

  let coords:
    | { latitude: number; longitude: number }
    | null = null;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("Permiso de ubicación denegado");
      return { search_lat: null, search_lon: null, search_radius_meters: null };
    }

    // 1️⃣ Si viene del AuthContext
    if (authLocation) {
      coords = authLocation;
      console.log("📦 Usando ubicación del AuthContext:", coords);
    }

    // 2️⃣ Si no hay authLocation, probar AsyncStorage
    if (!coords) {
      const saved = await getSavedLocation();
      if (saved) {
        coords = saved;
        console.log("📍 Usando ubicación guardada:", coords);
      }
    }

    // 3️⃣ Si no hay guardada, pedir última conocida (rápido)
    if (!coords) {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        coords = lastKnown.coords;
        console.log("📍 Usando lastKnownPosition:", coords);
      }
    }
    // TODO: Fix Slow Location
    // 4️⃣ Si tampoco hay, pedir una nueva (más lenta)
    if (!coords) {
      console.log("⏳ Obteniendo nueva ubicación GPS...");
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      coords = location.coords;
    }

    if (!coords) throw new Error("No se pudo obtener ubicación");

    // Guardar para la próxima vez
    saveLocation(coords);

    // Actualizar React Query client
    updateClientWithCoords(client, settings, coords);

    return {
      search_lat: coords.latitude,
      search_lon: coords.longitude,
      search_radius_meters:
        settings?.searchRadius ?? 5000,
    };
  } catch (e) {
    console.warn("Error obteniendo ubicación:", e);
    return { search_lat: null, search_lon: null, search_radius_meters: null };
  }
}

async function updateClientWithCoords(
  client: QueryClient,
  settings: UserSettings | undefined,
  coords: { latitude: number; longitude: number }
) {
  if (!settings) return;

  const baseSettings = {
    ...settings,
    lastGPSLocation: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      city: null,
      country: null,
      fullAddress: [],
    },
    useGPS: true,
  };
  client.setQueryData(query.queryKey, baseSettings);

  try {
    const geocoded = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    const first = geocoded[0];
    const city =
      first?.city || first?.district || first?.region || "Desconocida";
    const country = first?.country ?? "Desconocido";

    client.setQueryData(query.queryKey, {
      ...baseSettings,
      lastGPSLocation: {
        ...baseSettings.lastGPSLocation,
        city,
        country,
        fullAddress: geocoded,
      },
    });
  } catch (err) {
    console.warn("Error en reverseGeocode:", err);
  }
}

export function cityToLocationItem(city: City): LocationItem {
  const country = countries.find((c) => c.code === city.country_code);
  return {
    name: `${city.name}, ${country?.name ?? "N/A"}`,
    lat: city.latitude,
    lng: city.longitude,
    isoCountryCode: city.country_code,
  };
}

export function cityToLocationData(city: City): LocationData {
  const country =
    countries.find((c) => c.code === city.country_code)?.name ?? "N/A";
  return {
    latitude: city.latitude,
    longitude: city.longitude,
    city: city.name,
    country,
    fullAddress: [],
  };
}

export async function buildLocationParams(): Promise<LocationParams> {
  const { searchRadius } = await queryClient.ensureQueryData(query);
  const location = useLocationStore.getState().effectiveLocation;

  if (!location) {
    return {
      search_lat: null,
      search_lon: null,
      search_radius_meters: searchRadius,
    }
  }

  return {
    search_lat: location.latitude,
    search_lon: location.longitude,
    search_radius_meters: searchRadius,
  }
}
