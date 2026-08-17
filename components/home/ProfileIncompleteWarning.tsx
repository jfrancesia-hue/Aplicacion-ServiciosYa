import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ProfileIncompleteWarningProps {
  onPress: () => void;
  isProvider?: boolean;
  score?: number;
  missingFields?: string[];
}

export const ProfileIncompleteWarning = ({
  onPress,
  isProvider = false,
  score = 0,
  missingFields = [],
}: ProfileIncompleteWarningProps) => (
  <View style={styles.container}>
    <View style={styles.content}>
      <Ionicons
        name={isProvider ? "briefcase-outline" : "alert-circle-outline"}
        size={28}
        color="#047a8f"
        style={styles.icon}
      />
      <View style={styles.copy}>
        <Text style={styles.title}>
          {isProvider ? `Tu perfil está ${score}% completo` : "Completá tu perfil"}
        </Text>
        <Text style={styles.text}>
          {isProvider
            ? `Agregar ${missingFields.slice(0, 3).join(", ") || "tus datos profesionales"} ayuda a generar confianza. Crear y completar tu perfil no tiene costo.`
            : "Completá tus datos para usar todas las funciones de ServiciosYa."}
        </Text>
        {isProvider ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, score))}%` }]} />
          </View>
        ) : null}
      </View>
    </View>
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{isProvider ? "Mejorar mi perfil" : "Completar perfil"}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#eef9f9",
    borderLeftWidth: 5,
    borderLeftColor: "#069eb3",
    padding: 15,
    margin: 16,
    borderRadius: 10,
    elevation: 3,
  },
  content: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  icon: { marginRight: 10 },
  copy: { flex: 1 },
  title: { color: "#193f46", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  text: { color: "#49656a", fontSize: 13, lineHeight: 18 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "#cde6e8", marginTop: 9, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: "#069eb3" },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#069eb3",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
