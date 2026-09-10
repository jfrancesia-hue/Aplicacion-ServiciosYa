import type { Database as DatabaseGenerated } from "./database.types";

export type Database = DatabaseGenerated;

export type UserUpdate = Database["public"]["Tables"]["usuarios"]["Update"];
export type NotificacionRow =
  Database["public"]["Tables"]["notificaciones"]["Row"];
export type ChatRow = Database["public"]["Tables"]["chats"]["Row"];
export type MensajeRow = Database["public"]["Tables"]["mensajes"]["Row"];
export type ServicioRow = Database["public"]["Tables"]["servicios"]["Row"];
