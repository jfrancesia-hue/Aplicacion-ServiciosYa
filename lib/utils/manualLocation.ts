import type { LocationItem } from "../../types/location";

type CityCoordinates = {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string | null;
};

export function buildApproximateCityLocation(
  city: CityCoordinates,
  address: string,
): LocationItem | null {
  if (!Number.isFinite(city.latitude) || !Number.isFinite(city.longitude)) {
    return null;
  }

  return {
    name: `${address.trim()}, ${city.name} (zona aproximada)`,
    lat: city.latitude,
    lng: city.longitude,
    isoCountryCode: city.country_code || "AR",
  };
}
