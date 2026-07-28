import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { MicaSystemMessage } from "../../lib/utils/micaMessage";

type Props = {
  message: MicaSystemMessage;
};

export default function MicaSystemBubble({ message }: Props) {
  const isHandoff = message.kind === "handoff";

  return (
    <View style={styles.outer}>
      <View style={[styles.card, isHandoff && styles.handoffCard]}>
        <View style={styles.header}>
          <View style={[styles.iconBox, isHandoff && styles.handoffIconBox]}>
            <Ionicons
              name={isHandoff ? "git-merge-outline" : "sparkles"}
              size={17}
              color="#fff"
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>INTERMEDIACIÓN TOORI</Text>
            <Text style={styles.title}>{message.title}</Text>
          </View>
          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#087989" />
            <Text style={styles.secureBadgeText}>Interno</Text>
          </View>
        </View>
        <Text style={styles.body}>{message.text}</Text>
        <Text style={styles.hint}>
          MICA organiza la conversación; cliente y prestador confirman siempre
          los acuerdos.
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
    backgroundColor: "#e8fbf8",
    borderWidth: 1,
    borderColor: "#9bded5",
  },
  handoffCard: {
    backgroundColor: "#fff8ed",
    borderColor: "#f2c98e",
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
    backgroundColor: "#069eb3",
  },
  handoffIconBox: {
    backgroundColor: "#e47d12",
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
