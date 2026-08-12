import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  type ChatSchedule,
  getChatSchedule,
  proposeServiceSchedule,
  selectServiceScheduleSlot,
} from "../../lib/serviceSchedule";

type Props = {
  chatId: string;
  onChanged?: () => void;
};

const tomorrowAt = (hour: number) => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(hour, 0, 0, 0);
  return value;
};

const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ServiceSchedulePanel({ chatId, onChanged }: Props) {
  const [schedule, setSchedule] = useState<ChatSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [reason, setReason] = useState<"initial" | "reschedule">("initial");
  const [choices, setChoices] = useState<Date[]>([tomorrowAt(9)]);
  const [picker, setPicker] = useState<{
    index: number;
    mode: "date" | "time";
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSchedule(await getChatSchedule(chatId));
    } catch (error) {
      console.warn("[Agenda] no se pudo cargar", error);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sortedChoices = useMemo(
    () => [...choices].sort((a, b) => a.getTime() - b.getTime()),
    [choices],
  );

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#087d8d" />
        <Text style={styles.loadingText}>Cargando agenda...</Text>
      </View>
    );
  }
  if (!schedule) return null;

  const openEditor = (nextReason: "initial" | "reschedule") => {
    setReason(nextReason);
    setChoices([tomorrowAt(9)]);
    setPicker(null);
    setEditorVisible(true);
  };

  const updateChoice = (
    event: DateTimePickerEvent,
    value: Date | undefined,
  ) => {
    if (!picker) return;
    if (Platform.OS === "android") setPicker(null);
    if (event.type === "dismissed" || !value) return;

    setChoices((current) =>
      current.map((item, index) => {
        if (index !== picker.index) return item;
        const next = new Date(item);
        if (picker.mode === "date") {
          next.setFullYear(
            value.getFullYear(),
            value.getMonth(),
            value.getDate(),
          );
        } else {
          next.setHours(value.getHours(), value.getMinutes(), 0, 0);
        }
        return next;
      }),
    );
  };

  const submitChoices = async () => {
    if (
      sortedChoices.some(
        (choice) => choice.getTime() <= Date.now() + 30 * 60 * 1000,
      )
    ) {
      Alert.alert(
        "Revisá las fechas",
        "Cada opción debe tener al menos 30 minutos de anticipación.",
      );
      return;
    }
    if (
      new Set(sortedChoices.map((choice) => choice.toISOString())).size !==
      sortedChoices.length
    ) {
      Alert.alert("Opciones repetidas", "Elegí fechas u horarios diferentes.");
      return;
    }

    setSubmitting(true);
    try {
      await proposeServiceSchedule({
        paymentRecordId: schedule.paymentRecordId,
        reason,
        startsAt: sortedChoices,
      });
      setEditorVisible(false);
      await refresh();
      onChanged?.();
    } catch (error) {
      Alert.alert(
        "No se pudieron enviar las opciones",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectSlot = async (slotId: string) => {
    if (!schedule.proposalId) return;
    setSubmitting(true);
    try {
      await selectServiceScheduleSlot({
        proposalId: schedule.proposalId,
        slotId,
      });
      await refresh();
      onChanged?.();
    } catch (error) {
      Alert.alert(
        "No se pudo confirmar la fecha",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="calendar-outline" size={19} color="#fff" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>AGENDA DEL TRABAJO</Text>
            <Text style={styles.title}>
              {schedule.scheduleStatus === "scheduled"
                ? "Fecha confirmada"
                : schedule.scheduleStatus === "awaiting_selection"
                  ? "Opciones para coordinar"
                  : "Falta coordinar la fecha"}
            </Text>
          </View>
        </View>

        {schedule.scheduleStatus === "awaiting_provider_options" ? (
          schedule.canProposeInitial ? (
            <>
              <Text style={styles.bodyText}>
                Proponé hasta tres fechas. El cliente elegirá una desde este
                chat.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => openEditor("initial")}
              >
                <Ionicons name="calendar" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Proponer fechas</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.bodyText}>
              El prestador todavía tiene que proponer hasta tres fechas
              posibles.
            </Text>
          )
        ) : null}

        {schedule.scheduleStatus === "awaiting_selection" ? (
          <>
            <Text style={styles.bodyText}>
              {schedule.optionsExpired
                ? "Las opciones vencieron y hace falta proponer fechas nuevas."
                : schedule.proposedByMe
                  ? "Esperando que la otra parte elija una opción."
                  : "Elegí la opción que mejor te quede. La fecha se confirma para ambos."}
            </Text>
            {schedule.optionsExpired && schedule.canReplaceExpired ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => openEditor(schedule.proposalReason ?? "initial")}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>
                  Actualizar opciones
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.slotsList}>
                {schedule.slots.map((slot) => (
                  <TouchableOpacity
                    key={slot.id}
                    disabled={!schedule.canSelect || submitting}
                    onPress={() => selectSlot(slot.id)}
                    style={[
                      styles.slotButton,
                      !schedule.canSelect && styles.slotButtonDisabled,
                    ]}
                  >
                    <View style={styles.slotPosition}>
                      <Text style={styles.slotPositionText}>
                        {slot.position}
                      </Text>
                    </View>
                    <Text style={styles.slotText}>
                      {formatDateTime(slot.startsAt)}
                    </Text>
                    {schedule.canSelect ? (
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#087d8d"
                      />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : null}

        {schedule.scheduleStatus === "scheduled" && schedule.scheduledStart ? (
          <>
            <View style={styles.confirmedBox}>
              <Ionicons name="checkmark-circle" size={22} color="#16805d" />
              <View style={styles.confirmedCopy}>
                <Text style={styles.confirmedDate}>
                  {formatDateTime(schedule.scheduledStart)}
                </Text>
                <Text style={styles.confirmedHint}>
                  Confirmada por ambas partes · ronda {schedule.scheduleRound}
                </Text>
              </View>
            </View>
            {schedule.canProposeReschedule ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => openEditor("reschedule")}
              >
                <Ionicons
                  name="calendar-clear-outline"
                  size={15}
                  color="#087d8d"
                />
                <Text style={styles.secondaryButtonText}>
                  Proponer reprogramación
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </View>

      <Modal
        visible={editorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {reason === "initial" ? "Proponer fechas" : "Reprogramar trabajo"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Ofrecé entre una y tres opciones concretas. La otra parte deberá
              elegir una.
            </Text>

            {choices.map((choice, index) => (
              <View
                key={`${index}-${choice.toISOString()}`}
                style={styles.choiceRow}
              >
                <View style={styles.choiceNumber}>
                  <Text style={styles.choiceNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.choiceButtons}>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setPicker({ index, mode: "date" })}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color="#087d8d"
                    />
                    <Text style={styles.dateButtonText}>
                      {choice.toLocaleDateString("es-AR")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setPicker({ index, mode: "time" })}
                  >
                    <Ionicons name="time-outline" size={15} color="#087d8d" />
                    <Text style={styles.dateButtonText}>
                      {choice.toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
                {choices.length > 1 ? (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() =>
                      setChoices((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Ionicons name="trash-outline" size={17} color="#a34d4d" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            {choices.length < 3 ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() =>
                  setChoices((current) => [
                    ...current,
                    new Date(
                      current[current.length - 1].getTime() +
                        24 * 60 * 60 * 1000,
                    ),
                  ])
                }
              >
                <Ionicons name="add-circle-outline" size={17} color="#087d8d" />
                <Text style={styles.addButtonText}>Agregar otra opción</Text>
              </TouchableOpacity>
            ) : null}

            {picker ? (
              <View style={styles.pickerBox}>
                <DateTimePicker
                  value={choices[picker.index]}
                  mode={picker.mode}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date(Date.now() + 30 * 60 * 1000)}
                  onChange={updateChoice}
                />
                {Platform.OS === "ios" ? (
                  <TouchableOpacity
                    style={styles.pickerDone}
                    onPress={() => setPicker(null)}
                  >
                    <Text style={styles.pickerDoneText}>Listo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditorVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={submitting}
                style={[
                  styles.submitButton,
                  submitting && styles.buttonDisabled,
                ]}
                onPress={submitChoices}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar opciones</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 10,
  },
  loadingText: { color: "#668087", fontSize: 12 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#c2e1e6",
    backgroundColor: "#f4fbfc",
    padding: 13,
    marginBottom: 12,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#087d8d",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: "#087d8d",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  title: { color: "#183a42", fontSize: 15, fontWeight: "900", marginTop: 2 },
  bodyText: { color: "#536e74", fontSize: 12, lineHeight: 17, marginTop: 10 },
  primaryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#087d8d",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  primaryButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  slotsList: { marginTop: 9, gap: 7 },
  slotButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#bcdce1",
    paddingHorizontal: 10,
  },
  slotButtonDisabled: { opacity: 0.72 },
  slotPosition: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: "#dff3f5",
    alignItems: "center",
    justifyContent: "center",
  },
  slotPositionText: { color: "#087d8d", fontSize: 11, fontWeight: "900" },
  slotText: { flex: 1, color: "#294b52", fontSize: 12, fontWeight: "800" },
  confirmedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 10,
    padding: 10,
    backgroundColor: "#e9f8f1",
    borderRadius: 11,
  },
  confirmedCopy: { flex: 1 },
  confirmedDate: { color: "#176348", fontSize: 13, fontWeight: "900" },
  confirmedHint: { color: "#5b7e70", fontSize: 10, marginTop: 2 },
  secondaryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    paddingVertical: 7,
  },
  secondaryButtonText: { color: "#087d8d", fontSize: 11, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(6,25,31,0.58)",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 28,
  },
  modalTitle: { color: "#17383f", fontSize: 19, fontWeight: "900" },
  modalSubtitle: {
    color: "#647d83",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 14,
  },
  choiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 9,
  },
  choiceNumber: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: "#e3f5f7",
    alignItems: "center",
    justifyContent: "center",
  },
  choiceNumberText: { color: "#087d8d", fontSize: 11, fontWeight: "900" },
  choiceButtons: { flex: 1, flexDirection: "row", gap: 6 },
  dateButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#cadcdf",
    borderRadius: 10,
    backgroundColor: "#fbfdfd",
  },
  dateButtonText: { color: "#34565d", fontSize: 11, fontWeight: "800" },
  removeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  addButtonText: { color: "#087d8d", fontSize: 12, fontWeight: "800" },
  pickerBox: {
    borderRadius: 12,
    backgroundColor: "#f4f8f9",
    marginTop: 5,
    overflow: "hidden",
  },
  pickerDone: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  pickerDoneText: { color: "#087d8d", fontWeight: "900" },
  modalActions: { flexDirection: "row", gap: 9, marginTop: 14 },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#d2dfe1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { color: "#5e7378", fontWeight: "800" },
  submitButton: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: 11,
    backgroundColor: "#087d8d",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: { color: "#fff", fontWeight: "900" },
  buttonDisabled: { opacity: 0.6 },
});
