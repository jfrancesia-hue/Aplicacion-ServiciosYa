import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  type ServiceJob,
  getMyServiceJobs,
  serviceJobSection,
} from "../../lib/serviceJobs";
import { formatQuoteAmount } from "../../lib/utils/quoteMessage";
import type { MainStackParamList } from "../../types/navigation";

type JobsNavigation = Pick<
  NativeStackNavigationProp<MainStackParamList>,
  "navigate"
>;

type Props = {
  navigation: JobsNavigation;
  compact?: boolean;
};

const sectionConfig = {
  action: {
    title: "Necesitan tu acción",
    icon: "flash-outline" as const,
    color: "#c76b12",
  },
  scheduled: {
    title: "Próximos trabajos",
    icon: "calendar-outline" as const,
    color: "#087d8d",
  },
  coordination: {
    title: "Coordinación pendiente",
    icon: "time-outline" as const,
    color: "#55737a",
  },
  claims: {
    title: "Reclamos",
    icon: "alert-circle-outline" as const,
    color: "#a65a17",
  },
  history: {
    title: "Finalizados",
    icon: "checkmark-done-outline" as const,
    color: "#348064",
  },
};

function actionCopy(job: ServiceJob) {
  if (job.jobStatus === "disputed") {
    return job.incidentCaseNumber
      ? `Caso ${job.incidentCaseNumber}`
      : "Reclamo en revisión";
  }
  if (job.scheduleStatus === "awaiting_provider_options") {
    return job.isProvider
      ? "Proponé hasta tres fechas"
      : "Esperando fechas del prestador";
  }
  if (job.scheduleStatus === "awaiting_selection") {
    return job.scheduleProposedBy === job.counterpartId
      ? "Elegí una de las fechas propuestas"
      : "Esperando que elijan una fecha";
  }
  if (job.scheduleStatus === "scheduled" && job.scheduledStart) {
    if (job.canClose) return "El trabajo ya puede cerrarse y calificarse";
    return new Date(job.scheduledStart).toLocaleString("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (job.jobStatus === "completed") {
    return job.reviewRating
      ? `Calificación: ${job.reviewRating}/5`
      : "Trabajo finalizado";
  }
  return "Abrí el chat para continuar";
}

function JobCard({
  job,
  navigation,
}: {
  job: ServiceJob;
  navigation: JobsNavigation;
}) {
  const section = serviceJobSection(job);
  const config = sectionConfig[section];

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={[styles.jobCard, job.requiresAction && styles.jobCardAction]}
      onPress={() =>
        navigation.navigate("ChatIndividual", {
          chatId: job.chatId,
          nombre: job.counterpartName,
          servicio: {
            titulo: job.title,
            descripcion: job.description,
            precio: job.amountTotal,
          },
          servicioId: job.paymentRecordId,
          usuarioId1: job.payerId,
          usuarioId2: job.providerId,
        })
      }
    >
      <View style={[styles.jobIcon, { backgroundColor: `${config.color}18` }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>
      <View style={styles.jobCopy}>
        <View style={styles.jobTitleRow}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {job.title}
          </Text>
          {job.requiresAction ? <View style={styles.actionDot} /> : null}
        </View>
        <Text style={styles.counterpart} numberOfLines={1}>
          {job.isProvider ? "Cliente" : "Prestador"}: {job.counterpartName}
        </Text>
        <Text
          style={[styles.jobStatus, { color: config.color }]}
          numberOfLines={2}
        >
          {actionCopy(job)}
        </Text>
      </View>
      <View style={styles.jobRight}>
        <Text style={styles.amount}>{formatQuoteAmount(job.amountTotal)}</Text>
        <Ionicons name="chevron-forward" size={18} color="#8ba0a5" />
      </View>
    </TouchableOpacity>
  );
}

export default function JobsOverview({ navigation, compact = false }: Props) {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setJobs(await getMyServiceJobs());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los trabajos.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const groups = new Map<keyof typeof sectionConfig, ServiceJob[]>();
    for (const job of jobs) {
      const section = serviceJobSection(job);
      groups.set(section, [...(groups.get(section) ?? []), job]);
    }
    return groups;
  }, [jobs]);

  const compactJobs = useMemo(
    () =>
      jobs
        .filter((job) =>
          ["action", "scheduled", "coordination"].includes(
            serviceJobSection(job),
          ),
        )
        .slice(0, 5),
    [jobs],
  );

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color="#087d8d" />
        <Text style={styles.centerText}>Cargando trabajos...</Text>
      </View>
    );
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <View>
            <Text style={styles.compactEyebrow}>AGENDA OPERATIVA</Text>
            <Text style={styles.compactTitle}>Tus próximos trabajos</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("TrabajosPendientes")}
          >
            <Text style={styles.viewAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {compactJobs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-clear-outline" size={27} color="#86a0a6" />
            <Text style={styles.emptyTitle}>No hay trabajos pendientes</Text>
            <Text style={styles.emptyText}>
              Las contrataciones confirmadas aparecerán acá.
            </Text>
          </View>
        ) : (
          compactJobs.map((job) => (
            <JobCard
              key={job.paymentRecordId}
              job={job}
              navigation={navigation}
            />
          ))
        )}
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.fullContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          colors={["#087d8d"]}
        />
      }
    >
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {jobs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="briefcase-outline" size={34} color="#86a0a6" />
          <Text style={styles.emptyTitle}>
            Todavía no hay trabajos confirmados
          </Text>
          <Text style={styles.emptyText}>
            Cuando se acepte un presupuesto y se pague la comisión, aparecerá en
            este panel.
          </Text>
        </View>
      ) : (
        (Object.keys(sectionConfig) as Array<keyof typeof sectionConfig>).map(
          (section) => {
            const sectionJobs = grouped.get(section) ?? [];
            if (sectionJobs.length === 0) return null;
            const config = sectionConfig[section];
            return (
              <View key={section} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name={config.icon} size={18} color={config.color} />
                  <Text style={styles.sectionTitle}>{config.title}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{sectionJobs.length}</Text>
                  </View>
                </View>
                {sectionJobs.map((job) => (
                  <JobCard
                    key={job.paymentRecordId}
                    job={job}
                    navigation={navigation}
                  />
                ))}
              </View>
            );
          },
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  compactContainer: { paddingHorizontal: 2 },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  compactEyebrow: {
    color: "#087d8d",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  compactTitle: {
    color: "#17383f",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  viewAll: { color: "#087d8d", fontSize: 12, fontWeight: "900" },
  fullContent: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 22 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 9,
  },
  sectionTitle: { color: "#294b52", fontSize: 15, fontWeight: "900" },
  countBadge: {
    minWidth: 23,
    height: 23,
    borderRadius: 8,
    backgroundColor: "#e5f3f5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  countText: { color: "#087d8d", fontSize: 10, fontWeight: "900" },
  jobCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce7e9",
    padding: 11,
    marginBottom: 8,
  },
  jobCardAction: { borderColor: "#efc68e", backgroundColor: "#fffaf2" },
  jobIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  jobCopy: { flex: 1 },
  jobTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  jobTitle: {
    flexShrink: 1,
    color: "#17383f",
    fontSize: 14,
    fontWeight: "900",
  },
  actionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ef8b24",
  },
  counterpart: { color: "#71868b", fontSize: 10, marginTop: 2 },
  jobStatus: { fontSize: 11, fontWeight: "800", marginTop: 4, lineHeight: 15 },
  jobRight: { alignItems: "flex-end", gap: 6 },
  amount: { color: "#365b63", fontSize: 11, fontWeight: "800" },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  centerText: { color: "#70878c", fontSize: 12 },
  errorText: {
    color: "#a33f3f",
    backgroundColor: "#fff0f0",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 12,
  },
  emptyBox: {
    alignItems: "center",
    padding: 28,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e9eb",
  },
  emptyTitle: {
    color: "#415e65",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    color: "#788d92",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    textAlign: "center",
  },
});
