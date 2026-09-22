import type { Database } from "./db.overrides.types";

type ServicioTableRow = Database["public"]["Tables"]["servicios"]["Row"];

export type Servicio = Omit<
  ServicioTableRow,
  "latitud" | "longitud" | "location" | "postal_code"
> &
  Partial<
    Pick<
      ServicioTableRow,
      "latitud" | "longitud" | "location" | "postal_code"
    >
  > & {
  nombre?: string | null;
  user_foto_perfil?: string | null;
  verificado?: boolean | null;
};
export type ServicioWithStatus =
  Database["public"]["Functions"]["get_servicios_with_worker_status"]["Returns"][number];

export type CategoriaQueryParams = {
  p_categoria: string | null;
};
