import React, { useCallback, useRef, useEffect, memo } from "react";
import CustomTextInput from "../inputs/CustomTextInput";
import { TouchableOpacity, View, StyleSheet, Text, Modal, TextInput, KeyboardAvoidingView, Platform, Animated, ScrollView, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Audio } from "expo-av";
import { createQuoteMessage } from "../../lib/utils/quoteMessage";
import {
  CHAT_AUDIO_MAX_SECONDS,
  formatAudioDuration,
} from "../../lib/utils/audioMessage";

interface ChatInputBarProps {
  onSend: (message: string) => void | Promise<void>;
  onSendAudio: (audio: {
    uri: string;
    durationMs: number;
    mimeType: string;
  }) => void | Promise<void>;
  serviceId?: string;
}

function ChatInputBar({ onSend, onSendAudio }: ChatInputBarProps) {
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendingAudio, setSendingAudio] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const [presupuestoVisible, setPresupuestoVisible] = React.useState(false);
  const [monto, setMonto] = React.useState("");
  const [alcance, setAlcance] = React.useState("");
  const [materiales, setMateriales] = React.useState("Materiales incluidos");
  const [tiempo, setTiempo] = React.useState("A coordinar");
  const [garantia, setGarantia] = React.useState("7 dias");
  const [validez, setValidez] = React.useState("24 horas");
  const [notas, setNotas] = React.useState("");
  const [enviandoPresupuesto, setEnviandoPresupuesto] = React.useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef(0);

  const stopRecording = useCallback(async (cancelled = false) => {
    const activeRecording = recordingRef.current;
    if (!activeRecording) return;

    recordingRef.current = null;
    setIsRecording(false);

    try {
      const status = await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      const durationMs =
        status.durationMillis ?? Date.now() - recordingStartedAtRef.current;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      if (cancelled) return;
      if (!uri || durationMs < 700) {
        Alert.alert(
          "Audio muy corto",
          "Mantené la grabación al menos un segundo antes de enviarla.",
        );
        return;
      }

      setSendingAudio(true);
      await onSendAudio({
        uri,
        durationMs,
        mimeType: "audio/mp4",
      });
    } catch (error) {
      if (!cancelled) {
        Alert.alert(
          "No se pudo enviar el audio",
          error instanceof Error ? error.message : "Intentá nuevamente.",
        );
      }
    } finally {
      setSendingAudio(false);
      setRecordingSeconds(0);
    }
  }, [onSendAudio]);

  const startRecording = useCallback(async () => {
    if (sendingAudio || recordingRef.current) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permiso de micrófono",
          "Necesitamos acceso al micrófono para enviar mensajes de voz.",
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (error) {
      Alert.alert(
        "No se pudo grabar",
        error instanceof Error ? error.message : "Revisá el permiso del micrófono.",
      );
    }
  }, [sendingAudio]);

  useEffect(() => {
    // Pulso suave de escala
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.025, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
    // Efecto shimmer de izquierda a derecha
    Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 2, duration: 2000, delay: 600, useNativeDriver: true })
    ).start();
  }, []);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - recordingStartedAtRef.current) / 1000,
      );
      setRecordingSeconds(elapsed);
      if (elapsed >= CHAT_AUDIO_MAX_SECONDS) {
        clearInterval(interval);
        stopRecording(false);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRecording, stopRecording]);

  useEffect(
    () => () => {
      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      activeRecording?.stopAndUnloadAsync().catch(() => undefined);
    },
    [],
  );

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    if (/\d/.test(message)) {
      alert("No podés enviar números en el chat. Usá el botón \"Enviar presupuesto\" para eso.");
      return;
    }

    setSending(true);

    try {
      await onSend(message);
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  const resetQuoteForm = () => {
    setMonto("");
    setAlcance("");
    setMateriales("Materiales incluidos");
    setTiempo("A coordinar");
    setGarantia("7 dias");
    setValidez("24 horas");
    setNotas("");
  };

  return (
    <>
      {/* Botón enviar presupuesto */}
      <Animated.View style={[styles.presupuestoBtnWrapper, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity onPress={() => setPresupuestoVisible(true)} activeOpacity={0.82}>
          <LinearGradient
            colors={["#00c2d4", "#007fa8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.presupuestoBtn}
          >
            <MaterialIcons name="attach-money" size={22} color="#fff" />
            <Text style={styles.presupuestoBtnText}>Enviar presupuesto</Text>
            <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: "auto" }} />
            {/* Shimmer sweep */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderRadius: 16,
                  overflow: "hidden",
                  transform: [{
                    translateX: shimmerAnim.interpolate({
                      inputRange: [-1, 2],
                      outputRange: [-220, 440],
                    }),
                  }],
                },
              ]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: 80, height: "100%" }}
              />
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.inputBarContainer}>
        {isRecording ? (
          <View style={styles.recordingPill}>
            <View style={styles.recordingDot} />
            <View style={styles.recordingCopy}>
              <Text style={styles.recordingTitle}>Grabando audio</Text>
              <Text style={styles.recordingTime}>
                {formatAudioDuration(recordingSeconds * 1000)} /{" "}
                {formatAudioDuration(CHAT_AUDIO_MAX_SECONDS * 1000)}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Cancelar grabación"
              onPress={() => stopRecording(true)}
              style={styles.cancelRecordingButton}
            >
              <Ionicons name="trash-outline" size={19} color="#b42318" />
            </TouchableOpacity>
          </View>
        ) : (
          <CustomTextInput
            containerStyle={{
              flex: 1,
              marginRight: 10,
              borderRadius: 20,
              height: "auto",
            }}
            inputStyle={{ minHeight: 40, maxHeight: 120 }}
            value={message}
            onChangeText={setMessage}
            placeholder="Escribí un mensaje..."
            multiline={true}
          />
        )}
        {message.trim() && !isRecording ? (
          <TouchableOpacity
            accessibilityLabel="Enviar mensaje"
            onPress={handleSend}
            disabled={sending || sendingAudio}
            style={styles.botonEnviar}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            accessibilityLabel={isRecording ? "Enviar audio" : "Grabar audio"}
            onPress={isRecording ? () => stopRecording(false) : startRecording}
            disabled={sendingAudio}
            style={[
              styles.audioButton,
              isRecording && styles.audioButtonRecording,
            ]}
            activeOpacity={0.72}
          >
            {sendingAudio ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={isRecording ? "send" : "mic"} size={23} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>
      {/* Modal presupuesto */}
      <Modal visible={presupuestoVisible} transparent animationType="fade" onRequestClose={() => setPresupuestoVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View style={styles.modalIconBox}>
                  <MaterialIcons name="receipt-long" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Presupuesto profesional</Text>
                  <Text style={styles.modalSubtitle}>Completo, claro y listo para aceptar.</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Monto final</Text>
              <View style={styles.montoRow}>
                <Text style={styles.montoPrefix}>$</Text>
                <TextInput
                  style={styles.montoInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#90a4ae"
                  value={monto}
                  onChangeText={(t) => setMonto(t.replace(/[^0-9]/g, ""))}
                  autoFocus
                />
              </View>

              <Text style={styles.fieldLabel}>Que incluye el trabajo</Text>
              <TextInput
                style={[styles.quoteInput, styles.quoteInputLarge]}
                multiline
                placeholder="Ej: visita, diagnostico, reparacion, limpieza y prueba final."
                placeholderTextColor="#94a3b8"
                value={alcance}
                onChangeText={setAlcance}
              />

              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <Text style={styles.fieldLabel}>Materiales</Text>
                  <TextInput
                    style={styles.quoteInput}
                    placeholder="Incluidos / aparte"
                    placeholderTextColor="#94a3b8"
                    value={materiales}
                    onChangeText={setMateriales}
                  />
                </View>
                <View style={styles.fieldGridItem}>
                  <Text style={styles.fieldLabel}>Tiempo estimado</Text>
                  <TextInput
                    style={styles.quoteInput}
                    placeholder="Hoy / 24 hs / 2 dias"
                    placeholderTextColor="#94a3b8"
                    value={tiempo}
                    onChangeText={setTiempo}
                  />
                </View>
              </View>

              <View style={styles.fieldGrid}>
                <View style={styles.fieldGridItem}>
                  <Text style={styles.fieldLabel}>Garantia</Text>
                  <TextInput
                    style={styles.quoteInput}
                    placeholder="7 dias"
                    placeholderTextColor="#94a3b8"
                    value={garantia}
                    onChangeText={setGarantia}
                  />
                </View>
                <View style={styles.fieldGridItem}>
                  <Text style={styles.fieldLabel}>Validez</Text>
                  <TextInput
                    style={styles.quoteInput}
                    placeholder="24 horas"
                    placeholderTextColor="#94a3b8"
                    value={validez}
                    onChangeText={setValidez}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Notas para el cliente</Text>
              <TextInput
                style={[styles.quoteInput, styles.quoteInputLarge]}
                multiline
                placeholder="Ej: no incluye repuestos especiales si se detectan piezas rotas."
                placeholderTextColor="#94a3b8"
                value={notas}
                onChangeText={setNotas}
              />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setPresupuestoVisible(false); resetQuoteForm(); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSendBtn, (!monto || !alcance.trim() || enviandoPresupuesto) && { opacity: 0.5 }]}
                disabled={!monto || !alcance.trim() || enviandoPresupuesto}
                onPress={async () => {
                  if (!monto || !alcance.trim()) return;
                  setEnviandoPresupuesto(true);
                  try {
                    await onSend(createQuoteMessage({
                      amount: Number(monto),
                      scope: alcance.trim(),
                      materials: materiales.trim() || "A confirmar",
                      timeframe: tiempo.trim() || "A coordinar",
                      warranty: garantia.trim() || "Sin garantia especificada",
                      validUntil: validez.trim() || "24 horas",
                      notes: notas.trim() || undefined,
                    }));
                    setPresupuestoVisible(false);
                    resetQuoteForm();
                  } finally {
                    setEnviandoPresupuesto(false);
                  }
                }}
              >
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.modalSendText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default memo(ChatInputBar);

const styles = StyleSheet.create({
  inputBarContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopColor: "#d0ece9",
    borderTopWidth: 1,
    backgroundColor: "#E8FAF7",
    alignItems: "flex-end",
  },
  botonEnviar: {
    backgroundColor: "#fe971a",
    borderRadius: 18,
    padding: 13,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFA13C77",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  audioButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#069eb3",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#047a8f",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  audioButtonRecording: {
    backgroundColor: "#d92d20",
  },
  recordingPill: {
    flex: 1,
    minHeight: 48,
    marginRight: 10,
    paddingHorizontal: 12,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#f5b8b3",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#d92d20",
    marginRight: 9,
  },
  recordingCopy: {
    flex: 1,
  },
  recordingTitle: {
    color: "#7a271a",
    fontSize: 13,
    fontWeight: "900",
  },
  recordingTime: {
    color: "#9e3d32",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
  },
  cancelRecordingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1f0",
  },
  presupuestoBtnWrapper: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#007fa8",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  presupuestoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
  },
  presupuestoBtnText: { fontSize: 15, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(7,18,28,0.58)", justifyContent: "center", alignItems: "center", padding: 18 },
  modalBox: { backgroundColor: "#fff", borderRadius: 8, padding: 16, width: "100%", maxWidth: 440, maxHeight: "88%", shadowColor: "#000", shadowOpacity: 0.16, shadowOffset: { width: 0, height: 8 }, shadowRadius: 18, elevation: 8 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  modalIconBox: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#047a8f" },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#102a35", marginBottom: 3 },
  modalSubtitle: { fontSize: 13, color: "#64748b" },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: "#38515d", marginBottom: 6, marginTop: 8 },
  fieldGrid: { flexDirection: "row", gap: 10 },
  fieldGridItem: { flex: 1 },
  montoRow: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#8dd4df", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 4, backgroundColor: "#f1fbfd" },
  montoPrefix: { fontSize: 22, fontWeight: "900", color: "#047a8f", marginRight: 4 },
  montoInput: { flex: 1, fontSize: 23, fontWeight: "900", color: "#102a35", paddingVertical: 0 },
  quoteInput: { minHeight: 44, borderWidth: 1, borderColor: "#d6e6ea", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: "#102a35", backgroundColor: "#fbfdfe", fontSize: 14, fontWeight: "600" },
  quoteInputLarge: { minHeight: 78, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1.5, borderColor: "#d7e2e5", alignItems: "center", backgroundColor: "#fff" },
  modalCancelText: { fontSize: 15, fontWeight: "800", color: "#667085" },
  modalSendBtn: { flex: 1, flexDirection: "row", gap: 6, paddingVertical: 12, borderRadius: 8, backgroundColor: "#069eb3", alignItems: "center", justifyContent: "center" },
  modalSendText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
