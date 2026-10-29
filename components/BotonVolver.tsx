import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const BotonVolver = ({ texto = "Volver" }: { texto?: string }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.contenedor}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={texto}
        style={styles.boton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={20} color="#4A7C84" />
        <Text style={styles.texto}>{texto}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    alignSelf: "flex-start",
    marginTop: 8,
    marginLeft: 12,
    marginBottom: 8,
    zIndex: 5,
  },
  boton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  texto: {
    marginLeft: 6,
    color: "#4A7C84",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default BotonVolver;
