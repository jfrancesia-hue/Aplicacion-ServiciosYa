import { MaterialIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { recordCurrentLegalAcceptance } from "../lib/legal/acceptance";
import type { MainStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<MainStackParamList, "LegalAcceptance">;

export default function LegalAcceptanceScreen({ navigation }: Props) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const continueToApp = async () => {
    if (!accepted) {
      Alert.alert(
        "Aceptación requerida",
        "Leé y aceptá los términos y la política de privacidad para continuar.",
      );
      return;
    }
    setSaving(true);
    try {
      await recordCurrentLegalAcceptance("account_update");
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch {
      Alert.alert(
        "No se pudo guardar",
        "Intentá nuevamente en unos instantes.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <MaterialIcons name="gavel" size={30} color="#fff" />
        </View>
        <Text style={styles.title}>Actualizamos los documentos legales</Text>
        <Text style={styles.description}>
          La nueva versión incorpora presupuestos, comisión del 10%, chat
          protegido, agenda, urgencias, MICA, reclamos, calificaciones y
          tratamiento de datos.
        </Text>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate("LegalDocument", { document: "terms" })
          }
          style={styles.documentButton}
        >
          <MaterialIcons name="description" size={20} color="#047a8f" />
          <Text style={styles.documentText}>Leer términos y condiciones</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("LegalDocument", { document: "privacy" })
          }
          style={styles.documentButton}
        >
          <MaterialIcons name="privacy-tip" size={20} color="#047a8f" />
          <Text style={styles.documentText}>Leer política de privacidad</Text>
        </TouchableOpacity>

        <View style={styles.acceptRow}>
          <Switch value={accepted} onValueChange={setAccepted} />
          <Text style={styles.acceptText}>
            Leí y acepto ambos documentos vigentes.
          </Text>
        </View>

        <TouchableOpacity
          disabled={saving}
          onPress={() => void continueToApp()}
          style={[
            styles.primaryButton,
            (!accepted || saving) && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Aceptar y continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#eaf7f9",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 22,
    elevation: 5,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#047a8f",
    alignSelf: "center",
  },
  title: {
    color: "#173e46",
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 16,
  },
  description: {
    color: "#50666b",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginVertical: 15,
  },
  documentButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#b7dce1",
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  documentText: {
    color: "#047a8f",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 9,
  },
  acceptRow: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  acceptText: {
    flex: 1,
    color: "#405a60",
    fontSize: 13,
    lineHeight: 19,
    marginLeft: 9,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#07869a",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.5 },
});
