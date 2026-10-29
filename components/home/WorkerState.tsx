import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { workerStatusQueryOptions } from "../../lib/queryOptions";
import { supabase } from "../../lib/supabase";
import showToast from "../../lib/toast";
import { getUserFromClient } from "../../lib/utils/user";
import SelectWorkStateSheetView, {
  updateWorkerAvailability,
} from "../workers/SelectWorkStateSheetView";

type AvailabilityDuration = 8 | 12 | 24;

const getPreferredDuration = (value?: number | null): AvailabilityDuration =>
  value === 8 || value === 24 ? value : 12;

function WorkState({ style }: { style?: StyleProp<ViewStyle> }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(workerStatusQueryOptions);
  const [now, setNow] = useState(Date.now());
  const status = data?.status ?? "OFFLINE";
  const availableUntilMs = Date.parse(data?.availableUntil ?? "") || 0;
  const lastSeenMs = Date.parse(data?.lastSeenAt ?? "") || 0;
  const preferredDuration = getPreferredDuration(data?.durationHours);
  const explicitAvailabilityActive =
    status === "ONLINE" && availableUntilMs > now;
  const legacyAvailabilityActive =
    status === "ONLINE" &&
    !availableUntilMs &&
    lastSeenMs > now - 30 * 60 * 1000;
  const isAvailable = explicitAvailabilityActive || legacyAvailabilityActive;

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const availabilityMutation = useMutation({
    mutationFn: (nextAvailable: boolean) =>
      updateWorkerAvailability(
        {
          status: nextAvailable ? "ONLINE" : "OFFLINE",
          durationHours: preferredDuration,
        },
        queryClient,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workerStatusQueryOptions.queryKey,
      });
    },
    onError: (error: Error) => {
      showToast.error("No pudimos cambiar tu disponibilidad", error.message);
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
          (!availableUntilMs && lastSeenMs > currentTime - 30 * 60 * 1000));
      if (!canRefresh) return;

      const user = getUserFromClient(queryClient);
      if (!user?.id) return;

      const { error } = await supabase.from("workers").upsert(
        {
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) {
        console.error(
          "[WorkerState] no se pudo actualizar last_seen_at:",
          error,
        );
      }
    };

    const interval = setInterval(updateLastSeen, 3 * 60 * 1000);
    void updateLastSeen();

    return () => clearInterval(interval);
  }, [availableUntilMs, lastSeenMs, status, queryClient]);

  const availabilityDetail = isAvailable
    ? availableUntilMs
      ? `Activa hasta ${new Date(availableUntilMs).toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Activa ahora"
    : `Se activará por ${preferredDuration} h`;

  return (
    <>
      <View style={[styles.container, style]}>
        <View style={styles.copy}>
          <Text style={styles.title}>Estoy disponible</Text>
          <Text style={styles.detail}>{availabilityDetail}</Text>
        </View>
        <Switch
          accessibilityLabel="Estoy disponible para recibir solicitudes"
          disabled={availabilityMutation.isPending}
          value={isAvailable}
          onValueChange={(value) => availabilityMutation.mutate(value)}
          trackColor={{ false: "#b8c5c7", true: "#7dd8c4" }}
          thumbColor={isAvailable ? "#047a8f" : "#f4f4f4"}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Configurar duración de disponibilidad"
          onPress={handlePresentModalPress}
          style={({ pressed }) => [
            styles.configureButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={19}
            color="#047a8f"
          />
          <Text style={styles.configureText}>Configurar</Text>
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
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#b7e0dc",
    borderRadius: 16,
    backgroundColor: "#f5fcfb",
  },
  copy: {
    flex: 1,
  },
  title: {
    color: "#174d54",
    fontSize: 15,
    fontWeight: "900",
  },
  detail: {
    color: "#5e7377",
    fontSize: 11,
    marginTop: 3,
  },
  configureButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#b7dadd",
    borderRadius: 22,
    backgroundColor: "#fff",
    paddingHorizontal: 11,
  },
  configureText: {
    color: "#047a8f",
    fontSize: 11,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.78,
  },
});
