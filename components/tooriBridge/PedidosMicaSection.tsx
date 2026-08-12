import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import showToast from "../../lib/toast";
import {
  getPedidosDisponibles,
  isTooriBridgeConfigured,
} from "../../lib/tooriBridge";
import { respondToMicaOrder } from "../../lib/micaOrder";
import {
  buildQuotePricing,
  pricingModeLabel,
  type QuotePricingMode,
  type QuoteReferenceType,
} from "../../lib/utils/quotePricing";
import { getUserID } from "../../store/authStore";
import { QUOTE_OPERATIONAL_NOTICE_VERSION } from "../../lib/constants/billing";
import type { TooriBridgePedido } from "../../types/tooriBridge";
import QuoteOperationalNoticeModal from "../quotes/QuoteOperationalNoticeModal";

const colors = {
  primary: "#0e7b78",
  secondary: "#fe971a",
  muted: "#6B7280",
  border: "#E5E7EB",
  background: "#FFFFFF",
  soft: "#F0FDFA",
};

function normalizeOficios(values: Array<string | string[] | null | undefined>) {
  const flattened = values.flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );

  return Array.from(
    new Set(flattened.map((v) => String(v ?? "").trim()).filter(Boolean)),
  );
}

async function getBridgeWorkerContext() {
  const userId = getUserID();
  if (!userId) throw new Error("Usuario no disponible");

  const [{ data: perfil }, { data: servicios }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id,nombre,email,celular,categoria,ciudad,provincia")
      .eq("id", userId)
      .single(),
    supabase.from("servicios").select("categoria").eq("user_id", userId),
  ]);

  const oficios = normalizeOficios([
    perfil?.categoria,
    ...((servicios ?? []).map((s) => s.categoria) as Array<
      string | null | undefined
    >),
  ]);

  return {
    appUserId: userId,
    nombre: perfil?.nombre ?? "Prestador Servicios Ya",
    telefono: perfil?.celular ? String(perfil.celular) : "",
    ciudad: perfil?.ciudad ?? undefined,
    provincia: perfil?.provincia ?? undefined,
    oficios,
  };
}

async function getMicaAppFallbackPedidos(ctx: {
  appUserId: string;
  oficios: string[];
  ciudad?: string;
  provincia?: string;
}) {
  const { data, error } = await supabase.rpc(
    "get_mica_app_requests_for_worker",
    {
      p_app_user_id: ctx.appUserId,
      p_oficios: ctx.oficios,
      p_ciudad: ctx.ciudad ?? null,
      p_provincia: ctx.provincia ?? null,
      p_limit: 10,
    },
  );

  if (error) throw error;

  return (data ?? []).map((pedido) => ({
    id: pedido.id,
    categoria: pedido.categoria,
    zona: pedido.zona,
    descripcion: pedido.descripcion,
    estado: pedido.estado,
    paso: pedido.paso,
    createdAt: pedido.created_at,
    mediaUrl: pedido.media_url,
    videoUrls: pedido.video_urls,
    presupuestoEstimado: pedido.presupuesto_estimado,
    yaRespondio: pedido.ya_respondio,
  }));
}

