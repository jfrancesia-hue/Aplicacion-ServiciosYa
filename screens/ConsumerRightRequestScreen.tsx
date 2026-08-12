import { MaterialIcons } from "@expo/vector-icons";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

export type ConsumerRightRequestKind = "withdrawal" | "service_cancellation";

type ConsumerRightRoute = RouteProp<
  { ConsumerRightRequest: { requestType: ConsumerRightRequestKind } },
  "ConsumerRightRequest"
>;

export default function ConsumerRightRequestScreen() {
  const navigation = useNavigation();
  const route = useRoute<ConsumerRightRoute>();
  const isWithdrawal = route.params.requestType === "withdrawal";
  const [email, setEmail] = useState("");
  const [operationReference, setOperationReference] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestCode, setRequestCode] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert(
        "Correo inválido",
        "Ingresá el correo asociado a la operación o cuenta.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc(
        "submit_consumer_right_request",
        {
          p_request_type: route.params.requestType,
          p_email: email.trim(),
          p_operation_reference: operationReference.trim() || undefined,
          p_details: details.trim() || undefined,
        },
      );
      if (error) throw error;
      const response = data as { request_code?: unknown } | null;
      setRequestCode(String(response?.request_code ?? ""));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      Alert.alert(
        "No se pudo registrar",
        message.includes("RATE_LIMIT")
          ? "Ya se registraron varias solicitudes para ese correo. Reintentá más tarde o usá soporte."
          : "Revisá los datos e intentá nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isWithdrawal
            ? "Botón de arrepentimiento"
            : "Botón de baja de servicio"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {requestCode ? (
          <View style={styles.successCard}>
            <MaterialIcons name="check-circle" size={52} color="#078b70" />
            <Text style={styles.successTitle}>Solicitud registrada</Text>
            <Text style={styles.successText}>
              Conservá este código. Identifica tu gestión y fue emitido
              inmediatamente.
            </Text>
            <Text selectable style={styles.code}>
              {requestCode}
            </Text>
            <Text style={styles.successText}>
              Podemos contactarte únicamente para verificar identidad, seguridad
              y datos de la operación.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryText}>Volver</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.infoCard}>
              <MaterialIcons name="info-outline" size={22} color="#76541c" />
              <Text style={styles.infoText}>
                {isWithdrawal
                  ? "Podés solicitar la revocación de una contratación a distancia. El análisis considera el plazo legal y si el servicio digital ya fue efectivamente utilizado."
                  : "Podés solicitar la baja de tu cuenta o servicio sin iniciar sesión. La baja no elimina registros que deban conservarse legalmente."}
              </Text>
            </View>

            <Text style={styles.label}>Correo asociado *</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="nombre@correo.com"
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>
              {isWithdrawal
                ? "Referencia de pago u operación"
                : "Usuario o referencia de cuenta"}
            </Text>
            <TextInput
              onChangeText={setOperationReference}
              placeholder="Opcional"
              style={styles.input}
              value={operationReference}
            />

            <Text style={styles.label}>Información adicional</Text>
            <TextInput
              multiline
              maxLength={2000}
              onChangeText={setDetails}
              placeholder="Datos que ayuden a ubicar la operación"
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
              value={details}
            />

            <TouchableOpacity
              disabled={submitting}
              onPress={() => void submit()}
              style={[styles.primaryButton, submitting && styles.disabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Registrar solicitud</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f4fafb" },
  header: {
    minHeight: 72,
    backgroundColor: "#047a8f",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 19,
    fontWeight: "900",
    marginLeft: 12,
  },
  content: { padding: 20, paddingBottom: 42 },
  infoCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff8e9",
    marginBottom: 22,
  },
  infoText: {
    flex: 1,
    color: "#76541c",
    fontSize: 13,
    lineHeight: 19,
    marginLeft: 9,
  },
  label: { color: "#264b52", fontSize: 13, fontWeight: "800", marginBottom: 7 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#b8d7dc",
    borderRadius: 13,
    backgroundColor: "#fff",
    color: "#17383f",
    paddingHorizontal: 13,
    marginBottom: 17,
  },
  textArea: { minHeight: 116, paddingTop: 12 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#07869a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    marginTop: 6,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  successCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "#b9e0d7",
  },
  successTitle: {
    color: "#174f43",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 12,
  },
  successText: {
    color: "#4f6662",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
  },
  code: {
    color: "#047a8f",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
    marginVertical: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#e8f7f8",
  },
});
