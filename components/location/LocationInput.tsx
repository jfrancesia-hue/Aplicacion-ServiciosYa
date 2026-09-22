import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import LocationSheetView from "./LocationSheetView";
import type { LocationItem } from "../../types/location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { getLocationName } from "../../lib/utils/location";

interface LocationInputProps {
  locationText?: string;
  initialValue?: LocationItem | null;
  onChange?: (location: LocationItem) => void;
  sheetNavbarHeight?: boolean;
}

function LocationInput({
  onChange,
  locationText = "Ubicación no definida",
  initialValue,
  sheetNavbarHeight = true,
}: LocationInputProps) {
  const insets = useSafeAreaInsets();
  const bottomNavBarHeight = insets.bottom;
  const [_locationText, setLocationText] = useState(locationText);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [initialLocation, setInitialLocation] = useState<LocationItem | null>(
    null,
  );

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleLocationSelected = useCallback(
    (location: LocationItem) => {
      setLocationText(location.name ?? "N/A");
      onChange?.(location);
      bottomSheetModalRef.current?.dismiss();
    },
    [onChange],
  );

  useEffect(() => {
    const getLocationText = async () => {
      if (initialValue) {
        const addressResponse = await Location.reverseGeocodeAsync({
          latitude: initialValue.lat,
          longitude: initialValue.lng,
        });
        const name = getLocationName(addressResponse[0]);
        setLocationText(name);
        setInitialLocation({
          ...initialValue,
          name,
        });
      }
    };

    getLocationText();
  }, [initialValue]);

  return (
    <>
      <Text style={styles.label}>Ubicación</Text>
      <TouchableOpacity
        onPress={handlePresentModalPress}
        style={styles.locationContainer}
      >
        <Ionicons name="location-outline" size={16} color="#19D4C6" />
        <Text style={styles.locationText}>{_locationText}</Text>
      </TouchableOpacity>
      <BottomSheetModal
        ref={bottomSheetModalRef}
        // onChange={handleSheetChanges}
        enablePanDownToClose
        // Handle keyboard behavior
        enableHandlePanningGesture={false}
        keyboardBlurBehavior="restore"
        bottomInset={bottomNavBarHeight}
      >
        <LocationSheetView
          onLocationSelected={handleLocationSelected}
          initialValue={initialLocation}
        />
      </BottomSheetModal>
    </>
  );
}

export default LocationInput;

const styles = StyleSheet.create({
  locationText: { marginLeft: 8, color: "#19D4C6", fontSize: 17 },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C8ECE8",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  container: {
    padding: 20,
    backgroundColor: "#E8FAF7", // Fondo turquesa clarito
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 24,
    color: "#19D4C6",
    letterSpacing: 0.5,
  },
  inputContainer: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    elevation: 8,
    shadowColor: "#19D4C6",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
  },
  label: {
    fontSize: 15,
    color: "#19D4C6",
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C8ECE8",
    fontSize: 17,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    color: "#333",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#C8ECE8",
    borderRadius: 12,
    marginBottom: 15,
    overflow: "hidden",
    backgroundColor: "#FAFAFA",
  },
  picker: {
    height: 50,
    width: "100%",
    color: "#222",
    fontSize: 17,
    backgroundColor: "#FAFAFA",
  },
  submitButton: {
    marginTop: 28,
    backgroundColor: "#fe971a", // Naranja
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#fe971a",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  sheetContainer: {
    flex: 1,
    // paddingHorizontal: 24,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
});
