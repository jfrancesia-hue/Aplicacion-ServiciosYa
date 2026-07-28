import { Picker } from "@react-native-picker/picker";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  blockUser,
  reportProvider,
  REPORT_REASONS,
  type ReportReason,
} from "../../lib/utils/trustSafety";

type TrustSafetyModalProps = {
  visible: boolean;
  providerId: string;
  providerName?: string | null;
  serviceId?: number | null;
  onClose: () => void;
  onBlocked?: (providerId: string) => void;
};

export default function TrustSafetyModal({
  visible,
  providerId,
  providerName,
  serviceId,
  onClose,
  onBlocked,
}: TrustSafetyModalProps) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState<"report" | "block" | null>(
    null,
  );
  const displayName = useMemo(
    () => providerName?.trim() || "este perfil",
    [providerName],
  );

  const resetAndClose = () => {
    if (submitting) return;
    setReason("");
    setDetails("");
    onClose();
  };

  const handleReport = async () => {
    if (!reason) {
      Alert.alert("Elegí un motivo", "Indicá por qué querés reportar el perfil.");
      return;
    }
    if (reason === "other" && !details.trim()) {
      Alert.alert("Faltan detalles", "Contanos brevemente qué ocurrió.");
      return;
    }

    try {
      setSubmitting("report");
      await reportProvider({
        providerId,
        serviceId,
        reason,
        details,
      });
      setReason("");
      setDetails("");
      onClose();
      Alert.alert(
        "Reporte recibido",
        "Gracias. El equipo podrá revisar el perfil sin avisarle quién lo reportó.",
      );
    } catch (error) {
      Alert.alert(
        "No se pudo enviar",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setSubmitting(null);
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      `Bloquear a ${displayName}`,
      "Dejarás de ver este perfil y no podrán enviarse mensajes nuevos entre ambos. Podés desbloquearlo desde Configuración.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Bloquear",
          style: "destructive",
          onPress: async () => {
            try {
              setSubmitting("block");
              await blockUser(providerId);
              onBlocked?.(providerId);
              onClose();
              Alert.alert("Perfil bloqueado", "La conversación quedó protegida.");
            } catch (error) {
              Alert.alert(
                "No se pudo bloquear",
                error instanceof Error ? error.message : "Intentá nuevamente.",
              );
            } finally {
              setSubmitting(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={resetAndClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={24} color="#047a8f" />
          </View>
          <Text style={styles.title}>Seguridad del perfil</Text>
          <Text style={styles.subtitle}>
            Reportá información engañosa o bloqueá a {displayName}.
          </Text>

          <Text style={styles.label}>Motivo del reporte</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={reason}
              onValueChange={(value) => setReason(value as ReportReason | "")}
              enabled={!submitting}
            >
              <Picker.Item label="Seleccioná un motivo..." value="" />
              {REPORT_REASONS.map((item) => (
                <Picker.Item
                  key={item.value}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </Picker>
          </View>

          <TextInput
            editable={!submitting}
            multiline
            maxLength={800}
            onChangeText={setDetails}
            placeholder="Detalles opcionales"
            placeholderTextColor="#829296"
            style={styles.input}
            textAlignVertical="top"
            value={details}
          />

          <TouchableOpacity
            activeOpacity={0.8}
            disabled={Boolean(submitting)}
            onPress={handleReport}
            style={styles.reportButton}
          >
            {submitting === "report" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="flag-outline" size={18} color="#fff" />
                <Text style={styles.reportButtonText}>Enviar reporte</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            disabled={Boolean(submitting)}
            onPress={confirmBlock}
            style={styles.blockButton}
          >
            {submitting === "block" ? (
              <ActivityIndicator color="#b42318" />
            ) : (
              <>
                <Ionicons name="ban-outline" size={18} color="#b42318" />
                <Text style={styles.blockButtonText}>Bloquear perfil</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            disabled={Boolean(submitting)}
            onPress={resetAndClose}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(14, 34, 38, 0.58)",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 24,
    padding: 22,
    backgroundColor: "#fff",
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderRadius: 24,
    backgroundColor: "#e8f7f5",
  },
  title: {
    marginTop: 12,
    color: "#173f45",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 18,
    color: "#5b7074",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  label: {
    marginBottom: 6,
    color: "#174d54",
    fontSize: 13,
    fontWeight: "800",
  },
  pickerWrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#b9dadd",
    borderRadius: 13,
    backgroundColor: "#f8fcfc",
  },
  input: {
    minHeight: 88,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#b9dadd",
    borderRadius: 13,
    color: "#1e3438",
    backgroundColor: "#f8fcfc",
  },
  reportButton: {
    minHeight: 48,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 24,
    backgroundColor: "#047a8f",
  },
  reportButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  blockButton: {
    minHeight: 46,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#f4b7b3",
    borderRadius: 23,
    backgroundColor: "#fff5f4",
  },
  blockButtonText: {
    color: "#b42318",
    fontSize: 14,
    fontWeight: "800",
  },
  cancelButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  cancelText: {
    color: "#687b7f",
    fontSize: 14,
    fontWeight: "700",
  },
});
