import type { MergeDeep } from "type-fest";
import type { Database as DatabaseGenerated, Json } from "./database.types";
import type { LocationParams } from "./location";
import type { CategoriaQueryParams } from "./servicios";
import type { WorkerStatusQueryParams } from "./worker";

type ChatRowOverride = {
  acceso_contratado: boolean | null;
  borrado_por_usuario_1: string | null;
  borrado_por_usuario_2: string | null;
  contratado_id: string | null;
  contratante_id: string | null;
  creado_en: string | null;
  es_ia: boolean | null;
  id: string;
  participant_a: string | null;
  participant_b: string | null;
  participantes: string[] | null;
  servicio_id: string | null;
  updated_at: string | null;
  usuario_1: string | null;
  usuario_2: string | null;
};

type ChatInsertOverride = Partial<ChatRowOverride> & {
  id?: string;
  participant_a?: string | null;
  participant_b?: string | null;
};

type NuevaOfertaRow = {
  id: number;
  created_at: string | null;
  cliente_telefono: string | null;
  nombre_cliente: string | null;
  categoria: string | null;
  descripcion: string | null;
  zona: string | null;
  estado: string | null;
  paso: number | null;
  media_url: string | null;
  video_urls: string | null;
  media_descripcion: string | null;
  historial_conversacion: string | null;
  app_cliente_id: string | null;
  app_chat_id: string | null;
  ciudad: string | null;
  provincia: string | null;
  modo_agente: boolean | null;
  source: string;
  metadata: Json;
  updated_at: string | null;
  presupuesto_seleccionado_id: number | null;
};

type PresupuestoRow = {
  id: number;
  created_at: string | null;
  oferta_id: number | null;
  trabajador_id?: number | null;
  trabajador_uuid: string | null;
  monto: number | null;
  descripcion: string | null;
  horarios_disponibles: string | null;
  estado: string | null;
  metadata: Json;
  pricing_mode: "project" | "hour" | "day";
  unit_rate: number | null;
  estimated_units: number | null;
  reference_total_type: "fixed" | "estimate" | "cap";
};

type UsuarioRowOverride = Omit<
  DatabaseGenerated["public"]["Tables"]["usuarios"]["Row"],
  "celular" | "categoria"
> & {
  barrio: string | null;
  celular: string | null;
  categoria: string[] | string | null;
  verificado: boolean | null;
  matricula: Json | string | null;
  antecedentes: Json | string | null;
  antiguedad: number | null;
  perfilPublico: boolean | null;
};

type UsuarioInsertOverride = Omit<
  DatabaseGenerated["public"]["Tables"]["usuarios"]["Insert"],
  "celular" | "categoria"
> & {
  barrio?: string | null;
  celular?: string | null;
  categoria?: string[] | string | null;
  verificado?: boolean | null;
  matricula?: Json | string | null;
  antecedentes?: Json | string | null;
  antiguedad?: number | null;
  perfilPublico?: boolean | null;
};

type MensajeRowOverride = DatabaseGenerated["public"]["Tables"]["mensajes"]["Row"] & {
  created_at: string | null;
};

type MensajeInsertOverride = DatabaseGenerated["public"]["Tables"]["mensajes"]["Insert"] & {
  created_at?: string | null;
};

type UrgentWorkAlertRow = {
  id: string;
  created_at: string;
  updated_at: string;
  source: "service_request" | "direct_contact" | "chat_message";
  status: "pending" | "accepted" | "cancelled" | "escalation_ready";
  worker_id: string;
  cliente_id: string | null;
  servicio_id: string | null;
  chat_id: string | null;
  notificacion_id: string | null;
  category: string | null;
  title: string;
  body: string;
  attempts_sent: number;
  next_attempt_at: string;
  last_sent_at: string | null;
  escalation_ready_at: string | null;
  metadata: Json;
};

type WorkerRowOverride =
  DatabaseGenerated["public"]["Tables"]["workers"]["Row"] & {
    available_until: string | null;
    availability_duration_hours: number | null;
  };

type UserBlockRow = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

