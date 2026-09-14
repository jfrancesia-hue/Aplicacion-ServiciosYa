import type { LocationGeocodedAddress } from "expo-location";

export interface LocationData {
  latitude: number;
  longitude: number;
  city: string | null;
  province?: string | null;
  locality?: string | null;
  country: string | null;
  fullAddress: LocationGeocodedAddress[];
}

export interface LocationItem {
  name?: string;
  lat: number;
  lng: number;
  isoCountryCode?: string;
}

export interface LocationParams {
  search_lat?: number;
  search_lon?: number;
  search_radius_meters?: number;
}

export interface LocationIpInfo {
  ip: string;
  hostname: string;
  city: string;
  region: string;
  country: string;
  loc: string; // "lat,lng"
  org: string;
  postal: string;
  timezone: string;
  readme: string;
}

export type Coords = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  city?: string | null;
  province?: string | null;
  locality?: string | null;
  country?: string | null;
};

export type LocationSource = "device" | "custom" | "ip";
