import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import BotonVolver from "../components/BotonVolver";
import type { MainStackParamList } from "../types/navigation";

type Navigation = NativeStackNavigationProp<MainStackParamList>;

export default function PasarelaPago() {
  const navigation = useNavigation<Navigation>();
  const { params } = useRoute() as { params?: MainStackParamList["PasarelaPago"] };
  const categoria = params?.categoria;

  return (
    <View style={styles.container}>
      <BotonVolver />
      <View style={styles.card}>
        <Text style={styles.kicker}>Cobro pausado</Text>
        <Text style={styles.title}>Sin pago por adelantado</Text>
        <Text style={styles.body}>
          Por ahora no cobramos registro, creditos ni planes para pedir servicios.
          El único cobro activo es el 10% cuando el cliente confirma un
          presupuesto dentro del chat.
        </Text>
        {!!categoria && (
          <Text style={styles.note}>Categoria seleccionada: {categoria}</Text>
        )}
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.buttonText}>Continuar</Text>
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
  note: {
    marginTop: 14,
    color: "#047a8f",
    fontSize: 13,
    fontWeight: "700",
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
