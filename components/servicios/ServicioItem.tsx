import { Pressable, Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Servicio } from "../../types/servicios";
import { formatMoney } from "../../lib/utils/money";
import type { WorkerStatus } from "../../types/worker";
import WorkerStatusBadge from "../workers/WorkerStatusBadge";

const colors = {
  primary: "#00B8A9",
  primaryLight: "#5DD0C5",
  primaryLighter: "#A0E6DF",
  primaryDark: "#00897B",
  secondary: "#FFA13C",
  secondaryLight: "#FFB96A",
  secondaryLighter: "#FFD4A8",
  gray: "#767577",
  lightGray: "#F5F5F5",
  darkGray: "#3E3E3E",
  textPrimary: "#1A1A1A",
  textSecondary: "#5E5E5E",
  background: "#FFFFFF",
  success: "#4CAF50",
  online: "#4CAF50",
  // Added colors for the online state
  onlineBackground: "#19D4C6", // Dark Turquoise
  textOnline: "#FFFFFF",
};

interface ServicioItemProps {
  servicio: Servicio;
  workerStatus?: WorkerStatus;
  onPress?: (servicioId: number) => void;
}

export default function ServicioItem({
  servicio,
  workerStatus = "OFFLINE",
  onPress,
}: ServicioItemProps) {
  // Determine if the worker is online to apply conditional styles
  const isOnline = workerStatus === "ONLINE";

  // Define the style overrides for the online state
  const onlineCardStyle = { backgroundColor: colors.onlineBackground };
  const onlineTextStyle = { color: colors.textOnline };
  const onlineFooterStyle = { borderTopColor: "rgba(255, 255, 255, 0.25)" };

  return (
    <Pressable
      style={[styles.card, isOnline && onlineCardStyle]}
      onPress={() => onPress?.(servicio.id)}
    >
      {/* Header with title, category, and online status */}
      <View style={styles.cardHeader}>
        <View style={styles.titleSection}>
          <Text
            style={[styles.cardTitle, isOnline && onlineTextStyle]}
            numberOfLines={1}
          >
            {servicio.titulo}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.categoryText, isOnline && onlineTextStyle]}>
              {servicio.categoria}
            </Text>

            <Text
              style={[styles.workerName, isOnline && onlineTextStyle]}
              numberOfLines={1}
            >
              {servicio.nombre ?? ""}
            </Text>

            {workerStatus !== "OFFLINE" && (
              <WorkerStatusBadge status={workerStatus} />
            )}
          </View>
        </View>
      </View>

      {/* Description */}
      <Text
        style={[styles.cardDescription, isOnline && onlineTextStyle]}
        numberOfLines={2}
      >
        {servicio.descripcion}
      </Text>

      {/* Footer with details and actions */}
      <View style={[styles.cardFooter, isOnline && onlineFooterStyle]}>
        <View style={styles.detailsContainer}>
          <View style={styles.detailItem}>
            <Feather
              name="dollar-sign"
              size={14}
              color={isOnline ? colors.textOnline : colors.secondary}
            />
            <Text style={[styles.priceText, isOnline && onlineTextStyle]}>
              {formatMoney(servicio.precio ?? 0)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Feather
              name="clock"
              size={14}
              color={isOnline ? colors.textOnline : colors.gray}
            />
            <Text style={[styles.detailText, isOnline && onlineTextStyle]}>
              {servicio.horario}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  titleSection: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  onlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  onlineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  onlineText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    paddingTop: 12,
    marginTop: 4,
  },
  detailsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
    justifyContent: "space-between",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.secondary,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryLighter,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonPressed: {
    backgroundColor: colors.primaryLighter,
    borderColor: colors.primary,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    gap: 6,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  workerName: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 1,          // lets it truncate if needed
    marginHorizontal: 6,
  },
});
