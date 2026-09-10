import {
  type QueryClient,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { Servicio } from "../../types/servicios";
import { query as settingsQuery } from "./useUserSettings";
import { buildLocationParams, getLocationParamsFromClient } from "../utils/location";
import type { WorkerStatus } from "../../types/worker";
import { useContext } from "react";
import { AuthContext } from "../context/AppContext";
import { useUserSettings } from "./useUserSettings";
import { useLocationStore } from "../../store/locationStore";

// -------------------
// Funciones de fetch
// -------------------
const fetchServiciosByCategory = async (categoria: string): Promise<Servicio[]> => {
  const { data, error } = await supabase
    .from("servicios")
    .select("*")
    .eq("categoria", categoria);

  if (error) throw new Error(error.message);
  return data || [];
};

const fetchServiciosCountByCategory = async () => {
  const { data, error } = await supabase.rpc("count_active_by_category");
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchServiciosCatgoryByRadius = async (
  categoria_filter: string,
  search_lat: number,
  search_lon: number,
  search_radius_meters: number,
) => {
  const { data, error } = await supabase.rpc("get_servicios_with_worker_status", {
    search_lat,
    search_lon,
    p_categoria: categoria_filter,
    search_radius_meters,
  });

  if (error) throw new Error(error.message);
  return data || [];
};

// -------------------
// Hook: servicios por categoría
// -------------------
export const useServicesByCategory = (categoria: string) => {
  const { location: authLocation } = useContext(AuthContext);
  const { settings } = useUserSettings();
  const queryClient = useQueryClient();

  // 🔹 Usa siempre la ciudad actual, ya sea custom o auth
  const currentCity = settings?.customLocation?.city ?? authLocation?.city ?? "";

  return useSuspenseQuery({
    queryKey: ["user", "services", categoria, currentCity],
    queryFn: async ({ client }) => {
      const locationParams = await buildLocationParams();

      const { data, error } = await supabase.rpc(
        "test_get_servicios_with_worker_status",
        { ...locationParams, p_categoria: categoria }
      );

      if (error) throw new Error(error.message);
      return data || [];
    },
    select: (data) => {
      const statusOrder: Record<string, number> = { ONLINE: 0, AWAY: 1, OFFLINE: 2 };
      return data.slice().sort((a, b) => {
        const aOrder = statusOrder[a.worker_status] ?? 99;
        const bOrder = statusOrder[b.worker_status] ?? 99;
        return aOrder - bOrder;
      });
    },
  });
};


// -------------------
// Hook: conteo de servicios
// -------------------
export const servicesCountQuerKey = ["user", "services", "count"];

export function useServicesCount() {
  const servicios = useSuspenseQuery({
    queryKey: servicesCountQuerKey,
    queryFn: async () => {
      const locationParams = await buildLocationParams();

      const { data, error } = await supabase.rpc(
        "count_services_by_status_in_radius",
        { ...locationParams }
      );

      if (error) throw error;
      return data;
    },
  });

  return { servicios };
}

// -------------------
// Función para limpiar cache
// -------------------
export function clearServicesCache(client: QueryClient) {
  client.invalidateQueries({ queryKey: ["user", "services"] });
}
