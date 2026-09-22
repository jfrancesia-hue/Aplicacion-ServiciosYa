import { BottomSheetView } from "@gorhom/bottom-sheet";
import { View, Text, StyleSheet, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import LoadingIndicator from "../LoadingIndicator";
import { useEffect, useState } from "react";
import type { LocationItem } from "../../types/location";
import { withSuspense } from "../withSuspense";
import LoadingView from "../LoadingView";
import { ManualSelectLocation } from "./ManualSelectLocation";
import { useLocationStore } from "../../store/locationStore";

// Reuse the same color scheme
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
};

interface LocationInputProps {
  initialValue?: LocationItem | null;
  onLocationSelected?: (location: LocationItem) => void;
}

function LocationSheetView({
  onLocationSelected,
  initialValue,
}: LocationInputProps) {
  const { isLoading, error, requestDeviceLocation } = useLocationStore();
  const [selectedItem, setSelectedItem] = useState<LocationItem | null>(null);
  const [mode, setMode] = useState<"gps" | "manual">("gps");

  useEffect(() => {
    if (initialValue) {
      setSelectedItem(initialValue);
    }
  }, [initialValue]);

  const handleGps = async () => {
    setMode("gps");
    setSelectedItem(null);
    await requestDeviceLocation();
    const resolved = useLocationStore.getState().effectiveLocation;
    if (!resolved) return;
    setSelectedItem({
      name:
        [resolved.city || resolved.locality, resolved.province]
          .filter(Boolean)
          .join(", ") || "Ubicación GPS confirmada",
      lat: resolved.latitude,
      lng: resolved.longitude,
      isoCountryCode: resolved.country ?? "AR",
    });
  };

  const handleSubmit = () => {
    if (selectedItem && onLocationSelected) {
      onLocationSelected(selectedItem);
    }
  };

  const submitDisabled = !selectedItem;

  


  return (
    <BottomSheetView
      style={[styles.sheetContainer]}
    >
      <View style={styles.header}>
        <Text style={styles.sheetTitle}>Elegí tu ubicación</Text>
      </View>

      <View style={styles.content}>
        {mode === "gps" ? (
          <View style={styles.gpsContainer}>
            {initialValue && (
              <View style={styles.locationCard}>
                <Text style={styles.cardLabel}>Ubicación guardada</Text>
                <View style={styles.locationRow}>
                  <MaterialIcons
                    name="location-pin"
                    size={20}
                    color={colors.primary}
                  />
                  <View style={styles.locationDetails}>
                    <Text style={styles.locationName}>{initialValue.name}</Text>
                    <Text style={styles.coordinates}>
                      lat: {initialValue.lat.toFixed(4)}, lng:{" "}
                      {initialValue.lng.toFixed(4)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <Pressable style={styles.locationCard} onPress={() => void handleGps()}>
              <Text style={styles.cardLabel}>Usar mi ubicación GPS</Text>
              <View style={styles.locationRow}>
                {isLoading ? (
                  <LoadingIndicator size={20} color={colors.primary} />
                ) : (
                  <MaterialIcons
                    name="my-location"
                    size={20}
                    color={colors.primary}
                  />
                )}

                <View style={styles.locationDetails}>
                  {selectedItem ? (
                    <>
                      <Text style={styles.locationName}>
                        {selectedItem.name}
                      </Text>
                      <Text style={styles.coordinates}>
                        Ubicación exacta confirmada
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.locationName}>
                      {isLoading
                        ? "Detectando ubicación..."
                        : "Tocá para permitir el acceso"}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
            {error ? <Text style={styles.locationError}>{error}</Text> : null}
            <Pressable
              style={styles.modeLink}
              onPress={() => {
                setMode("manual");
                setSelectedItem(null);
              }}
            >
              <Text style={styles.modeLinkText}>Ingresar dirección manualmente</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.manualContainer}>
            <ManualSelectLocation onChange={setSelectedItem} />
            <Pressable style={styles.modeLink} onPress={() => setMode("gps")}>
              <Text style={styles.modeLinkText}>Prefiero usar GPS</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            submitDisabled && styles.submitButtonDisabled,
            pressed && !submitDisabled && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={submitDisabled}
        >
          <Text style={styles.submitButtonText}>Actualizar ubicación</Text>
        </Pressable>
      </View>
    </BottomSheetView>
  );
}

export default withSuspense(
  LocationSheetView,
  <LoadingView withNavBarMargin />,
);

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryLighter,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  content: {
    gap: 24,
  },
  gpsContainer: {
    gap: 16,
  },
  manualContainer: {
    marginBottom: 8,
  },
  locationError: {
    color: "#9a3412",
    fontSize: 12,
    lineHeight: 17,
  },
  modeLink: { paddingVertical: 10, alignItems: "center" },
  modeLinkText: { color: "#087d8d", fontSize: 13, fontWeight: "800" },
  locationCard: {
    backgroundColor: colors.lightGray,
    borderRadius: 12,
    padding: 16,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationDetails: {
    flex: 1,
    marginLeft: 16,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  coordinates: {
    fontSize: 13,
    color: colors.gray,
    fontFamily: "monospace",
  },
  submitButton: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: colors.lightGray,
  },
  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
});
