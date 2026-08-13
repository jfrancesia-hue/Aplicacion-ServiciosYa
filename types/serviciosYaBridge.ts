export type ServiciosYaBridgePedido = {
  id: number | string;
  categoria: string;
  zona: string;
  descripcion: string;
  estado: string;
  paso: number;
  createdAt?: string | null;
  mediaUrl?: string | null;
  videoUrls?: string[] | string | null;
  presupuestoEstimado?: number | string | null;
  yaRespondio?: boolean;
};

export type ServiciosYaBridgePedidoResponse = {
  ok: boolean;
  count: number;
  pedidos: ServiciosYaBridgePedido[];
  error?: string;
};

export type ServiciosYaBridgeSyncPrestadorPayload = {
  appUserId: string;
  nombre: string;
  telefono: string;
  email?: string;
  oficios: string[];
  ciudad?: string;
  provincia?: string;
  barrio?: string;
  verificado?: boolean;
};

export type ServiciosYaBridgeResponderPedidoPayload = {
  ofertaId: number | string;
  appUserId: string;
  nombre?: string;
  telefono?: string;
  accion: "presupuesto" | "no_disponible" | "no";
  monto?: number;
  horariosDisponibles?: string;
  descripcion?: string;
};

export type ServiciosYaBridgeResponse<T = unknown> = {
  ok: boolean;
  error?: string;
} & T;
