import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type IncidentCategory =
  | "provider_no_show"
  | "work_not_completed"
  | "other";

export type IncidentIntake = {
  occurred: string;
  contactAttempts: string;
  impact: string;
  evidence: string;
  requestedResolution: string;
};

type Props = {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (
    category: IncidentCategory,
    intake: IncidentIntake,
  ) => Promise<void>;
};

const categories: Array<{
  value: IncidentCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    value: "provider_no_show",
    label: "No se presentó",
    icon: "person-remove-outline",
  },
  {
    value: "work_not_completed",
    label: "No hizo o no terminó el trabajo",
    icon: "construct-outline",
  },
  {
    value: "other",
    label: "Ocurrió otro problema",
    icon: "help-circle-outline",
  },
];

const steps: Array<{
  key: keyof IncidentIntake;
  question: string;
  helper: string;
  placeholder: string;
}> = [
  {
    key: "occurred",
    question: "¿Qué ocurrió y cuándo?",
    helper: "Contame fecha aproximada, horario y el hecho principal.",
    placeholder: "Ej: el martes a las 10 era la visita acordada y no llegó...",
  },
  {
    key: "contactAttempts",
    question: "¿Intentaste comunicarte dentro del chat?",
    helper: "Indicá cuántas veces y si recibiste alguna respuesta.",
    placeholder: "Ej: escribí dos veces; leyó el mensaje pero no respondió...",
  },
  {
    key: "impact",
    question: "¿Qué impacto tuvo el problema?",
    helper: "Explicá qué quedó pendiente o qué consecuencia te generó.",
    placeholder: "Ej: la pérdida siguió activa y tuve que cerrar el agua...",
  },
  {
    key: "evidence",
    question: "¿Qué evidencia existe?",
    helper:
      "Podés mencionar mensajes, fotos o audios ya enviados. Si no hay, escribí “No tengo”.",
    placeholder: "Ej: hay fotos y mensajes en este chat...",
  },
  {
    key: "requestedResolution",
    question: "¿Qué solución esperás?",
    helper: "Esto orienta a Agustín; no genera un reembolso automático.",
    placeholder: "Ej: que revisen el caso y contacten al prestador...",
  },
];

const emptyIntake: IncidentIntake = {
  occurred: "",
  contactAttempts: "",
  impact: "",
  evidence: "",
  requestedResolution: "",
};