type ProfileReportRow = {
  id: string;
  reporter_id: string;
  provider_id: string;
  service_id: number | null;
  reason_category: string;
  details: string | null;
  status: string;
  created_at: string;
};

type MarketplaceEventRow = {
  id: number;
  user_id: string;
  event_name: string;
  province: string | null;
  city: string | null;
  category: string | null;
  context: Json;
  created_at: string;
};

type ServiceJobReviewRow = {
  id: string;
  payment_record_id: string;
  chat_id: string;
  reviewer_id: string;
  provider_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceJobIncidentRow = {
  id: string;
  case_number: string;
  payment_record_id: string;
  chat_id: string;
  reporter_id: string;
  provider_id: string;
  category: "provider_no_show" | "work_not_completed" | "other";
  details: string | null;
  mica_summary: string | null;
  status: "mica_intake" | "escalated" | "reviewing" | "resolved" | "dismissed";
  assigned_to: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type Database = MergeDeep<
  DatabaseGenerated,
  {
    public: {
      Tables: {
        chats: {
          Row: ChatRowOverride;
          Insert: ChatInsertOverride;
          Update: Partial<ChatRowOverride>;
        };
        mensajes: {
          Row: MensajeRowOverride;
          Insert: MensajeInsertOverride;
          Update: Partial<MensajeRowOverride>;
        };
        usuarios: {
          Row: UsuarioRowOverride;
          Insert: UsuarioInsertOverride;
          Update: Partial<UsuarioRowOverride>;
        };
        nuevaOferta: {
          Row: NuevaOfertaRow;
          Insert: Partial<NuevaOfertaRow>;
          Update: Partial<NuevaOfertaRow>;
          Relationships: [];
        };
        presupuestos: {
          Row: PresupuestoRow;
          Insert: Partial<PresupuestoRow>;
          Update: Partial<PresupuestoRow>;
          Relationships: [];
        };
        urgent_work_alerts: {
          Row: UrgentWorkAlertRow;
          Insert: Partial<UrgentWorkAlertRow> & {
            source: UrgentWorkAlertRow["source"];
            worker_id: string;
            body: string;
          };
          Update: Partial<UrgentWorkAlertRow>;
          Relationships: [];
        };
        workers: {
          Row: WorkerRowOverride;
          Insert: Partial<WorkerRowOverride> & { user_id: string };
          Update: Partial<WorkerRowOverride>;
          Relationships: [];
        };
        user_blocks: {
          Row: UserBlockRow;
          Insert: Partial<UserBlockRow> & {
            blocker_id: string;
            blocked_id: string;
          };
          Update: Partial<UserBlockRow>;
          Relationships: [];
        };
        profile_reports: {
          Row: ProfileReportRow;
          Insert: Partial<ProfileReportRow> & {
            reporter_id: string;
            provider_id: string;
            reason_category: string;
          };
          Update: Partial<ProfileReportRow>;
          Relationships: [];
        };
        marketplace_events: {
          Row: MarketplaceEventRow;
          Insert: Partial<MarketplaceEventRow> & {
            user_id: string;
            event_name: string;
          };
          Update: Partial<MarketplaceEventRow>;
          Relationships: [];
        };
        service_job_reviews: {
          Row: ServiceJobReviewRow;
          Insert: Partial<ServiceJobReviewRow> & {
            payment_record_id: string;
            chat_id: string;
            reviewer_id: string;
            provider_id: string;
            rating: number;
          };
          Update: Partial<ServiceJobReviewRow>;
          Relationships: [];
        };
        service_job_incidents: {
          Row: ServiceJobIncidentRow;
          Insert: Partial<ServiceJobIncidentRow> & {
            case_number: string;
            payment_record_id: string;
            chat_id: string;
            reporter_id: string;
            provider_id: string;
            category: ServiceJobIncidentRow["category"];
          };
          Update: Partial<ServiceJobIncidentRow>;
          Relationships: [];
        };
      };
      Functions: {
        track_marketplace_event: {
          Args: {
            p_event_name: string;
            p_context?: Json;
          };
          Returns: number;
        };
        get_chat_job_status: {
          Args: {
            p_chat_id: string;
          };
          Returns: Json;
        };
        submit_service_job_review: {
          Args: {
            p_payment_record_id: string;
            p_rating: number;
            p_comment?: string | null;
          };
          Returns: Json;
        };
        create_mica_app_request: {
          Args: {
            p_categoria: string;
            p_descripcion: string;
            p_zona: string;
            p_nombre_cliente?: string | null;
            p_cliente_telefono?: string | null;
            p_ciudad?: string | null;
            p_provincia?: string | null;
            p_historial?: Json;
            p_metadata?: Json;
          };
          Returns: {
            ok: boolean;
            oferta_id: string;
          }[];
        };
        create_manual_service_request: {
          Args: {
            p_categoria: string;
            p_descripcion: string;
            p_zona: string;
            p_ciudad?: string | null;
            p_provincia?: string | null;
            p_urgencia?: "normal" | "pronto" | "urgente";
            p_responsable_herramientas?: "cliente" | "prestador" | "a_coordinar";
            p_cantidad_personas?: number;
            p_modalidad_preferida?: "a_coordinar" | "proyecto" | "hora" | "dia";
          };
          Returns: {
            ok: boolean;
            oferta_id: string;
          }[];
        };
        get_my_service_requests: {
          Args: { p_limit?: number };
          Returns: {
            id: string;
            categoria: string;
            zona: string;
            descripcion: string;
            estado: string;
            paso: number;
            source: string;
            metadata: Json;
            created_at: string;
            response_count: number;
            selected_budget_id: string | null;
            chat_id: string | null;
          }[];
        };
        cancel_service_request: {
          Args: { p_oferta_id: string };
          Returns: Json;
        };
        get_chat_schedule: {
          Args: { p_chat_id: string };
          Returns: Json;
        };
        propose_service_schedule: {
          Args: {
            p_payment_record_id: string;
            p_slots: Json;
            p_reason?: "initial" | "reschedule";
          };
          Returns: Json;
        };
        select_service_schedule_slot: {
          Args: {
            p_proposal_id: string;
            p_slot_id: string;
          };
          Returns: Json;
        };
        get_provider_contact_access: {
          Args: {
            p_cliente_id?: string | null;
            p_trabajador_id?: string | null;
            p_presupuesto_id?: number | null;
            p_oferta_id?: string | null;
            p_provincia?: string | null;
            p_ciudad?: string | null;
          };
          Returns: {
            can_view: boolean;
            reason: string;
            unlock_id: string | null;
            requires_payment: boolean;
          }[];
        };
        get_mica_app_requests_for_worker: {
          Args: {
            p_app_user_id: string;
            p_oficios: string[];
            p_ciudad?: string | null;
            p_provincia?: string | null;
            p_limit?: number;
          };
          Returns: {
            id: string;
            categoria: string;
            zona: string;
            descripcion: string;
            estado: string;
            paso: number;
            created_at: string | null;
            media_url: string | null;
            video_urls: string | null;
            presupuesto_estimado: number | null;
            ya_respondio: boolean;
            source: string;
            metadata: Json;
          }[];
        };
        get_servicios_with_online_workers: {
          Args: LocationParams;
        };
        get_servicios_with_worker_status: {
          Args: LocationParams & CategoriaQueryParams;
        };
        test_get_servicios_with_worker_status: {
          Args: LocationParams & CategoriaQueryParams;
        };
        count_services_by_status_in_radius: {
          Args: LocationParams & CategoriaQueryParams & WorkerStatusQueryParams;
        };
      };
    };
  }
>;

export type UserUpdate = Database["public"]["Tables"]["usuarios"]["Update"];
export type NotificacionRow = Database["public"]["Tables"]["notificaciones"]["Row"];
export type ChatRow = Database["public"]["Tables"]["chats"]["Row"];
export type MensajeRow = Database["public"]["Tables"]["mensajes"]["Row"];
export type ServicioRow = Database["public"]["Tables"]["servicios"]["Row"];
