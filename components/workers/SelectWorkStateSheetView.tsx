import { Text, StyleSheet, Pressable, View } from "react-native";
import colors from "../../lib/constants/colors";
import SheetContainer from "../sheet/SheetContainer";
import type { WorkerStatus } from "../../types/worker";
import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import {
  workerStatusQueryOptions,
} from "../../lib/queryOptions";
import {
  getLocationParamsFromClient,
  locationQueryString,
} from "../../lib/utils/location";
import showToast from "../../lib/toast";
import { useBottomSheetModal } from "@gorhom/bottom-sheet";
import { getUserFromClient } from "../../lib/utils/user";
import vexo from "../../lib/vexo";

type AvailabilityChoice = {
  key: string;
  status: WorkerStatus;
  durationHours?: 8 | 12 | 24;
  label: string;
  description: string;
};

const availabilityChoices: AvailabilityChoice[] = [
  {
    key: "online-8",
    status: "ONLINE",
    durationHours: 8,
    label: "Disponible por 8 horas",
    description: "Ideal para una jornada de trabajo.",
  },
  {
    key: "online-12",
    status: "ONLINE",
    durationHours: 12,
    label: "Disponible por 12 horas",
    description: "La opción recomendada para hoy.",
  },
  {
    key: "online-24",
    status: "ONLINE",
    durationHours: 24,
    label: "Disponible por 24 horas",
    description: "Seguirás apareciendo primero hasta mañana.",
  },
  {
    key: "busy",
    status: "BUSY",
    label: "Estoy ocupado",
    description: "Los clientes podrán consultar tu próximo horario.",
  },
  {
    key: "break",
    status: "ON_BREAK",
    label: "En descanso",
    description: "Pausá temporalmente las solicitudes nuevas.",
  },
  {
    key: "offline",
    status: "OFFLINE",
    label: "No disponible",
    description: "Tu perfil seguirá publicado, con disponibilidad a confirmar.",
  },
];

export async function updateWorkerAvailability(
  {
    status,
    durationHours,
  }: Pick<AvailabilityChoice, "status" | "durationHours">,
  client: QueryClient,
) {
  const user = getUserFromClient(client);
  const location = await getLocationParamsFromClient(client);
  const now = new Date();
  const availableUntil =
    status === "ONLINE" && durationHours
      ? new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString()
      : null;

  const { error } = await supabase.from("workers").upsert(
    {
      user_id: user.id,
      status,
      last_seen_at: now.toISOString(),
      available_until: availableUntil,
      availability_duration_hours:
        status === "ONLINE" ? durationHours ?? 12 : null,
      location: locationQueryString(
        location.search_lat || 0,
        location.search_lon || 0,
      ),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    throw new Error(error.message);
  }

  vexo.marketplace("availability_updated", {
    estado: status,
    duracion_horas: durationHours ?? 0,
  });
}

function SelectWorkStateSheetView() {
  const client = useQueryClient();
  const { dismiss } = useBottomSheetModal();
  const { mutate, isPending } = useMutation({
    mutationFn: (choice: AvailabilityChoice) =>
      updateWorkerAvailability(choice, client),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: workerStatusQueryOptions.queryKey,
      });
      dismiss();
    },
    onError(error, variables, context) {
      showToast.error("Error al actualizar estado", error.message);
    },
  });

  return (
    <SheetContainer>
      <Text style={styles.sheetTitle}>Actualizar disponibilidad</Text>
      <Text style={styles.sheetSubtitle}>
        Elegí cuánto tiempo querés aparecer como disponible. Al vencer, tu
        perfil seguirá publicado para consultas.
      </Text>
      <View style={styles.contentContainer}>
        {availabilityChoices.map((choice) => (
          <Pressable
            key={choice.key}
            style={({ pressed }) => [
              styles.statusButton,
              pressed && styles.statusButtonPressed,
            ]}
            onPress={() => mutate(choice)}
            disabled={isPending}
          >
            <Text style={styles.statusLabel}>{choice.label}</Text>
            <Text style={styles.statusDescription}>
              {choice.description}
            </Text>
          </Pressable>
        ))}
      </View>
    </SheetContainer>
  );
}

export default SelectWorkStateSheetView;

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    paddingHorizontal: 16, // Reduced padding
    backgroundColor: colors.background,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  sheetSubtitle: {
    marginBottom: 16,
    paddingHorizontal: 8,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  contentContainer: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: 10, // Less vertical gap
  },
  statusButton: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 10, // Less vertical padding
    paddingHorizontal: 14, // Less horizontal padding
    marginVertical: 2, // Less margin
    elevation: 1,
    borderWidth: 1,
    borderColor: colors.border || "#e0e0e0", // Subtle border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
  },
  statusButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  statusLabel: {
    fontSize: 16, // Smaller font
    fontWeight: "600",
    color: colors.text,
    marginBottom: 2, // Less margin
  },
  statusDescription: {
    fontSize: 12, // Smaller font
    color: colors.textSecondary,
  },
  disclaimer: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 18,
    marginBottom: 6,
  },
});
