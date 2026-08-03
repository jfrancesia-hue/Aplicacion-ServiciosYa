import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../types/navigation";

type Navigation = NativeStackNavigationProp<MainStackParamList>;

export default function PagoInicial() {
  const navigation = useNavigation<Navigation>();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Registro liberado</Text>
        <Text style={styles.title}>No hay pago inicial</Text>
        <Text style={styles.body}>
          El registro queda habilitado sin cobro. En esta etapa, Servicios Ya cobra
          solo el 15% cuando el cliente confirma un presupuesto enviado por un
          profesional.
        </Text>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.buttonText}>Entrar a la app</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8FAF7",
    padding: 20,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: "#bcefea",
    shadowColor: "#19D4C6",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  kicker: {
    color: "#047a8f",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: "#102a35",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
  },
  body: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    marginTop: 22,
    backgroundColor: "#19D4C6",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
});
