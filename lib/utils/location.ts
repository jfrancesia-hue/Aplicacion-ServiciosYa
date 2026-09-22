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
import queryClient from "../reactQuery";
import { useLocationStore } from "../../store/locationStore";
import type { UserSettings } from "../hooks/useUserSettings";
import { ARGENTINE_PROVINCE_BY_STATE_CODE } from "./geoSegmentation";

export function locationQueryString(lat: number, lng: number): string {
  return `POINT(${lng} ${lat})`;
}

export function getLocationName(location: LocationGeocodedAddress) {
  const name =
    `${location?.city}, ${location?.region}, ${location?.isoCountryCode}` ||
    "N/A";
  return name;
}

export async function getLocationParamsFromClient(
  client: QueryClient,
): Promise<LocationParams> {
  const settings = client.getQueryData<UserSettings>(query.queryKey);
  const location = useLocationStore.getState().effectiveLocation;

  return {
    search_lat: location?.latitude,
    search_lon: location?.longitude,
    search_radius_meters: settings?.searchRadius ?? 10000,
  };
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
    province:
      ARGENTINE_PROVINCE_BY_STATE_CODE[city.state_code.toUpperCase()] ?? null,
    locality: city.name,
    country,
    fullAddress: [],
  };
}

export async function buildLocationParams(): Promise<LocationParams> {
  const { searchRadius } = await queryClient.ensureQueryData(query);
  const location = useLocationStore.getState().effectiveLocation;

  if (!location) {
    return {
      search_lat: undefined,
      search_lon: undefined,
      search_radius_meters: searchRadius,
    };
  }

  return {
    search_lat: location.latitude,
    search_lon: location.longitude,
    search_radius_meters: searchRadius,
  };
}
