import type { Database } from "./db.overrides.types";

export type Servicio = Database["public"]["Tables"]["servicios"]["Row"] & {
  nombre?: string | null;
  user_foto_perfil?: string | null;
  verificado?: boolean | null;
};
export type ServicioWithStatus =
  Database["public"]["Functions"]["get_servicios_with_worker_status"]["Returns"][number];

export type CategoriaQueryParams = {
  p_categoria: string | null;
};
