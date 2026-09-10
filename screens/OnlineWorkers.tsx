import { FlatList, Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { withSuspense } from "../components/withSuspense";
import LoadingView from "../components/LoadingView";
import ScreenContainer from "../components/ScreenContainer";
import {
  useMutation,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Servicio } from "../types/servicios";
import ServicioItem from "../components/servicios/ServicioItem";
import { withModalProvider } from "../components/sheet/withModalProvider";
import { BottomSheetModal, useBottomSheetModal } from "@gorhom/bottom-sheet";
import SheetContainer from "../components/sheet/SheetContainer";
import { useRef, useState } from "react";
import { SheetButton } from "../components/sheet/SheetButton";
import showToast from "../lib/toast";
import { getLocationParamsFromClient } from "../lib/utils/location";
import BotonVolver from '../components/BotonVolver';

const colors = {
  primary: "#00B8A9",
  primaryLight: "#5DD0C5",
  primaryLighter: "#A0E6DF",
  primaryDark: "#00897B",
  secondary: "#FFA13C",
  secondaryLight: "#FFB96A",
  secondaryLighter: "#FFD4A8",
  gray: "#767577",
  lightGray: "#F5F5F5",
  darkGray: "#3E3E3E",
  textPrimary: "#1A1A1A",
  textSecondary: "#5E5E5E",
  background: "#FFFFFF",
  success: "#4CAF50",
  online: "#4CAF50",
};

function OnlineWorkers() {
  const [seleted, setSelected] = useState<Servicio | null>(null);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { data: services } = useSuspenseQuery({
    queryKey: ["user", "services", "online"],
    queryFn: async ({ client }): Promise<Servicio[]> => {
      const locationParams = await getLocationParamsFromClient(client);
      const { data, error } = await supabase.rpc(
        "get_servicios_with_online_workers",
        locationParams,
      );

      if (error) {
        console.error("Error fetching online workers:", error);
        return [];
      }

      return data || [];
    },
  });

  const handleServiceSelect = (id: number) => {
    setSelected(services.find((s) => s.id === id) ?? null);
    bottomSheetModalRef.current?.present();
  };

  return (
    <ScreenContainer style={styles.screenContainer}>
      <BotonVolver />
      <View style={styles.header}>
        <Text style={styles.title}>Trabajadores en Línea</Text>
        <Text style={styles.subtitle}>
          {services.length}{" "}
          {services.length === 1 ? "disponible" : "disponibles"}
        </Text>
      </View>

      <FlatList
        data={services}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ServicioItem
            servicio={item}
            workerStatus="ONLINE"
            onPress={(id) => handleServiceSelect(id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="wifi-off" size={40} color={colors.gray} />
            <Text style={styles.emptyTitle}>No hay trabajadores en línea</Text>
            <Text style={styles.emptyText}>
              Vuelve más tarde para ver servicios disponibles.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
      />
      <BottomSheetModal ref={bottomSheetModalRef}>
        <SelectedServicioSheet servicio={seleted} />
      </BottomSheetModal>
    </ScreenContainer>
  );
}

function SelectedServicioSheet({ servicio }: { servicio: Servicio | null }) {
  const { dismiss } = useBottomSheetModal();
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!servicio || !servicio.id || !servicio.user_id) {
        throw new Error("Servicio no definido");
      }
      const { error } = await supabase.rpc("hire_service", {
        p_service_id: servicio.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      dismiss();
      showToast.success("Servicio contratado exitosamente", "¡Éxito!");
    },
    onError: (error) => {
      showToast.error("Error al contratar servicio", error.message);
    },
  });

  return (
    <SheetContainer>
      <Text style={styles.subtitle}>{servicio?.titulo ?? "Sin definir"}</Text>
      <SheetButton
        label="Contratar Servicio"
        onPress={mutate}
        disabled={isPending}
        loading={isPending}
      />
      <SheetButton label="Perfil" onPress={() => {}} />
    </SheetContainer>
  );
}

export default withSuspense(withModalProvider(OnlineWorkers), <LoadingView />);

const styles = StyleSheet.create({
  screenContainer: {
    backgroundColor: colors.lightGray,
  },
  header: {
    marginTop:50,
    paddingHorizontal: 20,
    paddingTop: 46,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexGrow: 1,
  },
  separator: {
    height: 8,
  },

  // Card Styles
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },

  // Header Section
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  titleSection: {
    flex: 1,
    gap: 6,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 22,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  onlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },

  onlineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fff",
  },

  onlineText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // Description
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Footer Section
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    paddingTop: 12,
    marginTop: 4,
  },

  detailsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },

  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.secondary,
  },

  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  // Action Buttons
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },

  secondaryButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryButtonPressed: {
    backgroundColor: colors.primaryLighter,
    borderColor: colors.primary,
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 6,
  },

  primaryButtonPressed: {
    backgroundColor: colors.primaryLight,
  },

  primaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