export default function PedidosMicaSection() {
  const queryClient = useQueryClient();
  const [selectedPedido, setSelectedPedido] =
    useState<TooriBridgePedido | null>(null);
  const [modalidad, setModalidad] = useState<QuotePricingMode>("project");
  const [monto, setMonto] = useState("");
  const [unidades, setUnidades] = useState("1");
  const [tipoReferencia, setTipoReferencia] =
    useState<QuoteReferenceType>("estimate");
  const [horario, setHorario] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [materiales, setMateriales] = useState("A confirmar");
  const [garantia, setGarantia] = useState("7 días");
  const [validez, setValidez] = useState("24 horas");
  const [notas, setNotas] = useState("");
  const [quoteNoticeVisible, setQuoteNoticeVisible] = useState(false);
  const pricing = useMemo(
    () =>
      buildQuotePricing({
        pricingMode: modalidad,
        unitRate: Number(monto.replace(",", ".")),
        estimatedUnits: Number(unidades.replace(",", ".")),
        referenceType: tipoReferencia,
      }),
    [modalidad, monto, tipoReferencia, unidades],
  );

  const enabled = isTooriBridgeConfigured();

  const contextQuery = useQuery({
    queryKey: ["tooriBridge", "workerContext"],
    queryFn: getBridgeWorkerContext,
    enabled,
  });

  const pedidosQuery = useQuery({
    queryKey: [
      "tooriBridge",
      "pedidosDisponibles",
      contextQuery.data?.appUserId,
      contextQuery.data?.oficios,
      contextQuery.data?.ciudad,
      contextQuery.data?.provincia,
    ],
    queryFn: async () => {
      const ctx = contextQuery.data;
      if (!ctx) throw new Error("Prestador no disponible");
      if (ctx.oficios.length === 0) return [];

      let bridgePedidos: TooriBridgePedido[] = [];
      try {
        const response = await getPedidosDisponibles({
          appUserId: ctx.appUserId,
          telefono: ctx.telefono,
          oficios: ctx.oficios,
          ciudad: ctx.ciudad,
          provincia: ctx.provincia,
          limit: 10,
        });
        bridgePedidos = response.pedidos ?? [];
      } catch (error) {
        console.warn(
          "[MICA] puente web no disponible, usando fallback RPC:",
          error,
        );
      }

      const fallbackPedidos = await getMicaAppFallbackPedidos(ctx);
      const mergedPedidos = new Map<string, TooriBridgePedido>();

      for (const pedido of [...bridgePedidos, ...fallbackPedidos]) {
        mergedPedidos.set(String(pedido.id), pedido);
      }

      return Array.from(mergedPedidos.values());
    },
    enabled: enabled && Boolean(contextQuery.data),
  });

  const responderMutation = useMutation({
    mutationFn: async (accion: "presupuesto" | "no_disponible") => {
      const ctx = contextQuery.data;
      const pedido = selectedPedido;
      if (!ctx || !pedido) throw new Error("Pedido no seleccionado");

      if (accion === "presupuesto") {
        if (pricing.amount <= 0) {
          throw new Error("Ingresá un monto válido");
        }
        return respondToMicaOrder(String(pedido.id), {
          type: "budget",
          amount: pricing.amount,
          pricingMode: pricing.pricingMode,
          unitRate: pricing.unitRate,
          estimatedUnits: pricing.estimatedUnits,
          referenceType: pricing.referenceType,
          availability: horario,
          description:
            descripcion || "Presupuesto enviado desde la app Servicios Ya",
          materials: materiales,
          warranty: garantia,
          validUntil: validez,
          notes: notas,
          operationalNoticeVersion: QUOTE_OPERATIONAL_NOTICE_VERSION,
          operationalNoticeAcceptedAt: new Date().toISOString(),
        });
      }

      return respondToMicaOrder(String(pedido.id), {
        type: "decline",
      });
    },
    onSuccess: () => {
      setQuoteNoticeVisible(false);
      showToast.success("Listo", "Respuesta enviada al flujo Web/Mica.");
      setSelectedPedido(null);
      setModalidad("project");
      setMonto("");
      setUnidades("1");
      setTipoReferencia("estimate");
      setHorario("");
      setDescripcion("");
      setMateriales("A confirmar");
      setGarantia("7 días");
      setValidez("24 horas");
      setNotas("");
      queryClient.invalidateQueries({
        queryKey: ["tooriBridge", "pedidosDisponibles"],
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      showToast.error("No se pudo responder", message);
    },
  });

  const helperText = useMemo(() => {
    if (!enabled) return "Conexión Web/Mica pendiente de URL.";
    if (contextQuery.data?.oficios.length === 0)
      return "Publicá o cargá al menos un oficio para recibir pedidos compatibles.";
    return "Pedidos generados por MICA y coordinados desde el chat interno.";
  }, [enabled, contextQuery.data?.oficios.length]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.title}>Pedidos reales de Mica</Text>
          <Text style={styles.subtitle}>{helperText}</Text>
        </View>
        <Ionicons name="git-network-outline" size={24} color={colors.primary} />
      </View>

      {(contextQuery.isLoading || pedidosQuery.isLoading) && enabled ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>
            Buscando pedidos compatibles...
          </Text>
        </View>
      ) : null}

      {pedidosQuery.isError ? (
        <Text style={styles.errorText}>
          {(pedidosQuery.error as Error).message}
        </Text>
      ) : null}

      {!enabled ? (
        <View style={styles.statusBox}>
          <Ionicons name="warning-outline" size={18} color="#92400E" />
          <Text style={styles.statusText}>
            Falta configurar la URL del puente Web/Mica.
          </Text>
        </View>
      ) : pedidosQuery.data && pedidosQuery.data.length === 0 ? (
        <View style={styles.statusBox}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.statusText}>
            No hay pedidos compatibles por ahora. Cuando Mica genere uno,
            aparece acá.
          </Text>
        </View>
      ) : null}

      {(pedidosQuery.data ?? []).map((pedido) => (
        <View key={String(pedido.id)}>
          <TouchableOpacity
            style={[
              styles.pedidoCard,
              selectedPedido?.id === pedido.id && styles.pedidoCardSelected,
            ]}
            onPress={() => setSelectedPedido(pedido)}
            activeOpacity={0.85}
          >
            <View style={styles.pedidoTopRow}>
              <Text style={styles.pedidoCategoria}>
                {pedido.categoria || "Servicio"}
              </Text>
              {pedido.yaRespondio ? (
                <Text style={styles.badge}>Respondido</Text>
              ) : null}
            </View>
            <Text style={styles.pedidoZona}>
              {pedido.zona || "Zona sin especificar"}
            </Text>
            <Text style={styles.pedidoDescripcion} numberOfLines={3}>
              {pedido.descripcion || "Sin descripción"}
            </Text>
          </TouchableOpacity>

          {selectedPedido?.id === pedido.id ? (
            <View style={styles.replyBox}>
              <Text style={styles.replyTitle}>
                Responder pedido #{selectedPedido.id}
              </Text>
              <View style={styles.modeRow}>
                {(["project", "hour", "day"] as QuotePricingMode[]).map(
                  (mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.modeChip,
                        modalidad === mode && styles.modeChipActive,
                      ]}
                      onPress={() => setModalidad(mode)}
                    >
                      <Text
                        style={[
                          styles.modeText,
                          modalidad === mode && styles.modeTextActive,
                        ]}
                      >
                        {pricingModeLabel(mode)}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
              <TextInput
                value={monto}
                onChangeText={setMonto}
                keyboardType="numeric"
                placeholder={
                  modalidad === "project"
                    ? "Importe cerrado: ej. 25000"
                    : modalidad === "hour"
                      ? "Tarifa por hora"
                      : "Tarifa por día"
                }
                style={styles.input}
              />
              {modalidad !== "project" ? (
                <>
                  <TextInput
                    value={unidades}
                    onChangeText={setUnidades}
                    keyboardType="decimal-pad"
                    placeholder={
                      modalidad === "hour"
                        ? "Horas estimadas"
                        : "Días estimados"
                    }
                    style={styles.input}
                  />
                  <View style={styles.modeRow}>
                    {(["estimate", "cap"] as QuoteReferenceType[]).map(
                      (kind) => (
                        <TouchableOpacity
                          key={kind}
                          style={[
                            styles.modeChip,
                            tipoReferencia === kind && styles.modeChipActive,
                          ]}
                          onPress={() => setTipoReferencia(kind)}
                        >
                          <Text
                            style={[
                              styles.modeText,
                              tipoReferencia === kind && styles.modeTextActive,
                            ]}
                          >
                            {kind === "estimate"
                              ? "Total estimado"
                              : "Tope máximo"}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                </>
              ) : null}
              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Total de referencia</Text>
                <Text style={styles.totalValue}>
                  ${Math.round(pricing.amount).toLocaleString("es-AR")}
                </Text>
              </View>
              <TextInput
                value={horario}
                onChangeText={setHorario}
                placeholder="Disponibilidad: ej. hoy 18hs"
                style={styles.input}
              />
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Alcance: qué incluye el trabajo"
                style={[styles.input, styles.textArea]}
                multiline
              />
              <TextInput
                value={materiales}
                onChangeText={setMateriales}
                placeholder="Materiales incluidos o aparte"
                style={styles.input}
              />
              <View style={styles.compactFields}>
                <TextInput
                  value={garantia}
                  onChangeText={setGarantia}
                  placeholder="Garantía"
                  style={[styles.input, styles.compactInput]}
                />
                <TextInput
                  value={validez}
                  onChangeText={setValidez}
                  placeholder="Validez"
                  style={[styles.input, styles.compactInput]}
                />
              </View>
              <TextInput
                value={notas}
                onChangeText={setNotas}
                placeholder="Notas opcionales (sin datos de contacto)"
                style={styles.input}
              />
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.noButton]}
                  disabled={responderMutation.isPending}
                  onPress={() => responderMutation.mutate("no_disponible")}
                >
                  <Text style={styles.noButtonText}>No puedo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.sendButton]}
                  disabled={responderMutation.isPending}
                  onPress={() => {
                    if (pricing.amount <= 0) {
                      showToast.error(
                        "Monto inválido",
                        "Ingresá un monto válido.",
                      );
                      return;
                    }
                    setQuoteNoticeVisible(true);
                  }}
                >
                  <Text style={styles.sendButtonText}>
                    {responderMutation.isPending
                      ? "Enviando..."
                      : "Enviar presupuesto"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      ))}
      <QuoteOperationalNoticeModal
        visible={quoteNoticeVisible}
        mode="send"
        amount={pricing.amount}
        busy={responderMutation.isPending}
        onClose={() => setQuoteNoticeVisible(false)}
        onConfirm={() => responderMutation.mutate("presupuesto")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.background,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 4, maxWidth: 280 },
  loadingRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 10,
  },
  loadingText: { color: colors.muted },
  errorText: { color: "#B91C1C", marginVertical: 8 },
  emptyText: { color: colors.muted, marginVertical: 8 },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  statusText: { flex: 1, color: "#374151", fontSize: 13, lineHeight: 18 },
  pedidoCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pedidoCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.soft,
  },
  pedidoTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pedidoCategoria: { fontSize: 15, fontWeight: "800", color: colors.primary },
  badge: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
  },
  pedidoZona: { fontSize: 13, color: colors.muted, marginTop: 4 },
  pedidoDescripcion: {
    fontSize: 14,
    color: "#374151",
    marginTop: 6,
    lineHeight: 19,
  },
  replyBox: {
    backgroundColor: colors.soft,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  replyTitle: { fontWeight: "800", color: colors.primary, marginBottom: 8 },
  modeRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  modeChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  modeChipActive: { borderColor: colors.primary, backgroundColor: "#DDF7F4" },
  modeText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  modeTextActive: { color: colors.primary },
  totalBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#DDF7F4",
    marginBottom: 8,
  },
  totalLabel: { color: "#315e67", fontSize: 11, fontWeight: "800" },
  totalValue: { color: colors.primary, fontSize: 17, fontWeight: "900" },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  compactFields: { flexDirection: "row", gap: 8 },
  compactInput: { flex: 1 },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  noButton: { backgroundColor: "#F3F4F6" },
  noButtonText: { color: "#374151", fontWeight: "800" },
  sendButton: { backgroundColor: colors.secondary },
  sendButtonText: { color: "#FFFFFF", fontWeight: "900" },
});
