import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { perfilQueryOptions, sessionQueryOptions } from "../queryOptions";
import { useUserSettings } from "./useUserSettings";
import type { UserUpdate } from "../../types/db.overrides.types";
import { supabase } from "../supabase";

export function useUser() {
  const { data: session } = useQuery(sessionQueryOptions);
  const { data: profile } = useQuery(perfilQueryOptions);
  const settings = useUserSettings();
  const user = session?.user;
  const isLoggedIn = Boolean(user);
  const isProfileComplete = profile?.perfil_completo ?? false;
  const isDniVerified = profile?.dni_verificado ?? false;

  return {
    user,
    profile,
    session,
    settings,
    isLoggedIn,
    isProfileComplete,
    isDniVerified,
  };
}

export async function UserUpdateProfile(id: string, payload: UserUpdate) {
  const { data, error } = await supabase
    .from('usuarios')
    .update(payload)
    .eq('id', id);

  if (error) {
    throw error;
  }

  return data;
}

export function useSuspenseProfile() {
  const { data: profile, refetch } = useSuspenseQuery(perfilQueryOptions);
  const askDniVerification = profile.perfil_completo && !profile.dni_verificado;
  const askProfileCompletion = !profile.perfil_completo;
  const isUserRestricted = askDniVerification || askProfileCompletion;
  const isSuscriptor = profile.suscriptor ?? false;

  const update = async (payload: UserUpdate) => {
    return UserUpdateProfile(profile.id, payload);
  };

  return {
    ...profile,
    refetch,
    askDniVerification,
    askProfileCompletion,
    isUserRestricted,
    isSuscriptor,
    update,
  };
}
