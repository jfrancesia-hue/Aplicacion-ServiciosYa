import type React from "react";
import { Text, StyleSheet, View, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useBottomSheetModal } from "../../lib/hooks/useBottomSheetModal";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import SelectCitySheetView from "../home/SelectCitySheetView";
import { useQueryClient } from "@tanstack/react-query";
import { clearServicesCache } from "../../lib/hooks/useServices";
import { useLocationStore } from "../../store/locationStore";

const LocationChip = () => {
  const { isLoading, error, effectiveLocation } = useLocationStore();
  const client = useQueryClient();
  const { present, modalProps } = useBottomSheetModal({
    snapPoints: ["60%"],
    onClose: () => {
      clearServicesCache(client);
    },
  });

  const locationText = effectiveLocation
    ? [
        effectiveLocation.city || effectiveLocation.locality,
        effectiveLocation.province,
      ]
        .filter(Boolean)
        .join(", ") || "Ubicación elegida"
    : isLoading
      ? "Cargando ubicación"
      : error
        ? "Elegí tu ciudad"
        : "Ubicación por confirmar";

  const handleOnPress = () => {
    present();
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleOnPress}
        accessibilityRole="button"
        accessibilityLabel="Cambiar ciudad"
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
      >
        <Ionicons
          name="location-outline"
          size={14}
          color="white"
          style={styles.icon}
        />
        <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
          {locationText}
        </Text>
      </Pressable>
      <BottomSheetModal {...modalProps}>
        <SelectCitySheetView />
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontSize: 14,
    color: "white",
    fontWeight: "500",
    maxWidth: 150,
    includeFontPadding: false,
  },
  selectIcon: {
    marginLeft: 4,
  },
});

export default LocationChip;
