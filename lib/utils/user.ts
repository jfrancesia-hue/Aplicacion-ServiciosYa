import type { Query, QueryClient } from "@tanstack/react-query";
import { sessionQueryOptions } from "../queryOptions";
import type { Enums } from "../../types/database.types";

export function getUserFromClient(client: QueryClient) {
  const session = client.getQueryData(sessionQueryOptions.queryKey);
  if (!session || !session.user) {
    throw new Error("Ninguna sesión o usuario encontrado.");
  }

  return session.user;
}

export type Roles = Enums<"user_role">;
export type ProviderCapabilityProfile = {
  rol?: Roles | string | null;
  provider_enabled?: boolean | null;
};

/**
 * `provider_enabled` is the capability source of truth since build 99.
 * The role fallback keeps cached profiles and builds created before the
 * capability migration working while they refresh.
 */
export function hasProviderCapability(
  profile: ProviderCapabilityProfile | null | undefined,
): boolean {
  if (!profile) return false;
  return profile.provider_enabled === true || profile.rol === "worker";
}

// helpers
export function isWorker(role: Roles): boolean {
  return role === "worker";
}
export function isUser(role: Roles): boolean {
  return role === "user";
}
export function isAdmin(role: Roles): boolean {
  return role === "admin";
}
export function isGuest(role: Roles): boolean {
  return role === "guest";
}
