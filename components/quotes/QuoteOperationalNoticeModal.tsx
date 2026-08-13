import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { calculateServiceConfirmationFee } from "../../lib/constants/billing";
import type { MainStackParamList } from "../../types/navigation";

type Props = {
  visible: boolean;
  mode: "send" | "accept";
  amount: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

const formatMoney = (amount: number) =>
  `$${Math.round(amount).toLocaleString("es-AR")}`;

export default function QuoteOperationalNoticeModal({
  visible,
  mode,
  amount,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const isAccept = mode === "accept";
  const fee = calculateServiceConfirmationFee(amount);
  const items = isAccept
    ? [
        `Al continuar pagás ${formatMoney(fee)}, equivalente al 10% del presupuesto, como comisión de conexión y confirmación.`,
        "Ese pago no es un adelanto del trabajo. El importe restante se acuerda y paga directamente entre cliente y prestador.",
        "Podés volver al chat para conversar alcance, materiales, precio o disponibilidad antes de aceptar.",
        "Después del pago, el prestador propone hasta tres fechas y la coordinación, el cierre o un reclamo quedan registrados en la app.",
      ]
    : [
        `El total de referencia informado es ${formatMoney(amount)} y sobre ese monto se calcula la comisión de conexión del 10% para el cliente.`,
        "La comisión no es un adelanto del trabajo. El cobro del servicio y cualquier diferencia final se coordinan entre las partes.",
        "El cliente puede conversar y pedir cambios antes de aceptar; enviá un alcance, disponibilidad y condiciones que realmente puedas cumplir.",
        "Si el cliente confirma, deberás proponer hasta tres fechas y responder por la ejecución del servicio acordado.",
      ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <MaterialIcons
                name={isAccept ? "verified-user" : "fact-check"}
                size={24}
                color="#fff"
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>RESUMEN OPERATIVO</Text>
              <Text style={styles.title}>
                {isAccept ? "Antes de aceptar y pagar" : "Antes de enviar"}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => (
              <View key={item} style={styles.item}>
                <MaterialIcons name="check-circle" size={19} color="#07869a" />
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
            <View style={styles.scopeBox}>
              <MaterialIcons name="info-outline" size={19} color="#76541c" />
              <Text style={styles.scopeText}>
                Servicios Ya facilita el contacto, la comisión, la agenda y el
                canal de reclamos. El trabajo es ejecutado por el prestador.
                Este resumen no reemplaza los términos y condiciones aplicables.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="link"
              disabled={busy}
              onPress={() =>
                navigation.navigate("LegalDocument", { document: "terms" })
              }
              style={styles.legalLink}
            >
              <MaterialIcons name="open-in-new" size={16} color="#047a8f" />
              <Text style={styles.legalLinkText}>
                Ver términos y condiciones vigentes
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              disabled={busy}
              onPress={onClose}
            >
              <Text style={styles.secondaryText}>
                {isAccept ? "Seguir conversando" : "Revisar presupuesto"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void onConfirm()}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryText}>
                  {isAccept ? "Aceptar e ir al pago" : "Entiendo y enviar"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8, 25, 31, 0.62)",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 460,
    maxHeight: "88%",
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 18,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#07869a",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, marginLeft: 12 },
  eyebrow: {
    color: "#07869a",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: { color: "#17383f", fontSize: 20, fontWeight: "900", marginTop: 2 },
  scroll: { flexGrow: 0 },
  item: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  itemText: {
    flex: 1,
    marginLeft: 9,
    color: "#35535a",
    fontSize: 14,
    lineHeight: 20,
  },
  scopeBox: {
    flexDirection: "row",
    backgroundColor: "#fff8e9",
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
  },
  scopeText: {
    flex: 1,
    marginLeft: 8,
    color: "#76541c",
    fontSize: 12,
    lineHeight: 17,
  },
  legalLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    marginTop: 7,
  },
  legalLinkText: {
    color: "#047a8f",
    fontSize: 12,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  actions: { marginTop: 16, gap: 9 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#07869a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#b9d7dc",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryText: { color: "#496a71", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.55 },
});
