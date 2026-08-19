import { Ionicons } from "@expo/vector-icons";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useRef, useMemo, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Icon from "react-native-vector-icons/FontAwesome";
import BotonVolver from "../components/BotonVolver";
import PedidosMicaSection from "../components/serviciosYa/PedidosMicaSection";
import { misServicionQueryOptions } from "../lib/queryOptions";
import { supabase } from "../lib/supabase";

export default function MisServicios() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const bottomSheetRef = useRef(null);
  const [selectedService, setSelectedService] = React.useState(null);

  const snapPoints = useMemo(() => ["30%"], []);

  const {
    data: serviciosPublicados = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    ...misServicionQueryOptions,
    staleTime: 200,
    refetchOnMount: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("servicios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      Alert.alert("Éxito", "Servicio eliminado correctamente");
    },
    onError: (error) => {
      Alert.alert("Error", "No se pudo eliminar el servicio");
      console.error(error);
    },
  });

  const toggleEstadoMutation = useMutation({
    mutationFn: async ({ id, estadoActual }) => {
      const nuevoEstado = estadoActual === "pausado" ? "'activo'" : "pausado";
      const { error } = await supabase
        .from("servicios")
        .update({ estado: nuevoEstado })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      Alert.alert("Error", "No se pudo actualizar el estado");
      console.error(error);
    },
  });

  const handleOpenMenu = (service) => {
    setSelectedService(service);
    bottomSheetRef.current?.expand();
  };

  const handleCloseMenu = () => {
    bottomSheetRef.current?.close();
  };

  const eliminarServicio = () => {
    handleCloseMenu();
    setTimeout(() => {
      Alert.alert(
        "Confirmar eliminación",
        "¿Estás seguro de que deseas eliminar este servicio?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            onPress: () => deleteMutation.mutate(selectedService.id),
            style: "destructive",
          },
        ],
      );
    }, 300);
  };

  const pausarServicio = () => {
    handleCloseMenu();
    setTimeout(() => {
      toggleEstadoMutation.mutate({
        id: selectedService.id,
        estadoActual: selectedService.estado,
      });
    }, 300);
  };

  const editarServicio = () => {
    handleCloseMenu();
    setTimeout(() => {
      navigation.navigate("EditarServicio", { servicio: selectedService });
    }, 300);
  };

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const getEstadoColor = (estado) => {
    switch (estado) {
      case "'activo'":
        return "#10B981";
      case "pausado":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case "'activo'":
        return "checkmark-circle";
      case "pausado":
        return "pause-circle";
      default:
        return "help-circle";
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.serviceItem}
      activeOpacity={0.7}
      onPress={() => handleOpenMenu(item)}
    >
      {/* Category Icon */}
      <View style={styles.iconContainer}>
        <Icon name="briefcase" size={22} color="#0e7b78" />
      </View>

      {/* Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Text style={styles.serviceTitle} numberOfLines={1}>
              {item.titulo}
            </Text>
            <Ionicons
              name={getEstadoIcon(item.estado)}
              size={16}
              color={getEstadoColor(item.estado)}
            />
          </View>
          <TouchableOpacity
            onPress={() => handleOpenMenu(item)}
            style={styles.moreButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentColumn}>
          <Text style={styles.serviceDescription} numberOfLines={1}>
            {item.descripcion}
          </Text>

          <View style={styles.statsRow}>
            {/* Rating */}
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#F7C56F" />
              <Text style={styles.ratingText}>
                {(item.calificacion_promedio || 0).toFixed(1)}
              </Text>
            </View>

            {/* Contracts */}
            <View style={styles.contractsContainer}>
              <Text style={styles.contractsText}>
                {item.veces_contratado || 0} Contrataciones
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <BotonVolver />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0e7b78" />
          <Text style={styles.loadingText}>Cargando servicios...</Text>
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <BotonVolver />
        <View style={styles.centerContent}>
          <Icon name="exclamation-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Error al cargar los servicios</Text>
          <Text style={styles.errorSubtext}>{error?.message}</Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <BotonVolver />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Mis servicios</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Hacer una publicación"
          activeOpacity={0.85}
          onPress={() => navigation.navigate("OfrecerServicio")}
          style={styles.publishButton}
        >
          <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.publishButtonText}>Hacer una publicación</Text>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <FlatList
        data={serviciosPublicados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={<PedidosMicaSection />}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="inbox" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No has publicado ofertas aún</Text>
            <Text style={styles.emptySubtext}>
              Tus servicios aparecerán aquí una vez que los publiques
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      {/* <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity> */}

      {/* Bottom Sheet for Actions */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <Text style={styles.bottomSheetTitle}>{selectedService?.titulo}</Text>

          <View style={styles.actionsContainer}>
            {/* Edit Action */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={editarServicio}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: "#E8FAF7" },
                ]}
              >
                <Icon name="edit" size={20} color="#0e7b78" />
              </View>
              <Text style={styles.actionText}>Editar servicio</Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Pause/Resume Action */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={pausarServicio}
              disabled={toggleEstadoMutation.isPending}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: "#EFF6FF" },
                ]}
              >
                <Icon
                  name={
                    selectedService?.estado === "pausado" ? "play" : "pause"
                  }
                  size={20}
                  color="#3B82F6"
                />
              </View>
              <Text style={styles.actionText}>
                {selectedService?.estado === "pausado" ? "Reanudar" : "Pausar"}{" "}
                servicio
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Delete Action */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={eliminarServicio}
              disabled={deleteMutation.isPending}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: "#FEF2F2" },
                ]}
              >
                <Icon name="trash" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.actionText, { color: "#EF4444" }]}>
                Eliminar servicio
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8FAF7",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  publishButton: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#0e7b78",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  publishButtonText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  listContainer: {
    padding: 12,
    paddingBottom: 100,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E8FAF7",
    justifyContent: "center",
    alignItems: "center",
  },
  detailsContainer: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  moreButton: {
    padding: 4,
  },
  contentColumn: {
    gap: 6,
  },
  serviceDescription: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },
  contractsContainer: {
    backgroundColor: "#E8FAF7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contractsText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0e7b78",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#0e7b78",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0e7b78",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    textAlign: "center",
  },
  errorSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  bottomSheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: "#D1D5DB",
    width: 40,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
    textAlign: "center",
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    gap: 12,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
});
