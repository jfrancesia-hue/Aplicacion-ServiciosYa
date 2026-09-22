import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../../lib/constants/colors";
import { useUserSettings } from "../../lib/hooks/useUserSettings";
import { cityToLocationData } from "../../lib/utils/location";
import { useLocationStore } from "../../store/locationStore";
import { GenericButton } from "../GenericButtom";
import LoadingView from "../LoadingView";
import { type City, CityAutocomplete } from "../inputs/CityAutocomplete";
import SheetContainer from "../sheet/SheetContainer";
import { withSuspense } from "../withSuspense";

function SelectCitySheetView() {
  const {
    effectiveLocation,
    source,
    error,
    isLoading,
    setCustomLocation,
    clearCustomLocation,
    requestDeviceLocation,
  } = useLocationStore();
  const [initialLocation] = useState(effectiveLocation);
  const { updateSettings } = useUserSettings();
  const [city, setCity] = useState<City | null>(null);
  const [address, setAddress] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // 🔹 estado loading
  const country = "AR";

  const queryClient = useQueryClient();

  const [currentLocation, setCurrentLocation] = useState(effectiveLocation);
  const canClear = initialLocation !== currentLocation || source === "custom";

  const handleSubmit = async () => {
    if (!city || !address.trim()) {
      setManualError("Elegí una ciudad y escribí la dirección exacta.");
      return;
    }
    setLoading(true);
    setManualError(null);
    try {
      const matches = await Location.geocodeAsync(
        `${address.trim()}, ${city.name}, Argentina`,
      );
      const match = matches[0];
      if (!match) throw new Error("No encontramos esa dirección.");
      const newLocation = {
        ...cityToLocationData(city),
        latitude: match.latitude,
        longitude: match.longitude,
      };
      await setCustomLocation(newLocation);
      await updateSettings({ customLocation: newLocation });

      // 🔹 Actualizamos el estado local inmediatamente
      setCurrentLocation(newLocation);

      queryClient.invalidateQueries({ queryKey: ["user", "services"] });
    } catch (cause) {
      setManualError(
        cause instanceof Error
          ? cause.message
          : "No pudimos ubicar esa dirección.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearCity = async () => {
    setLoading(true);
    try {
      await updateSettings({ customLocation: null });
      setCity(null);
      setAddress("");
      setManualError(null);
      clearCustomLocation();
      setCurrentLocation(useLocationStore.getState().effectiveLocation);
      queryClient.invalidateQueries({ queryKey: ["user", "services"] });
    } finally {
      setLoading(false);
    }
  };

  const handleUseDeviceLocation = async () => {
    setLoading(true);
    try {
      await updateSettings({ customLocation: null });
      clearCustomLocation();
      await requestDeviceLocation();
      setCurrentLocation(useLocationStore.getState().effectiveLocation);
      queryClient.invalidateQueries({ queryKey: ["user", "services"] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SheetContainer style={styles.sheetContainer}>
      <Text style={styles.sheetTitle}>Confirmá la ubicación</Text>

      {/* Display current city info if set, otherwise show GPS info */}
      <View style={styles.currentCityContainer}>
        <View style={styles.currentCityHeader}>
          <MaterialIcons
            name="location-on"
            size={20}
            color={colors.primary || "#3b82f6"}
            style={styles.locationIcon}
          />
          <View style={styles.currentCityInfo}>
            <Text style={styles.currentCityTitle}>Ubicación actual</Text>
            <Text style={styles.currentCityText}>
              {[currentLocation?.city, currentLocation?.province]
                .filter(Boolean)
                .join(", ") || "Ubicación por confirmar"}
            </Text>
            {source === "ip" ? (
              <Text style={styles.approximateText}>
                Aproximada por internet: requiere confirmación
              </Text>
            ) : null}
          </View>
          {canClear && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearCity}
              activeOpacity={0.7}
            >
              <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.infoTextLong}>
        {source === "custom"
          ? "Podés cambiar la dirección elegida o volver a usar el GPS."
          : "Usá el GPS o ingresá una ciudad y una dirección exacta."}
      </Text>

      {error ? <Text style={styles.locationError}>{error}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.82}
        disabled={loading || isLoading}
        onPress={handleUseDeviceLocation}
        style={styles.deviceLocationButton}
      >
        <MaterialIcons name="my-location" size={19} color="#087d8d" />
        <View style={styles.deviceLocationCopy}>
          <Text style={styles.deviceLocationTitle}>
            {isLoading ? "Obteniendo ubicación…" : "Usar mi ubicación GPS"}
          </Text>
          <Text style={styles.deviceLocationText}>
            Android te pedirá permiso antes de acceder.
          </Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.manualDivider}>O ingresá la ubicación manualmente</Text>

      <View style={styles.autocompleteContainer}>
        <CityAutocomplete
          label="Ciudad"
          countryCode={country}
          onSelectCity={(city) => {
            setCity(city || null);
          }}
          placeholder="Seleccioná una ciudad"
          dropdownProps={{ direction: "down" }}
        />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Calle y número, barrio o referencia"
          placeholderTextColor="#70878c"
          style={styles.addressInput}
        />
        {manualError ? (
          <Text style={styles.locationError}>{manualError}</Text>
        ) : null}
      </View>

      <GenericButton
        title={loading ? "Ubicando..." : "Confirmar dirección"}
        onPress={handleSubmit}
        style={styles.button}
        disabled={loading || !city || !address.trim()}
      />
    </SheetContainer>
  );
}

export default withSuspense(
  SelectCitySheetView,
  <LoadingView withNavBarMargin />,
);

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  infoTextLong: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 18,
  },
  locationError: {
    color: "#9a3412",
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  autocompleteContainer: {
    marginBottom: 16,
  },
  addressInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#bcdde1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#173f47",
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 8,
  },
  currentCityContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  gpsLocationContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#f0fdf4", // Light green background
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0", // Light green border
  },
  currentCityHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  gpsLocationHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationIcon: {
    marginRight: 12,
  },
  currentCityInfo: {
    flex: 1,
  },
  gpsLocationInfo: {
    flex: 1,
  },
  currentCityTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gpsLocationTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#065f46", // Dark green
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  currentCityText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 20,
  },
  approximateText: {
    color: "#9a6000",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
  deviceLocationButton: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bcdde1",
    backgroundColor: "#effafb",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  deviceLocationCopy: { flex: 1 },
  deviceLocationTitle: { color: "#17515c", fontSize: 13, fontWeight: "900" },
  deviceLocationText: { color: "#70878c", fontSize: 10, marginTop: 2 },
  manualDivider: {
    color: "#5f777c",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  gpsLocationText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#059669", // Green
    lineHeight: 20,
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
});
