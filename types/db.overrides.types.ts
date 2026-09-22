import type { Database as DatabaseGenerated, Json } from "./database.types";

type ServicioBaseRow =
  DatabaseGenerated["public"]["Tables"]["servicios"]["Row"];

type ServicioPublicRow = Omit<
  ServicioBaseRow,
  "latitud" | "longitud" | "location" | "postal_code"
>;

type MyServiceWithCoordsRow = Omit<
  ServicioBaseRow,
  "latitud" | "longitud" | "location"
> & {
  latitude: number | null;
  longitude: number | null;
};

export type Database = Omit<DatabaseGenerated, "public"> & {
  public: Omit<DatabaseGenerated["public"], "Views" | "Functions"> & {
    Views: DatabaseGenerated["public"]["Views"] & {
      servicios_public: {
        Row: ServicioPublicRow;
        Relationships: [];
      };
    };
    Functions: DatabaseGenerated["public"]["Functions"] & {
      create_manual_service_request_v2: {
        Args: {
          p_categoria: string;
          p_descripcion: string;
          p_zona: string;
          p_latitude: number;
          p_longitude: number;
          p_ciudad?: string;
          p_provincia?: string;
          p_urgencia?: string;
          p_responsable_herramientas?: string;
          p_cantidad_personas?: number;
          p_modalidad_preferida?: string;
        };
        Returns: { ok: boolean; oferta_id: string }[];
      };
      create_mica_app_request_v2: {
        Args: {
          p_categoria: string;
          p_descripcion: string;
          p_zona: string;
          p_latitude: number;
          p_longitude: number;
          p_nombre_cliente?: string;
          p_cliente_telefono?: string;
          p_ciudad?: string;
          p_provincia?: string;
          p_historial?: Json;
          p_metadata?: Json;
        };
        Returns: { ok: boolean; oferta_id: string }[];
      };
      confirm_my_service_request_location: {
        Args: {
          p_offer_id: number;
          p_city: string;
          p_province: string;
          p_latitude: number;
          p_longitude: number;
          p_zone?: string | null;
        };
        Returns: boolean;
      };
      get_my_services_with_coords: {
        Args: Record<PropertyKey, never>;
        Returns: MyServiceWithCoordsRow[];
      };
    };
  };
};

export type UserUpdate = Database["public"]["Tables"]["usuarios"]["Update"];
export type NotificacionRow =
  Database["public"]["Tables"]["notificaciones"]["Row"];
export type ChatRow = Database["public"]["Tables"]["chats"]["Row"];
export type MensajeRow = Database["public"]["Tables"]["mensajes"]["Row"];
export type ServicioRow = Database["public"]["Tables"]["servicios"]["Row"];
