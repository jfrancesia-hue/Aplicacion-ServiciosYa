import { useState } from "react";
import { CityAutocomplete, type City } from "../inputs/CityAutocomplete";
import {
  ActivityIndicator,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import type { LocationItem } from "../../types/location";
import * as Location from "expo-location";

interface ManualSelectLocationProps {
  onChange: (location: LocationItem | null) => void;
  style?: StyleProp<ViewStyle>;
}

export function ManualSelectLocation({
  onChange,
  style,
}: ManualSelectLocationProps) {
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmAddress = async () => {
    if (!selectedCity || !address.trim()) {
      setError("Elegí la ciudad y escribí la dirección exacta.");
      onChange(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const matches = await Location.geocodeAsync(
        `${address.trim()}, ${selectedCity.name}, Argentina`,
      );
      const match = matches[0];
      if (!match) throw new Error("No encontramos esa dirección.");
      onChange({
        name: `${address.trim()}, ${selectedCity.name}`,
        lat: match.latitude,
        lng: match.longitude,
        isoCountryCode: "AR",
      });
    } catch (cause) {
      onChange(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos ubicar esa dirección.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={style}>
      <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>
        Si no querés usar GPS, indicá una dirección para ubicar el trabajo
        con precisión.
      </Text>
      <View style={styles.countryField}>
        <Text style={styles.countryLabel}>País</Text>
        <Text style={styles.countryValue}>Argentina</Text>
      </View>
      <CityAutocomplete
        label="Ciudad"
        countryCode="AR"
        onSelectCity={(city) => {
          setSelectedCity(city || null);
          onChange(null);
        }}
        placeholder="Seleccioná una ciudad"
        style={{ marginTop: 12 }}
      />
      <TextInput
        value={address}
        onChangeText={(value) => {
          setAddress(value);
          onChange(null);
        }}
        placeholder="Calle y número, barrio o referencia"
        placeholderTextColor="#7b8b8e"
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.82}
        disabled={loading}
        onPress={() => void confirmAddress()}
        style={[styles.button, loading && styles.buttonDisabled]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : null}
        <Text style={styles.buttonText}>
          {loading ? "Ubicando…" : "Confirmar dirección exacta"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  countryField: {
    borderWidth: 1,
    borderColor: "#d7e7e9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f7fbfb",
  },
  countryLabel: { color: "#70878c", fontSize: 11, fontWeight: "700" },
  countryValue: { color: "#173f47", fontSize: 14, fontWeight: "800" },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#bcdde1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#173f47",
    backgroundColor: "#fff",
  },
  error: { color: "#9a3412", fontSize: 12, marginTop: 8 },
  button: {
    minHeight: 48,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#087d8d",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
