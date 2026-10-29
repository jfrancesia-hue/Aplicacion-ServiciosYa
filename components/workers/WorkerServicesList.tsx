import type React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MaterialIcons } from "@expo/vector-icons";
import { userServiceListQueryOptions } from "../../lib/queryOptions";
import colors from "../../lib/constants/colors";
import type { Servicio } from "../../types/servicios";
import { formatMoney } from "../../lib/utils/money";
import { CategoryIcon } from "../home/CategoryItem";


interface WorkerServicesListProps {
  userId: string;
  onServiceSelected: (service: Servicio) => void;
}

const WorkerServicesList: React.FC<WorkerServicesListProps> = ({
  userId,
  onServiceSelected,
}) => {
  const { data: servicios = [], isLoading } = useQuery(
    userServiceListQueryOptions(userId),
  );

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} />;
  }


  const renderServiceItem = (service: Servicio) => (
    <TouchableOpacity
      key={service.id}
      style={styles.serviceCard}
      onPress={() => onServiceSelected(service)}
      activeOpacity={0.7}
    >
      <View style={styles.serviceImageContainer}>
        <View style={styles.iconWrapper}>
          <CategoryIcon categoria={service.categoria ?? ""} />
        </View>
      </View>

      <View style={styles.serviceInfo}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {service.titulo}
        </Text>
        <Text style={styles.serviceCategory} numberOfLines={1}>
          {service.categoria ?? "Sin categoria"}
        </Text>

        <View style={styles.scheduleContainer}>
          <MaterialIcons
            name="access-time"
            size={12}
            color="#6b7280"
            style={styles.scheduleIcon}
          />
          <Text style={styles.scheduleText} numberOfLines={1}>
            {service.horario ?? "Horario a coordinar"}
          </Text>
        </View>

        <Text style={styles.servicePrice}>{`$ ${formatMoney(service.precio ?? 0)}`}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.servicesSection}>
      <View style={styles.servicesSectionHeader}>
        <Text style={styles.servicesSectionTitle}>Mis publicaciones</Text>
      </View>

      <View style={styles.servicesGrid}>
        {(servicios).map(renderServiceItem)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  servicesSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  servicesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  servicesSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary || "#111827",
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  serviceCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  serviceImageContainer: {
    backgroundColor: "#f3f4f6",
    position: "relative",
    height: 60,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f3f4f6",
  },
  iconWrapper: {
    // width: 50,
    // height: 50,
    padding: 8,
    borderRadius: 22,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  serviceInfo: { padding: 12 },
  serviceName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary || "#111827",
    marginBottom: 4,
  },
  serviceCategory: { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  scheduleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  scheduleIcon: { marginRight: 4 },
  scheduleText: { fontSize: 11, color: "#6b7280", flex: 1 },
  servicePrice: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary || "#3b82f6",
  },
});

export default WorkerServicesList;
