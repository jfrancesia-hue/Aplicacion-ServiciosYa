import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { ServiceSystemMessage } from "../../lib/utils/serviceSystemMessage";

type Props = {
  message: ServiceSystemMessage;
};

export default function ServiceSystemBubble({ message }: Props) {
  const isBooking = message.kind === "booking_confirmed";
  const isScheduled = message.kind === "visit_scheduled";
  const isCancellation = [
    "cancellation_requested",
    "cancellation_review",
    "cancellation_rejected",
    "reservation_refunded",
    "refund_failed",
  ].includes(message.kind);
  const isRefunded = message.kind === "reservation_refunded";
  const isUrgent = message.kind === "urgent_request_matched";

  return (
    <View style={styles.outer}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View
            style={[
              styles.iconBox,
              (isScheduled || isRefunded) && styles.iconBoxScheduled,
              isUrgent && styles.iconBoxUrgent,
              isCancellation && !isRefunded && styles.iconBoxCancellation,
            ]}
          >
            <Ionicons
              name={
                isUrgent
                  ? "flash"
                  : isBooking
                  ? "shield-checkmark"
                  : isCancellation
                    ? "receipt-outline"
                    : "calendar-outline"
              }
              size={17}
              color="#fff"
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ESTADO DEL SERVICIO</Text>
            <Text style={styles.title}>{message.title}</Text>
          </View>
          <View style={styles.secureBadge}>
            <Ionicons name="lock-closed" size={11} color="#087989" />
            <Text style={styles.secureBadgeText}>Registrado</Text>
          </View>
        </View>
        <Text style={styles.body}>{message.text}</Text>
        <Text style={styles.hint}>
          Este movimiento quedó registrado por ServiciosYa dentro del chat.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 4,
    marginVertical: 8,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#eaf8fb",
    borderWidth: 1,
    borderColor: "#9bd8df",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#047a8f",
  },
  iconBoxScheduled: {
    backgroundColor: "#12815e",
  },
  iconBoxCancellation: {
    backgroundColor: "#c56a13",
  },
  iconBoxUrgent: {
    backgroundColor: "#d97706",
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: "#087989",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 2,
    color: "#19363d",
    fontSize: 14,
    fontWeight: "900",
  },
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  secureBadgeText: {
    color: "#087989",
    fontSize: 9,
    fontWeight: "900",
  },
  body: {
    marginTop: 12,
    color: "#29444a",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  hint: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "rgba(8,121,137,0.16)",
    color: "#60787c",
    fontSize: 10,
    lineHeight: 14,
  },
});
