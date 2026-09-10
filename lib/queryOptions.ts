import { queryOptions } from "@tanstack/react-query";
import { getUserID } from "../store/authStore";
import type { Coords } from "../types/location";
import { supabase } from "./supabase";

export const sessionQueryKey = ["session"];

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async () => {
    // Esta función se ejecuta una vez para obtener el estado inicial de la sesión.
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error al obtener sesión inicial:", error.message);
      throw error; // Dejar que TanStack Query maneje el estado de error
    }
    return data.session;
  },
  // Los datos de sesión son gestionados por el listener, por lo que no queremos que
  // se vuelvan obsoletos y se vuelvan a buscar automáticamente.
  staleTime: Number.POSITIVE_INFINITY,
  // Mantener los datos de sesión en caché indefinidamente.
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});

export const perfilQueryKey = ["user", "perfil"];

export const perfilQueryOptions = queryOptions({
  queryKey: perfilQueryKey,
  queryFn: async () => {
    const userId = getUserID();
    const { data, error } = await supabase
      .from("usuarios")
      .select(
        "id, email, nombre, celular, edad, dni, provincia, ciudad, barrio, foto_perfil, rol, verificado, creditos, categoria, matricula, descripcion, experiencia, horarios, perfil_completo, dni_verificado, suscriptor, referral_code",
      )
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }
    return data;
  },
});

export const notificationsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["user", "notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificaciones")
        .select("mensaje, leido")
        .eq("receptor_id", userId);

      if (error) {
        throw error;
      }
      return data;
    },
  });

export const categoriasQueryKey = ["categorias"];

export const categoriasQueryOptions = queryOptions({
  queryKey: categoriasQueryKey,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categorias")
      .select("id, nombre, icono_url");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 10 * 60 * 1000,
});

export const servicesCountQuerKey = ["user", "services", "count"];

export const serviciosCategoriaQueryOptions = (lat: number, lng: number) =>
  queryOptions({
    queryKey: servicesCountQuerKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "count_services_by_status_in_radius",
        {
          search_lat: lat,
          search_lon: lng,
          search_radius_meters: 10000, // 10 km
          p_categoria: null,
          worker_status_filter: null,
        },
      );

      if (error) {
        throw error;
      }
      return data;
    },
  });

export const workerStatusQueryOptions = queryOptions({
  queryKey: ["user", "worker", "status"],
  queryFn: async () => {
    const { data } = await supabase
      .from("workers")
      .select("status,last_seen_at,available_until,availability_duration_hours")
      .eq("user_id", getUserID())
      .maybeSingle();
    console.log(`Worker status: ${data?.status}`);
    return {
      status: data?.status ?? "OFFLINE",
      lastSeenAt: data?.last_seen_at ?? null,
      availableUntil: data?.available_until ?? null,
      durationHours: data?.availability_duration_hours ?? null,
    };
  },
});

export const locationIpInfoQueryOptions = queryOptions<Coords>({
  queryKey: ["user", "location", "api"],
  queryFn: async () => {
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
      province: data.region || null,
      locality: data.city || null,
      country: data.country_code || "N/A",
    };
  },

  staleTime: 120 * 1000,
});

export const userServiceCountQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["user", "services", "count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("servicios")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id);

      if (error) {
        throw error;
      }
      return count ?? 0;
    },
  });

export const userServiceListQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["user", "services", "list", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicios")
        .select("*")
        .eq("user_id", id);

      if (error) {
        throw error;
      }
      return data ?? [];
    },
  });

export const userCreditQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["user", "credit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("creditos")
        .eq("id", id)
        .single();

      if (error) {
        throw error;
      }
      return data?.creditos ?? 0;
    },
  });

export const misServicionQueryOptions = queryOptions({
  queryKey: ["user", "mis_servicios"],
  queryFn: async () => {
    const userId = getUserID();
    const { data } = await supabase
      .from("servicios_with_coords")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .throwOnError();
    return data;
  },
});
