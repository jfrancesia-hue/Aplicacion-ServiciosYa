import { View, Text, StyleSheet, Pressable } from "react-native";
import type { WorkerStatus } from "../../types/worker";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import SelectWorkStateSheetView from "../workers/SelectWorkStateSheetView";
import { updateWorkerAvailability } from "../workers/SelectWorkStateSheetView";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workerStatusQueryOptions } from "../../lib/queryOptions";
import { supabase } from "../../lib/supabase";
import { getUserFromClient } from "../../lib/utils/user";
import type { StyleProp, ViewStyle } from "react-native";

type Labels = {
  [P in WorkerStatus]: string;
};

const workStatusLabels: Labels = {
  ONLINE: "En línea",
  OFFLINE: "Desconectado",
  BUSY: "Ocupado",
  ON_BREAK: "En descanso",
};

const statusColors: Record<WorkerStatus, string> = {
  ONLINE: "#43D675", // Green
  OFFLINE: "#F44336", // Red
  BUSY: "#FFB300", // Amber
  ON_BREAK: "#42A5F5", // Blue
};

function WorkState({ style }: { style?: StyleProp<ViewStyle> }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(workerStatusQueryOptions);
  const [now, setNow] = useState(Date.now());
  const status = data?.status ?? "OFFLINE";
  const color = statusColors[status];
  const availableUntilMs = Date.parse(data?.availableUntil ?? "") || 0;
  const lastSeenMs = Date.parse(data?.lastSeenAt ?? "") || 0;
  const explicitAvailabilityActive =
    status === "ONLINE" && availableUntilMs > now;
  const legacyAvailabilityActive =
    status === "ONLINE" &&
    !availableUntilMs &&
    lastSeenMs > now - 30 * 60 * 1000;
  const isAvailable =
    explicitAvailabilityActive || legacyAvailabilityActive;

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const activateToday = useMutation({
    mutationFn: () =>
      updateWorkerAvailability(
        { status: "ONLINE", durationHours: 12 },
        queryClient,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workerStatusQueryOptions.queryKey,
      });
    },
    onError: (error: Error) => {
      console.error("[WorkerState] no se pudo actualizar:", error);
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateLastSeen = async () => {
      const currentTime = Date.now();
      const canRefresh =
        status === "ONLINE" &&
        ((availableUntilMs > 0 && availableUntilMs > currentTime) ||
          (!availableUntilMs &&
            lastSeenMs > currentTime - 30 * 60 * 1000));
      if (canRefresh) {
        const user = getUserFromClient(queryClient);
        if (user?.id) {
          const { error } = await supabase.from("workers").upsert(
            {
              user_id: user.id,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          if (error) {
            // Optionally handle/log error
            console.error("Failed to update last_seen_at:", error);
          }
        }
      }
    };

    const interval = setInterval(updateLastSeen, 3 * 60 * 1000); // 3 minutes

    // Run immediately on mount if ONLINE
    updateLastSeen();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [availableUntilMs, lastSeenMs, status, queryClient]);

  const availabilityDetail = isAvailable
    ? availableUntilMs
      ? `Activa hasta ${new Date(availableUntilMs).toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Actividad reciente"
    : "Tu perfil sigue publicado";

  return (
    <>
      <View style={[styles.container, style]}>
        <View style={styles.copy}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.circle,
                { backgroundColor: isAvailable ? "#159447" : color },
              ]}
            />
            <Text style={styles.title}>
              {isAvailable ? "Disponible hoy" : workStatusLabels[status]}
            </Text>
          </View>
          <Text style={styles.detail}>{availabilityDetail}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={activateToday.isPending}
          onPress={
            isAvailable
              ? handlePresentModalPress
              : () => activateToday.mutate()
          }
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {activateToday.isPending
              ? "Actualizando..."
              : isAvailable
                ? "Cambiar"
                : "Disponible 12 h"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Ver más opciones de disponibilidad"
          onPress={handlePresentModalPress}
          style={styles.moreButton}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color="#047a8f"
          />
        </Pressable>
      </View>
      <BottomSheetModal ref={bottomSheetModalRef}>
        <SelectWorkStateSheetView />
      </BottomSheetModal>
    </>
  );
}

export default memo(WorkState);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#b7e0dc",
    borderRadius: 18,
    backgroundColor: "#f5fcfb",
  },
  circle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 7,
  },
  copy: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: "#174d54",
    fontSize: 15,
    fontWeight: "900",
  },
  detail: {
    marginTop: 4,
    color: "#5e7377",
    fontSize: 11,
  },
  primaryButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "#047a8f",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  moreButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#b7dadd",
    borderRadius: 19,
    backgroundColor: "#fff",
  },
  buttonPressed: {
    opacity: 0.78,
  },
});
