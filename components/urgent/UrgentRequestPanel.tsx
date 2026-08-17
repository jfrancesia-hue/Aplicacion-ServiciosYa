import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";
import type { MainStackNavigationProp } from "../../types/navigation";

type InterestedProvider = {
  provider_id: string;
  name: string;
  photo_url?: string | null;
  verified?: boolean;
};

type UrgentRequest = {
  id: string;
  request_code: string;
  status:
    | "open"
    | "responded"
    | "matched"
    | "no_candidates"
    | "expired"
    | "cancelled";
  expires_at: string;
  providers?: InterestedProvider[];
};

type Props = {
  category: string;
  city?: string | null;
  province?: string | null;
  navigation: MainStackNavigationProp;
};

async function invokeUrgent(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("urgent-service", {
    body,
  });
  if (error || data?.error) {
    throw new Error(
      data?.error || error?.message || "No se pudo procesar el pedido.",
    );
  }
  return data;
}

export default function UrgentRequestPanel({
  category,
  city,
  province,
  navigation,
}: Props) {
  const [request, setRequest] = useState<UrgentRequest | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState("");
  const [urgencyWindow, setUrgencyWindow] = useState<"now" | "today">("now");
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await invokeUrgent({ action: "client-status", category });
      const current = (data?.request ?? null) as UrgentRequest | null;
      setRequest(
        current &&
          ["open", "responded", "no_candidates"].includes(current.status)
          ? current
          : null,
      );
    } catch {
      // La búsqueda normal sigue disponible si el estado urgente no carga.
    }
  }, [category]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!request || !["open", "responded"].includes(request.status)) return;
    const timer = setInterval(() => void loadStatus(), 8000);
    return () => clearInterval(timer);
  }, [loadStatus, request]);

  const createRequest = async () => {
    if (!city || !province) {
      Alert.alert(
        "Falta tu ubicación",
        "Necesitamos ciudad y provincia para avisar solamente a prestadores cercanos.",
      );
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert(
        "Contanos un poco más",
        "Escribí al menos 10 caracteres sobre lo que necesitás.",
      );
      return;
    }
    setLoading(true);
    try {
      const data = await invokeUrgent({
        action: "create",
        category,
        description: description.trim(),
        urgencyWindow,
        city,
        province,
      });
      setModalVisible(false);
      setDescription("");
      if (data?.request?.status === "no_candidates") {
        Alert.alert(
          "Sin disponibilidad inmediata",
          "No encontramos prestadores conectados en tu provincia. La búsqueda normal sigue disponible.",
        );
      }
      await loadStatus();
    } catch (error) {
      Alert.alert(
        "No se pudo crear",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async () => {
    if (!request) return;
    setLoading(true);
    try {
      await invokeUrgent({ action: "cancel", requestId: request.id });
      setRequest(null);
    } catch (error) {
      Alert.alert(
        "No se pudo cancelar",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectProvider = async (provider: InterestedProvider) => {
    if (!request) return;
    setLoading(true);
    try {
      const data = await invokeUrgent({
        action: "select-provider",
        requestId: request.id,
        providerId: provider.provider_id,
      });
      const match = data?.match;
      if (!match?.chatId) throw new Error("No se pudo abrir el chat.");
      setRequest(null);
      navigation.navigate("ChatIndividual", {
        chatId: match.chatId,
        nombre: match.providerName || provider.name || "Prestador",
        servicio: {},
        servicioId: "",
        usuarioId1: match.participantA,
        usuarioId2: match.participantB,
      });
    } catch (error) {
      Alert.alert(
        "No se pudo conectar",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  if (request) {
    const providers = request.providers ?? [];
    return (
      <View style={styles.activeCard}>
        <View style={styles.titleRow}>
          <MaterialIcons name="bolt" size={21} color="#b45309" />
          <View style={styles.copy}>
            <Text style={styles.activeTitle}>
              Pedido urgente {request.request_code}
            </Text>
            <Text style={styles.activeText}>
              {request.status === "no_candidates"
                ? "No hubo prestadores conectados en tu zona."
                : providers.length > 0
                  ? "Elegí con quién querés abrir el chat."
                  : "Avisamos hasta a 3 prestadores disponibles. Esperando respuestas…"}
            </Text>
          </View>
          {loading ? <ActivityIndicator color="#b45309" /> : null}
        </View>
        {providers.map((provider) => (
          <View key={provider.provider_id} style={styles.providerRow}>
            {provider.photo_url ? (
              <Image
                source={{ uri: provider.photo_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <MaterialIcons name="person" size={19} color="#047a8f" />
              </View>
            )}
            <View style={styles.copy}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <Text style={styles.providerMeta}>
                {provider.verified
                  ? "Identidad verificada"
                  : "Perfil sin verificación de identidad"}
              </Text>
            </View>
            <TouchableOpacity
              disabled={loading}
              onPress={() => void selectProvider(provider)}
              style={styles.chooseButton}
            >
              <Text style={styles.chooseButtonText}>Elegir</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          disabled={loading}
          onPress={() => void loadStatus()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Actualizar respuestas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={loading}
          onPress={() => void cancelRequest()}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancelar pedido urgente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.84}
        disabled={!city || !province}
        onPress={() => setModalVisible(true)}
        style={[styles.cta, (!city || !province) && styles.ctaDisabled]}
      >
        <View style={styles.ctaIcon}>
          <MaterialIcons name="bolt" size={23} color="#fff" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.ctaTitle}>¿Lo necesitás para hoy?</Text>
          <Text style={styles.ctaText}>
            {city && province
              ? "Avisar a prestadores conectados de tu zona"
              : "Completá o habilitá tu ubicación para usar urgencias"}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#fff" />
      </TouchableOpacity>
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.titleRow}>
              <View style={styles.modalIcon}>
                <MaterialIcons name="bolt" size={24} color="#fff" />
              </View>
              <View style={styles.copy}>
                <Text style={styles.modalTitle}>
                  Buscar disponibilidad urgente
                </Text>
                <Text style={styles.modalSubtitle}>
                  {category} · {city}, {province}
                </Text>
              </View>
            </View>
            <Text style={styles.label}>¿Qué necesitás?</Text>
            <TextInput
              multiline
              maxLength={600}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej.: pierdo agua debajo de la pileta y necesito una visita hoy"
              placeholderTextColor="#82979b"
              style={styles.input}
            />
            <Text style={styles.label}>Momento</Text>
            <View style={styles.windowRow}>
              {(["now", "today"] as const).map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setUrgencyWindow(value)}
                  style={[
                    styles.windowButton,
                    urgencyWindow === value && styles.windowButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.windowText,
                      urgencyWindow === value && styles.windowTextActive,
                    ]}
                  >
                    {value === "now" ? "Lo antes posible" : "Durante el día"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.notice}>
              <MaterialIcons name="info-outline" size={19} color="#8a5a00" />
              <Text style={styles.noticeText}>
                Se avisará como máximo a 3 prestadores conectados. No se cobra
                por buscar; si elegís uno, conversan y presupuestan dentro del
                chat. Para emergencias con riesgo, llamá al 911 o al servicio
                local correspondiente.
              </Text>
            </View>
            <TouchableOpacity
              disabled={loading}
              onPress={() => void createRequest()}
              style={styles.primaryButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Avisar a prestadores disponibles
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              disabled={loading}
              onPress={() => setModalVisible(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#d97706",
    borderRadius: 17,
    padding: 14,
    marginBottom: 14,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  ctaTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  ctaText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  activeCard: {
    backgroundColor: "#fff7e8",
    borderColor: "#f0b34f",
    borderWidth: 1,
    borderRadius: 17,
    padding: 14,
    marginBottom: 14,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  activeTitle: { color: "#7c4300", fontSize: 15, fontWeight: "900" },
  activeText: { color: "#7a5a2b", fontSize: 12, lineHeight: 17, marginTop: 3 },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingTop: 12,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#efd7ae",
  },
  avatar: { width: 39, height: 39, borderRadius: 20 },
  avatarFallback: {
    width: 39,
    height: 39,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e3f4f6",
  },
  providerName: { color: "#263d42", fontSize: 13, fontWeight: "800" },
  providerMeta: { color: "#6f8083", fontSize: 10, marginTop: 2 },
  chooseButton: {
    backgroundColor: "#047a8f",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chooseButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 9,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  secondaryButtonText: { color: "#047a8f", fontSize: 12, fontWeight: "800" },
  cancelButton: { alignItems: "center", paddingVertical: 11, marginTop: 5 },
  cancelText: { color: "#7a6a57", fontSize: 13, fontWeight: "700" },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    padding: 22,
    paddingBottom: 32,
  },
  modalIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d97706",
  },
  modalTitle: { color: "#263d42", fontSize: 18, fontWeight: "900" },
  modalSubtitle: { color: "#6f8083", fontSize: 12, marginTop: 3 },
  label: {
    color: "#35545a",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 17,
    marginBottom: 6,
  },
  input: {
    minHeight: 92,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#bddde1",
    backgroundColor: "#f3f9f9",
    color: "#213b40",
    textAlignVertical: "top",
  },
  windowRow: { flexDirection: "row", gap: 8 },
  windowButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#bddde1",
  },
  windowButtonActive: { backgroundColor: "#e9f7f8", borderColor: "#069eb3" },
  windowText: { color: "#687d81", fontSize: 12, fontWeight: "700" },
  windowTextActive: { color: "#047a8f" },
  notice: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    padding: 11,
    borderRadius: 12,
    backgroundColor: "#fff7df",
  },
  noticeText: { flex: 1, color: "#73531b", fontSize: 11, lineHeight: 16 },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#d97706",
    marginTop: 17,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
