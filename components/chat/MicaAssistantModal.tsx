import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  loading: boolean;
  hasUntranscribedAudio: boolean;
  onClose: () => void;
  onAsk: (question: string) => Promise<void> | void;
};

const QUICK_ACTIONS = [
  {
    label: "Resumir lo acordado",
    icon: "reader-outline" as const,
    prompt:
      "Resumí lo acordado hasta ahora y separá claramente precio, alcance, materiales, fecha y pendientes.",
  },
  {
    label: "Sugerir próximo paso",
    icon: "navigate-outline" as const,
    prompt:
      "Indicá el próximo paso más útil para que cliente y prestador puedan avanzar dentro de la app.",
  },
  {
    label: "Revisar presupuesto",
    icon: "receipt-outline" as const,
    prompt:
      "Revisá si el presupuesto y el alcance están claros. Señalá únicamente datos que falten confirmar.",
  },
];

export default function MicaAssistantModal({
  visible,
  loading,
  hasUntranscribedAudio,
  onClose,
  onAsk,
}: Props) {
  const [question, setQuestion] = useState("");

  const submit = async (value: string) => {
    const clean = value.trim();
    if (!clean || loading) return;
    await onAsk(clean);
    setQuestion("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>ASISTENCIA DENTRO DEL CHAT</Text>
              <Text style={styles.title}>Pedir ayuda a MICA</Text>
              <Text style={styles.subtitle}>
                Su respuesta será visible para ambas partes.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Cerrar asistencia de MICA"
              disabled={loading}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={21} color="#405c62" />
            </TouchableOpacity>
          </View>

          {hasUntranscribedAudio ? (
            <View style={styles.audioNotice}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color="#9b5b10"
              />
              <Text style={styles.audioNoticeText}>
                Hay audios sin transcripción. MICA intentará procesarlos; si no
                puede, te pedirá el dato por escrito.
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                activeOpacity={0.78}
                disabled={loading}
                onPress={() => submit(action.prompt)}
                style={styles.actionButton}
              >
                <Ionicons name={action.icon} size={18} color="#087989" />
                <Text style={styles.actionText}>{action.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#729096" />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>O hacé una pregunta específica</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Ej: ¿qué falta definir antes de confirmar?"
              placeholderTextColor="#82969a"
              multiline
              editable={!loading}
              style={styles.input}
            />
            <TouchableOpacity
              accessibilityLabel="Enviar pregunta a MICA"
              disabled={!question.trim() || loading}
              onPress={() => submit(question)}
              style={[
                styles.sendButton,
                (!question.trim() || loading) && styles.sendButtonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            MICA puede resumir y orientar, pero no confirma pagos ni modifica
            acuerdos sin una acción explícita de las personas.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
    backgroundColor: "rgba(6,35,40,0.48)",
  },
  card: {
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
    borderRadius: 26,
    backgroundColor: "#f8fdfc",
    borderWidth: 1,
    borderColor: "#bce7e1",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#069eb3",
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: "#087989",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 2,
    color: "#18373e",
    fontSize: 19,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 3,
    color: "#60777c",
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e7f4f2",
  },
  audioNotice: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#fff5e6",
    borderWidth: 1,
    borderColor: "#f1d09f",
  },
  audioNoticeText: {
    flex: 1,
    color: "#754715",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  actions: {
    marginTop: 14,
    gap: 8,
  },
  actionButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: "#eaf8f6",
    borderWidth: 1,
    borderColor: "#c5e9e4",
  },
  actionText: {
    flex: 1,
    color: "#264a51",
    fontSize: 13,
    fontWeight: "800",
  },
  inputLabel: {
    marginTop: 16,
    marginBottom: 7,
    color: "#37565c",
    fontSize: 11,
    fontWeight: "800",
  },
  inputRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 6,
    paddingLeft: 12,
    borderRadius: 17,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#b9deda",
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    paddingVertical: 8,
    color: "#203f45",
    fontSize: 13,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#069eb3",
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  disclaimer: {
    marginTop: 12,
    color: "#71868a",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
});