export default function MicaIncidentIntakeModal({
  visible,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const [category, setCategory] = useState<IncidentCategory | null>(null);
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<IncidentIntake>(emptyIntake);

  const reset = () => {
    setCategory(null);
    setStep(0);
    setIntake(emptyIntake);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const current = steps[step];
  const ready = current ? intake[current.key].trim().length >= 3 : false;
  const categoryLabel = useMemo(
    () => categories.find((item) => item.value === category)?.label,
    [category],
  );

  const submit = async () => {
    if (!category) return;
    await onSubmit(category, intake);
    reset();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
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
              <Text style={styles.eyebrow}>RECLAMO ASISTIDO</Text>
              <Text style={styles.title}>MICA reúne la información</Text>
              <Text style={styles.subtitle}>
                Después podrás revisar el resumen antes de derivarlo.
              </Text>
            </View>
            <TouchableOpacity
              disabled={submitting}
              onPress={close}
              style={styles.close}
            >
              <Ionicons name="close" size={21} color="#49666c" />
            </TouchableOpacity>
          </View>

          {!category ? (
            <View style={styles.categoryList}>
              <Text style={styles.question}>Primero, ¿qué pasó?</Text>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.categoryButton}
                  onPress={() => setCategory(item.value)}
                >
                  <View style={styles.categoryIcon}>
                    <Ionicons name={item.icon} size={18} color="#087d8d" />
                  </View>
                  <Text style={styles.categoryText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#8ba0a5" />
                </TouchableOpacity>
              ))}
              <Text style={styles.disclaimer}>
                Abrir un reclamo no cierra el trabajo ni ordena un reembolso
                automático.
              </Text>
            </View>
          ) : step < steps.length ? (
            <View style={styles.interview}>
              <View style={styles.progressRow}>
                {steps.map((item, index) => (
                  <View
                    key={item.key}
                    style={[
                      styles.progressSegment,
                      index <= step && styles.progressActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.categorySelected}>{categoryLabel}</Text>
              <Text style={styles.micaLabel}>MICA pregunta</Text>
              <Text style={styles.question}>{current.question}</Text>
              <Text style={styles.helper}>{current.helper}</Text>
              <TextInput
                autoFocus
                multiline
                maxLength={1000}
                editable={!submitting}
                value={intake[current.key]}
                onChangeText={(value) =>
                  setIntake((previous) => ({
                    ...previous,
                    [current.key]: value,
                  }))
                }
                placeholder={current.placeholder}
                placeholderTextColor="#8da0a4"
                style={styles.input}
              />
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    if (step === 0) setCategory(null);
                    else setStep((value) => value - 1);
                  }}
                >
                  <Text style={styles.backText}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!ready}
                  style={[styles.nextButton, !ready && styles.disabled]}
                  onPress={() => setStep((value) => value + 1)}
                >
                  <Text style={styles.nextText}>
                    {step === steps.length - 1
                      ? "Revisar resumen"
                      : "Continuar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.summaryScroll}
            >
              <Text style={styles.micaLabel}>RESUMEN DE MICA</Text>
              <Text style={styles.summaryTitle}>{categoryLabel}</Text>
              {steps.map((item) => (
                <View key={item.key} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{item.question}</Text>
                  <Text style={styles.summaryValue}>{intake[item.key]}</Text>
                </View>
              ))}
              <View style={styles.reviewNotice}>
                <Ionicons name="person-outline" size={17} color="#805116" />
                <Text style={styles.reviewNoticeText}>
                  Al confirmar, el caso se deriva a revisión humana en la
                  bandeja operativa de Agustín.
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setStep(steps.length - 1)}
                >
                  <Text style={styles.backText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={submitting}
                  style={[styles.submitButton, submitting && styles.disabled]}
                  onPress={submit}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.nextText}>Confirmar y derivar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(8,28,34,0.58)",
  },
  card: {
    backgroundColor: "#f9fdfd",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    maxHeight: "92%",
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#069eb3",
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: "#087d8d",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: { color: "#18383f", fontSize: 18, fontWeight: "900", marginTop: 2 },
  subtitle: { color: "#668087", fontSize: 11, lineHeight: 15, marginTop: 3 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e7f3f4",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryList: { marginTop: 16 },
  question: {
    color: "#24464e",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  categoryButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1e3e6",
    backgroundColor: "#fff",
    marginTop: 9,
  },
  categoryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#e6f6f7",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: { flex: 1, color: "#37575e", fontSize: 13, fontWeight: "800" },
  disclaimer: { color: "#7f6a4e", fontSize: 10, lineHeight: 15, marginTop: 13 },
  interview: { marginTop: 15 },
  progressRow: { flexDirection: "row", gap: 5, marginBottom: 12 },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d9e5e7",
  },
  progressActive: { backgroundColor: "#069eb3" },
  categorySelected: {
    alignSelf: "flex-start",
    color: "#087d8d",
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: "#e4f5f7",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 9,
  },
  micaLabel: {
    color: "#087d8d",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  helper: { color: "#687f85", fontSize: 11, lineHeight: 16, marginTop: 5 },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#c8dde1",
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 12,
    marginTop: 12,
    color: "#26464d",
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 9, marginTop: 15 },
  backButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1dfe2",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: "#60767b", fontSize: 12, fontWeight: "800" },
  nextButton: {
    flex: 1.5,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#069eb3",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    flex: 1.7,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#a95723",
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  summaryScroll: { marginTop: 15 },
  summaryTitle: {
    color: "#253f46",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 9,
  },
  summaryRow: {
    borderTopWidth: 1,
    borderTopColor: "#dfe9eb",
    paddingVertical: 9,
  },
  summaryLabel: { color: "#658087", fontSize: 10, fontWeight: "800" },
  summaryValue: {
    color: "#2d4a51",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  reviewNotice: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fff5e6",
    borderRadius: 12,
    padding: 10,
    marginTop: 7,
  },
  reviewNoticeText: { flex: 1, color: "#805116", fontSize: 10, lineHeight: 15 },
});
