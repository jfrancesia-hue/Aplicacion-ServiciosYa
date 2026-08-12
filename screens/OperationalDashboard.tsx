import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BotonVolver from "../components/BotonVolver";
import { useSuspenseProfile } from "../lib/hooks/useUser";
import { supabase } from "../lib/supabase";

type DashboardSummary = {
  generatedAt: string;
  periodDays: number;
  counts: {
    providers: number;
    campaignProfiles: number;
    availableNow: number;
    chatsInPeriod: number;
    messagesLast24Hours: number;
    openReports: number;
    reviewsInPeriod: number;
    measuredResponseProviders: number;
    averageResponseMinutes: number | null;
  };
  payments: {
    approved: number;
    pending: number;
    failed: number;
    completed: number;
    disputed: number;
  };
  funnel: Array<{
    eventName: string;
    label: string;
    events: number;
    users: number;
  }>;
  issues: Array<{
    eventName: string;
    label: string;
    count: number;
  }>;
  provinces: Array<{
    province: string;
    count: number;
  }>;
};

type ModerationReport = {
  id: string;
  source: "profile" | "service" | "incident";
  provider_id: string;
  reason_category: string;
  details: string | null;
  status:
    | "pending"
    | "mica_intake"
    | "escalated"
    | "reviewing"
    | "resolved"
    | "dismissed";
  service_id: number | null;
  created_at: string;
  providerName: string;
  providerLocation: string;
  case_number?: string;
  chat_id?: string;
  payment_record_id?: string;
};

type ConsumerRightRequest = {
  id: string;
  request_code: string;
  request_type: "withdrawal" | "service_cancellation";
  email: string;
  operation_reference: string | null;
  details: string | null;
  status: "received" | "reviewing" | "completed" | "rejected";
  created_at: string;
};

type UrgencyPolicy = {
  slaMinutes: number;
  reminderMinutes: number;
  maxReassignments: number;
  enforcementEnabled: boolean;
  missedThreshold: number;
  windowDays: number;
  prioritySuspensionDays: number;
  recurrenceWindowDays: number;
  secondSuspensionDays: number;
  subsequentSuspensionDays: number;
  enforcementStartedAt: string | null;
  updatedAt: string;
};

type UrgencyPolicyResponse = {
  policy: UrgencyPolicy;
  metrics: {
    missesInWindow: number;
    activeSuspensions: number;
  };
};

type NotificationHealth = {
  providers: {
    emailConfigured: boolean;
    pushAccessTokenConfigured: boolean;
  };
  outbox: {
    waitingEmail: number;
    pendingEmail: number;
    failedEmail: number;
    sentEmail: number;
    failedPush: number;
  };
};

type UrgencyPolicyDraft = {
  maxReassignments: string;
};

function policyToDraft(policy: UrgencyPolicy): UrgencyPolicyDraft {
  return {
    maxReassignments: String(policy.maxReassignments),
  };
}

const REPORT_REASON_LABELS: Record<string, string> = {
  inappropriate_content: "Contenido inapropiado",
  false_information: "Información falsa",
  spam: "Spam",
  potential_scam: "Posible estafa",
  security_issue: "Problema de seguridad",
  other: "Otro motivo",
  provider_no_show: "Prestador no se presentó",
  work_not_completed: "Trabajo no realizado",
};

const PERIODS = [7, 30, 90] as const;

function formatCount(value?: number | null) {
  return Math.max(0, Number(value ?? 0)).toLocaleString("es-AR");
}

function formatMinutes(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "Sin muestra";
  if (value < 60) return `~${Math.max(1, Math.round(value))} min`;
  if (value < 24 * 60) return `~${Math.round(value / 60)} h`;
  return `~${Math.round(value / (24 * 60))} días`;
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "teal",
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  detail: string;
  tone?: "teal" | "green" | "orange" | "red";
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, styles[`metricIcon_${tone}`]]}>
        <Ionicons
          name={icon}
          size={19}
          color={tone === "teal" ? "#047a8f" : "#fff"}
        />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color="#047a8f" />
      </View>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function PolicyNumberField({
  label,
  helper,
  value,
  onChangeText,
}: {
  label: string;
  helper: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.policyField}>
      <View style={styles.policyFieldCopy}>
        <Text style={styles.policyFieldLabel}>{label}</Text>
        <Text style={styles.policyFieldHelper}>{helper}</Text>
      </View>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        maxLength={3}
        onChangeText={(value) => onChangeText(value.replace(/\D/g, ""))}
        selectTextOnFocus
        style={styles.policyInput}
        value={value}
      />
    </View>
  );
}

export default function OperationalDashboard() {
  const { rol } = useSuspenseProfile();
  const [periodDays, setPeriodDays] = useState<(typeof PERIODS)[number]>(30);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [consumerRequests, setConsumerRequests] = useState<
    ConsumerRightRequest[]
  >([]);
  const [urgency, setUrgency] = useState<UrgencyPolicyResponse | null>(null);
  const [notificationHealth, setNotificationHealth] =
    useState<NotificationHealth | null>(null);
  const [urgencyDraft, setUrgencyDraft] = useState<UrgencyPolicyDraft | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [savingUrgency, setSavingUrgency] = useState(false);

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (rol !== "admin") {
        setErrorMessage("Esta sección es exclusiva para administradores.");
        setLoading(false);
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setErrorMessage(null);
      try {
        const [
          summaryResult,
          reportsResult,
          urgencyResult,
          notificationResult,
          consumerRequestsResult,
        ] = await Promise.all([
          supabase.functions.invoke("operational-dashboard", {
            body: { action: "summary", days: periodDays },
          }),
          supabase.functions.invoke("operational-dashboard", {
            body: { action: "reports" },
          }),
          supabase.functions.invoke("operational-dashboard", {
            body: { action: "urgency-policy" },
          }),
          supabase.functions.invoke("operational-dashboard", {
            body: { action: "notification-health" },
          }),
          supabase.functions.invoke("operational-dashboard", {
            body: { action: "consumer-right-requests" },
          }),
        ]);

        if (summaryResult.error || summaryResult.data?.error) {
          throw new Error(
            summaryResult.data?.error ||
              summaryResult.error?.message ||
              "No se pudo cargar el resumen.",
          );
        }
        if (reportsResult.error || reportsResult.data?.error) {
          throw new Error(
            reportsResult.data?.error ||
              reportsResult.error?.message ||
              "No se pudo cargar la moderación.",
          );
        }
        if (urgencyResult.error || urgencyResult.data?.error) {
          throw new Error(
            urgencyResult.data?.error ||
              urgencyResult.error?.message ||
              "No se pudo cargar la política de urgencias.",
          );
        }
        if (notificationResult.error || notificationResult.data?.error) {
          throw new Error(
            notificationResult.data?.error ||
              notificationResult.error?.message ||
              "No se pudo cargar el estado de notificaciones.",
          );
        }
        if (
          consumerRequestsResult.error ||
          consumerRequestsResult.data?.error
        ) {
          throw new Error(
            consumerRequestsResult.data?.error ||
              consumerRequestsResult.error?.message ||
              "No se pudieron cargar las solicitudes de consumidores.",
          );
        }

        setSummary(summaryResult.data as DashboardSummary);
        setReports((reportsResult.data?.reports ?? []) as ModerationReport[]);
        const nextUrgency = urgencyResult.data as UrgencyPolicyResponse;
        setUrgency(nextUrgency);
        setUrgencyDraft(policyToDraft(nextUrgency.policy));
        setNotificationHealth(notificationResult.data as NotificationHealth);
        setConsumerRequests(
          (consumerRequestsResult.data?.requests ??
            []) as ConsumerRightRequest[],
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el panel operativo.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [periodDays, rol],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const maxFunnelUsers = useMemo(
    () => Math.max(1, ...(summary?.funnel.map((step) => step.users) ?? [1])),
    [summary],
  );

  const maxProvinceCount = useMemo(
    () =>
      Math.max(
        1,
        ...(summary?.provinces.map((province) => province.count) ?? [1]),
      ),
    [summary],
  );

  const updateReport = useCallback(
    async (report: ModerationReport, status: ModerationReport["status"]) => {
      setUpdatingReportId(report.id);
      try {
        const { data, error } = await supabase.functions.invoke(
          "operational-dashboard",
          {
            body: {
              action: "update-report",
              reportId: report.id,
              status,
              source: report.source,
            },
          },
        );
        if (error || data?.error) {
          throw new Error(
            data?.error ||
              error?.message ||
              "No se pudo actualizar el reporte.",
          );
        }

        if (status === "resolved" || status === "dismissed") {
          setReports((current) =>
            current.filter((item) => item.id !== report.id),
          );
        } else {
          setReports((current) =>
            current.map((item) =>
              item.id === report.id ? { ...item, status } : item,
            ),
          );
        }
      } catch (error) {
        Alert.alert(
          "No se pudo actualizar",
          error instanceof Error ? error.message : "Intentá nuevamente.",
        );
      } finally {
        setUpdatingReportId(null);
      }
    },
    [],
  );

  const confirmReportUpdate = useCallback(
    (
      report: ModerationReport,
      status: ModerationReport["status"],
      title: string,
      message: string,
    ) => {
      Alert.alert(title, message, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          style: status === "dismissed" ? "destructive" : "default",
          onPress: () => void updateReport(report, status),
        },
      ]);
    },
    [updateReport],
  );

  const updateConsumerRequest = useCallback(
    async (
      request: ConsumerRightRequest,
      status: "reviewing" | "completed" | "rejected",
    ) => {
      setUpdatingReportId(request.id);
      try {
        const { data, error } = await supabase.functions.invoke(
          "operational-dashboard",
          {
            body: {
              action: "update-consumer-right-request",
              requestId: request.id,
              status,
            },
          },
        );
        if (error || data?.error) {
          throw new Error(
            data?.error ||
              error?.message ||
              "No se pudo actualizar la solicitud.",
          );
        }
        if (status === "completed" || status === "rejected") {
          setConsumerRequests((current) =>
            current.filter((item) => item.id !== request.id),
          );
        } else {
          setConsumerRequests((current) =>
            current.map((item) =>
              item.id === request.id ? { ...item, status } : item,
            ),
          );
        }
      } catch (error) {
        Alert.alert(
          "No se pudo actualizar",
          error instanceof Error ? error.message : "Intentá nuevamente.",
        );
      } finally {
        setUpdatingReportId(null);
      }
    },
    [],
  );

  const updateUrgencyDraft = useCallback(
    (field: keyof UrgencyPolicyDraft, value: string) => {
      setUrgencyDraft((current) =>
        current ? { ...current, [field]: value } : current,
      );
    },
    [],
  );

  const persistUrgencyPolicy = useCallback(
    async (draft: UrgencyPolicyDraft) => {
      setSavingUrgency(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "operational-dashboard",
          {
            body: {
              action: "update-urgency-policy",
              enforcementEnabled: true,
              maxReassignments: Number(draft.maxReassignments),
              missedThreshold: 3,
              windowDays: 30,
              prioritySuspensionDays: 7,
            },
          },
        );
        if (error || data?.error) {
          throw new Error(
            data?.error ||
              error?.message ||
              "No se pudo guardar la política de urgencias.",
          );
        }

        const nextUrgency = data as UrgencyPolicyResponse;
        setUrgency(nextUrgency);
        setUrgencyDraft(policyToDraft(nextUrgency.policy));
        Alert.alert(
          "Reasignaciones guardadas",
          "La política A continúa activa y el cambio operativo fue auditado.",
        );
      } catch (error) {
        Alert.alert(
          "No se pudo guardar",
          error instanceof Error ? error.message : "Intentá nuevamente.",
        );
      } finally {
        setSavingUrgency(false);
      }
    },
    [],
  );

  const confirmUrgencyPolicy = useCallback(() => {
    if (!urgencyDraft) return;
    const entries = [
      ["reasignaciones", urgencyDraft.maxReassignments, 0, 10],
    ] as const;
    const invalid = entries.find(([, value, minimum, maximum]) => {
      const parsed = Number(value);
      return !Number.isInteger(parsed) || parsed < minimum || parsed > maximum;
    });
    if (invalid) {
      Alert.alert(
        "Revisá la configuración",
        `El valor de ${invalid[0]} debe estar entre ${invalid[2]} y ${invalid[3]}.`,
      );
      return;
    }

    Alert.alert(
      "Guardar reasignaciones",
      `El sistema podrá intentar hasta ${urgencyDraft.maxReassignments} prestadores alternativos. La política A continúa activa: 3 incumplimientos en 30 días y suspensiones progresivas de 7, 14 y 30 días.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Guardar política",
          onPress: () => void persistUrgencyPolicy(urgencyDraft),
        },
      ],
    );
  }, [persistUrgencyPolicy, urgencyDraft]);

  return (
    <View style={styles.screen}>
      <BotonVolver />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDashboard(true)}
            colors={["#069eb3"]}
            tintColor="#069eb3"
          />
        }
      >
        <LinearGradient
          colors={["#063b45", "#047a8f", "#069eb3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroEyebrow}>
            <Ionicons name="pulse" size={14} color="#baf6ed" />
            <Text style={styles.heroEyebrowText}>OPERACIÓN EN TIEMPO REAL</Text>
          </View>
          <Text style={styles.heroTitle}>Panel de Servicios Ya</Text>
          <Text style={styles.heroSubtitle}>
            Prestadores, conversaciones, pagos y confianza en una sola vista.
          </Text>
          <View style={styles.periodRow}>
            {PERIODS.map((period) => (
              <TouchableOpacity
                key={period}
                activeOpacity={0.78}
                onPress={() => setPeriodDays(period)}
                style={[
                  styles.periodButton,
                  periodDays === period && styles.periodButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    periodDays === period && styles.periodButtonTextActive,
                  ]}
                >
                  {period} días
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {summary?.generatedAt ? (
            <Text style={styles.updatedAt}>
              Actualizado{" "}
              {new Intl.DateTimeFormat("es-AR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(summary.generatedAt))}
            </Text>
          ) : null}
        </LinearGradient>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#069eb3" />
            <Text style={styles.stateTitle}>Armando el panorama operativo</Text>
            <Text style={styles.stateText}>
              Estamos leyendo únicamente métricas agregadas y reportes.
            </Text>
          </View>
        ) : errorMessage ? (
          <View style={[styles.stateCard, styles.errorCard]}>
            <Ionicons name="alert-circle-outline" size={36} color="#b5473d" />
            <Text style={styles.errorTitle}>No pudimos cargar el panel</Text>
            <Text style={styles.stateText}>{errorMessage}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => void loadDashboard()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : summary ? (
          <>
            <View style={styles.metricGrid}>
              <MetricCard
                icon="people-outline"
                label="Prestadores"
                value={formatCount(summary.counts.providers)}
                detail={`${formatCount(summary.counts.campaignProfiles)} perfiles históricos conservados`}
              />
              <MetricCard
                icon="flash"
                label="Disponibles ahora"
                value={formatCount(summary.counts.availableNow)}
                detail="Ventana vigente o actividad reciente"
                tone="green"
              />
              <MetricCard
                icon="chatbubbles-outline"
                label="Chats activos"
                value={formatCount(summary.counts.chatsInPeriod)}
                detail={`${formatCount(summary.counts.messagesLast24Hours)} mensajes en 24 h`}
                tone="orange"
              />
              <MetricCard
                icon="shield-checkmark-outline"
                label="Reportes abiertos"
                value={formatCount(summary.counts.openReports)}
                detail="Pendientes o en revisión"
                tone={summary.counts.openReports > 0 ? "red" : "teal"}
              />
            </View>

            <View style={styles.section}>
              <SectionHeader
                icon="git-commit-outline"
                title="Embudo del marketplace"
                subtitle={`Usuarios únicos durante los últimos ${summary.periodDays} días`}
              />
              <View style={styles.funnelList}>
                {summary.funnel.map((step, index) => (
                  <View key={step.eventName} style={styles.funnelRow}>
                    <View style={styles.funnelIndex}>
                      <Text style={styles.funnelIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.funnelCopy}>
                      <View style={styles.funnelLabelRow}>
                        <Text style={styles.funnelLabel}>{step.label}</Text>
                        <Text style={styles.funnelValue}>
                          {formatCount(step.users)}
                        </Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.max(
                                step.users > 0 ? 5 : 0,
                                (step.users / maxFunnelUsers) * 100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.funnelEvents}>
                        {formatCount(step.events)} eventos
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader
                icon="card-outline"
                title="Trabajos y pagos"
                subtitle="Los trabajos terminados provienen de pagos confirmados"
              />
              <View style={styles.paymentGrid}>
                <View style={styles.paymentMetric}>
                  <Text style={styles.paymentValue}>
                    {formatCount(summary.payments.approved)}
                  </Text>
                  <Text style={styles.paymentLabel}>Confirmados</Text>
                </View>
                <View style={styles.paymentMetric}>
                  <Text style={styles.paymentValue}>
                    {formatCount(summary.payments.completed)}
                  </Text>
                  <Text style={styles.paymentLabel}>Terminados</Text>
                </View>
                <View style={styles.paymentMetric}>
                  <Text style={styles.paymentValue}>
                    {formatCount(summary.payments.pending)}
                  </Text>
                  <Text style={styles.paymentLabel}>Pendientes</Text>
                </View>
                <View style={styles.paymentMetric}>
                  <Text
                    style={[
                      styles.paymentValue,
                      summary.payments.failed > 0 && styles.paymentValueAlert,
                    ]}
                  >
                    {formatCount(summary.payments.failed)}
                  </Text>
                  <Text style={styles.paymentLabel}>Con error</Text>
                </View>
              </View>
              <View style={styles.trustStrip}>
                <View style={styles.trustItem}>
                  <Ionicons name="star" size={18} color="#e8a317" />
                  <View>
                    <Text style={styles.trustValue}>
                      {formatCount(summary.counts.reviewsInPeriod)}
                    </Text>
                    <Text style={styles.trustLabel}>
                      Calificaciones verificadas
                    </Text>
                  </View>
                </View>
                <View style={styles.trustItem}>
                  <Ionicons name="time-outline" size={18} color="#047a8f" />
                  <View>
                    <Text style={styles.trustValue}>
                      {formatMinutes(summary.counts.averageResponseMinutes)}
                    </Text>
                    <Text style={styles.trustLabel}>
                      Respuesta con muestra suficiente
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader
                icon="fitness-outline"
                title="Salud de los flujos"
                subtitle="Errores registrados desde esta versión de la app"
              />
              <View style={styles.issueList}>
                {summary.issues.map((issue) => {
                  const hasIssue = issue.count > 0;
                  return (
                    <View key={issue.eventName} style={styles.issueRow}>
                      <View
                        style={[
                          styles.issueIndicator,
                          hasIssue && styles.issueIndicatorAlert,
                        ]}
                      >
                        <Ionicons
                          name={hasIssue ? "warning-outline" : "checkmark"}
                          size={15}
                          color={hasIssue ? "#a43b32" : "#12815e"}
                        />
                      </View>
                      <Text style={styles.issueLabel}>{issue.label}</Text>
                      <Text
                        style={[
                          styles.issueValue,
                          hasIssue && styles.issueValueAlert,
                        ]}
                      >
                        {formatCount(issue.count)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader
                icon="location-outline"
                title="Cobertura por provincia"
                subtitle="Perfiles registrados como prestadores"
              />
              {summary.provinces.length === 0 ? (
                <Text style={styles.emptyText}>
                  Todavía no hay datos de zona.
                </Text>
              ) : (
                summary.provinces.map((province) => (
                  <View key={province.province} style={styles.provinceRow}>
                    <View style={styles.provinceLabelRow}>
                      <Text style={styles.provinceLabel}>
                        {province.province}
                      </Text>
                      <Text style={styles.provinceValue}>
                        {formatCount(province.count)}
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.provinceBar,
                          {
                            width: `${Math.max(
                              5,
                              (province.count / maxProvinceCount) * 100,
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>

            {urgency && urgencyDraft ? (
              <View style={styles.section}>
                <SectionHeader
                  icon="timer-outline"
                  title="Urgencias y disciplina"
                  subtitle="SLA fijo de 20 minutos, reasignación y pérdida temporal de prioridad"
                />
                <View style={styles.policyStatusRow}>
                  <View
                    style={[
                      styles.policyStatusIcon,
                      styles.policyStatusIconEnabled,
                    ]}
                  >
                    <Ionicons name="shield-checkmark" size={21} color="#fff" />
                  </View>
                  <View style={styles.policyStatusCopy}>
                    <Text style={styles.policyStatusTitle}>
                      Disciplina automática
                    </Text>
                    <Text style={styles.policyStatusText}>
                      Activa desde la confirmación de la política A.
                    </Text>
                  </View>
                </View>

                <View style={styles.policyMetricsRow}>
                  <View style={styles.policyMetric}>
                    <Text style={styles.policyMetricValue}>
                      {formatCount(urgency.metrics.missesInWindow)}
                    </Text>
                    <Text style={styles.policyMetricLabel}>
                      Incumplimientos en {urgency.policy.windowDays} días
                    </Text>
                  </View>
                  <View style={styles.policyMetric}>
                    <Text style={styles.policyMetricValue}>
                      {formatCount(urgency.metrics.activeSuspensions)}
                    </Text>
                    <Text style={styles.policyMetricLabel}>
                      Suspensiones activas
                    </Text>
                  </View>
                </View>

                <View style={styles.policyFixedRow}>
                  <Ionicons name="alarm-outline" size={18} color="#047a8f" />
                  <Text style={styles.policyFixedText}>
                    Recordatorio a los {urgency.policy.reminderMinutes} min ·
                    vencimiento a los {urgency.policy.slaMinutes} min
                  </Text>
                </View>

                <View style={styles.policyFixedRow}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="#047a8f"
                  />
                  <Text style={styles.policyFixedText}>
                    3 incumplimientos en 30 días · suspensión inicial de 7 días
                  </Text>
                </View>

                <View style={styles.policyFixedRow}>
                  <Ionicons
                    name="trending-up-outline"
                    size={18}
                    color="#047a8f"
                  />
                  <Text style={styles.policyFixedText}>
                    Reincidencia dentro de 90 días: 14 días · siguientes: 30
                    días
                  </Text>
                </View>

                <PolicyNumberField
                  label="Máximo de reasignaciones"
                  helper="Cantidad de prestadores alternativos que puede intentar el sistema (0–10)."
                  value={urgencyDraft.maxReassignments}
                  onChangeText={(value) =>
                    updateUrgencyDraft("maxReassignments", value)
                  }
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={savingUrgency}
                  onPress={confirmUrgencyPolicy}
                  style={[
                    styles.policySaveButton,
                    savingUrgency && styles.policySaveButtonDisabled,
                  ]}
                >
                  {savingUrgency ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={18} color="#fff" />
                      <Text style={styles.policySaveText}>
                        Guardar reasignaciones
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.policyAuditText}>
                  Último cambio:{" "}
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(urgency.policy.updatedAt))}
                  . Cada cambio conserva el antes, el después y el administrador
                  responsable.
                </Text>
              </View>
            ) : null}

            {notificationHealth ? (
              <View style={styles.section}>
                <SectionHeader
                  icon="notifications-outline"
                  title="Notificaciones transaccionales"
                  subtitle="Estado del correo, push y eventos conservados en la bandeja"
                />
                <View style={styles.integrationList}>
                  <View style={styles.integrationRow}>
                    <View
                      style={[
                        styles.integrationIcon,
                        notificationHealth.providers.emailConfigured
                          ? styles.integrationIconOk
                          : styles.integrationIconWarning,
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={19}
                        color={
                          notificationHealth.providers.emailConfigured
                            ? "#fff"
                            : "#76541c"
                        }
                      />
                    </View>
                    <View style={styles.integrationCopy}>
                      <Text style={styles.integrationTitle}>
                        Correo transaccional
                      </Text>
                      <Text style={styles.integrationText}>
                        {notificationHealth.providers.emailConfigured
                          ? "Resend y el remitente están configurados."
                          : "Faltan Resend y/o el remitente verificado."}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.integrationBadge,
                        notificationHealth.providers.emailConfigured
                          ? styles.integrationBadgeOk
                          : styles.integrationBadgeWarning,
                      ]}
                    >
                      {notificationHealth.providers.emailConfigured
                        ? "LISTO"
                        : "PENDIENTE"}
                    </Text>
                  </View>

                  <View style={styles.integrationRow}>
                    <View
                      style={[
                        styles.integrationIcon,
                        notificationHealth.providers.pushAccessTokenConfigured
                          ? styles.integrationIconOk
                          : styles.integrationIconWarning,
                      ]}
                    >
                      <Ionicons
                        name="phone-portrait-outline"
                        size={19}
                        color={
                          notificationHealth.providers.pushAccessTokenConfigured
                            ? "#fff"
                            : "#76541c"
                        }
                      />
                    </View>
                    <View style={styles.integrationCopy}>
                      <Text style={styles.integrationTitle}>Push de Expo</Text>
                      <Text style={styles.integrationText}>
                        {notificationHealth.providers.pushAccessTokenConfigured
                          ? "Token de acceso configurado para envíos protegidos."
                          : "Sin token de acceso del proveedor push."}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.integrationBadge,
                        notificationHealth.providers.pushAccessTokenConfigured
                          ? styles.integrationBadgeOk
                          : styles.integrationBadgeWarning,
                      ]}
                    >
                      {notificationHealth.providers.pushAccessTokenConfigured
                        ? "LISTO"
                        : "REVISAR"}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationMetrics}>
                  <View style={styles.integrationMetric}>
                    <Text style={styles.integrationMetricValue}>
                      {formatCount(notificationHealth.outbox.waitingEmail)}
                    </Text>
                    <Text style={styles.integrationMetricLabel}>
                      Correos esperando configuración
                    </Text>
                  </View>
                  <View style={styles.integrationMetric}>
                    <Text style={styles.integrationMetricValue}>
                      {formatCount(notificationHealth.outbox.sentEmail)}
                    </Text>
                    <Text style={styles.integrationMetricLabel}>
                      Correos enviados
                    </Text>
                  </View>
                  <View style={styles.integrationMetric}>
                    <Text
                      style={[
                        styles.integrationMetricValue,
                        (notificationHealth.outbox.failedEmail > 0 ||
                          notificationHealth.outbox.failedPush > 0) &&
                          styles.integrationMetricValueError,
                      ]}
                    >
                      {formatCount(
                        notificationHealth.outbox.failedEmail +
                          notificationHealth.outbox.failedPush,
                      )}
                    </Text>
                    <Text style={styles.integrationMetricLabel}>
                      Fallos definitivos
                    </Text>
                  </View>
                </View>

                {!notificationHealth.providers.emailConfigured ? (
                  <View style={styles.integrationHint}>
                    <Ionicons name="key-outline" size={18} color="#76541c" />
                    <Text style={styles.integrationHintText}>
                      Configurá RESEND_API_KEY y TRANSACTIONAL_EMAIL_FROM en
                      Supabase. Los eventos conservados se liberarán
                      automáticamente en el siguiente ciclo seguro.
                    </Text>
                  </View>
                ) : notificationHealth.outbox.pendingEmail > 0 ? (
                  <Text style={styles.integrationFootnote}>
                    Hay {formatCount(notificationHealth.outbox.pendingEmail)}
                    correos programados para próximos recordatorios.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionHeader
                icon="receipt-outline"
                title="Arrepentimientos y bajas"
                subtitle="Solicitudes públicas con código inmediato, incluso sin inicio de sesión"
              />
              {consumerRequests.length === 0 ? (
                <View style={styles.emptyModeration}>
                  <Ionicons name="checkmark-circle" size={30} color="#12815e" />
                  <Text style={styles.emptyModerationTitle}>
                    No hay solicitudes pendientes
                  </Text>
                  <Text style={styles.emptyText}>La cola está al día.</Text>
                </View>
              ) : (
                consumerRequests.map((request) => {
                  const updating = updatingReportId === request.id;
                  return (
                    <View key={request.id} style={styles.reportCard}>
                      <View style={styles.reportTopRow}>
                        <View style={styles.reportReasonBadge}>
                          <Text style={styles.reportReasonText}>
                            {request.request_type === "withdrawal"
                              ? "Arrepentimiento"
                              : "Baja de servicio"}
                          </Text>
                        </View>
                        <Text style={styles.reportDate}>
                          {new Intl.DateTimeFormat("es-AR", {
                            dateStyle: "short",
                          }).format(new Date(request.created_at))}
                        </Text>
                      </View>
                      <Text style={styles.reportProvider}>
                        {request.request_code}
                      </Text>
                      <Text selectable style={styles.reportLocation}>
                        {request.email}
                      </Text>
                      {request.operation_reference ? (
                        <Text style={styles.reportReference}>
                          Referencia: {request.operation_reference}
                        </Text>
                      ) : null}
                      <Text style={styles.reportDetails}>
                        {request.details || "Sin información adicional."}
                      </Text>
                      {updating ? (
                        <ActivityIndicator
                          color="#069eb3"
                          style={styles.reportLoader}
                        />
                      ) : (
                        <View style={styles.reportActions}>
                          {request.status !== "reviewing" ? (
                            <TouchableOpacity
                              onPress={() =>
                                void updateConsumerRequest(request, "reviewing")
                              }
                              style={styles.reviewButton}
                            >
                              <Text style={styles.reviewButtonText}>
                                Tomar gestión
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            onPress={() =>
                              void updateConsumerRequest(request, "completed")
                            }
                            style={styles.resolveButton}
                          >
                            <Text style={styles.resolveButtonText}>
                              Completar
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              void updateConsumerRequest(request, "rejected")
                            }
                            style={styles.dismissButton}
                          >
                            <Text style={styles.dismissButtonText}>
                              Rechazar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              <SectionHeader
                icon="shield-outline"
                title="Reclamos y moderación"
                subtitle="MICA toma el caso inicial y escala aquí lo que requiere a Agustín"
              />
              {reports.length === 0 ? (
                <View style={styles.emptyModeration}>
                  <Ionicons name="checkmark-circle" size={30} color="#12815e" />
                  <Text style={styles.emptyModerationTitle}>
                    No hay reclamos ni reportes pendientes
                  </Text>
                  <Text style={styles.emptyText}>La cola está al día.</Text>
                </View>
              ) : (
                reports.map((report) => {
                  const updating = updatingReportId === report.id;
                  return (
                    <View key={report.id} style={styles.reportCard}>
                      <View style={styles.reportTopRow}>
                        <View style={styles.reportReasonBadge}>
                          <Text style={styles.reportReasonText}>
                            {REPORT_REASON_LABELS[report.reason_category] ??
                              report.reason_category}
                          </Text>
                        </View>
                        <Text style={styles.reportDate}>
                          {new Intl.DateTimeFormat("es-AR", {
                            dateStyle: "short",
                          }).format(new Date(report.created_at))}
                        </Text>
                      </View>
                      <Text style={styles.reportProvider}>
                        {report.source === "incident" && report.case_number
                          ? `${report.case_number} · ${report.providerName}`
                          : report.providerName}
                      </Text>
                      <Text style={styles.reportLocation}>
                        {report.providerLocation}
                      </Text>
                      {report.source === "incident" ? (
                        <Text style={styles.reportReference}>
                          Chat {report.chat_id?.slice(0, 8) ?? "—"} · Pago{" "}
                          {report.payment_record_id?.slice(0, 8) ?? "—"}
                        </Text>
                      ) : null}
                      {report.details ? (
                        <Text style={styles.reportDetails}>
                          {report.details}
                        </Text>
                      ) : (
                        <Text style={styles.reportDetailsMuted}>
                          Sin detalle adicional.
                        </Text>
                      )}
                      {updating ? (
                        <ActivityIndicator
                          color="#069eb3"
                          style={styles.reportLoader}
                        />
                      ) : (
                        <View style={styles.reportActions}>
                          {report.status !== "reviewing" ? (
                            <TouchableOpacity
                              activeOpacity={0.78}
                              onPress={() =>
                                void updateReport(report, "reviewing")
                              }
                              style={styles.reviewButton}
                            >
                              <Text style={styles.reviewButtonText}>
                                {report.source === "incident"
                                  ? "Tomar caso"
                                  : "Tomar revisión"}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={() =>
                              confirmReportUpdate(
                                report,
                                "resolved",
                                "Resolver reporte",
                                "Confirmá que el caso fue revisado y ya puede cerrarse.",
                              )
                            }
                            style={styles.resolveButton}
                          >
                            <Text style={styles.resolveButtonText}>
                              {report.source === "incident"
                                ? "Cerrar revisión"
                                : "Resolver"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.78}
                            onPress={() =>
                              confirmReportUpdate(
                                report,
                                "dismissed",
                                "Descartar reporte",
                                "Usá esta opción únicamente si el reporte no corresponde.",
                              )
                            }
                            style={styles.dismissButton}
                          >
                            <Text style={styles.dismissButtonText}>
                              Descartar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#edf4f2",
  },
  content: {
    padding: 14,
    paddingTop: 56,
    paddingBottom: 48,
  },
  hero: {
    borderRadius: 28,
    padding: 22,
    overflow: "hidden",
    shadowColor: "#063b45",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 7,
  },
  heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  heroEyebrowText: {
    color: "#baf6ed",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 10,
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 7,
    maxWidth: 430,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 19,
  },
  periodRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  periodButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  periodButtonActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  periodButtonText: {
    color: "#e7fffb",
    fontSize: 11,
    fontWeight: "800",
  },
  periodButtonTextActive: {
    color: "#047a8f",
  },
  updatedAt: {
    marginTop: 13,
    color: "rgba(255,255,255,0.62)",
    fontSize: 10,
  },
  stateCard: {
    alignItems: "center",
    marginTop: 16,
    padding: 28,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e8e5",
  },
  errorCard: {
    borderColor: "#efc8c3",
    backgroundColor: "#fffafa",
  },
  stateTitle: {
    marginTop: 12,
    color: "#183b42",
    fontSize: 16,
    fontWeight: "900",
  },
  errorTitle: {
    marginTop: 10,
    color: "#8f3029",
    fontSize: 17,
    fontWeight: "900",
  },
  stateText: {
    marginTop: 6,
    color: "#687f83",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: "#047a8f",
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: 150,
    minHeight: 154,
    padding: 16,
    borderRadius: 21,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e8e5",
  },
  metricIcon: {
    width: 37,
    height: 37,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  metricIcon_teal: {
    backgroundColor: "#e4f6f4",
  },
  metricIcon_green: {
    backgroundColor: "#13815e",
  },
  metricIcon_orange: {
    backgroundColor: "#d67b17",
  },
  metricIcon_red: {
    backgroundColor: "#b5473d",
  },
  metricValue: {
    marginTop: 12,
    color: "#17373e",
    fontSize: 26,
    fontWeight: "900",
  },
  metricLabel: {
    marginTop: 1,
    color: "#294b51",
    fontSize: 13,
    fontWeight: "800",
  },
  metricDetail: {
    marginTop: 5,
    color: "#75898d",
    fontSize: 10,
    lineHeight: 14,
  },
  section: {
    marginTop: 12,
    padding: 17,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e8e5",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#e6f6f4",
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: "#183b42",
    fontSize: 16,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 2,
    color: "#71868a",
    fontSize: 10,
    lineHeight: 14,
  },
  funnelList: {
    gap: 13,
  },
  funnelRow: {
    flexDirection: "row",
    gap: 10,
  },
  funnelIndex: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#eef8f6",
  },
  funnelIndexText: {
    color: "#047a8f",
    fontSize: 11,
    fontWeight: "900",
  },
  funnelCopy: {
    flex: 1,
  },
  funnelLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  funnelLabel: {
    color: "#31545a",
    fontSize: 11,
    fontWeight: "700",
  },
  funnelValue: {
    color: "#17373e",
    fontSize: 12,
    fontWeight: "900",
  },
  barTrack: {
    height: 7,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: "#e8efee",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#069eb3",
  },
  funnelEvents: {
    marginTop: 3,
    color: "#8a9a9d",
    fontSize: 9,
  },
  paymentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  paymentMetric: {
    flexGrow: 1,
    flexBasis: "21%",
    minWidth: 68,
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 7,
    borderRadius: 16,
    backgroundColor: "#f3f8f7",
  },
  paymentValue: {
    color: "#047a8f",
    fontSize: 19,
    fontWeight: "900",
  },
  paymentValueAlert: {
    color: "#b5473d",
  },
  paymentLabel: {
    marginTop: 3,
    color: "#687f83",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  trustStrip: {
    gap: 8,
    marginTop: 12,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#fff9eb",
    borderWidth: 1,
    borderColor: "#f1dfb2",
  },
  trustValue: {
    color: "#294b51",
    fontSize: 13,
    fontWeight: "900",
  },
  trustLabel: {
    marginTop: 1,
    color: "#71868a",
    fontSize: 10,
  },
  issueList: {
    gap: 8,
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#f5f9f8",
  },
  issueIndicator: {
    width: 27,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#dff4ec",
  },
  issueIndicatorAlert: {
    backgroundColor: "#f9e4e1",
  },
  issueLabel: {
    flex: 1,
    color: "#3f5d62",
    fontSize: 11,
    fontWeight: "700",
  },
  issueValue: {
    color: "#12815e",
    fontSize: 13,
    fontWeight: "900",
  },
  issueValueAlert: {
    color: "#a43b32",
  },
  provinceRow: {
    marginBottom: 12,
  },
  provinceLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  provinceLabel: {
    flex: 1,
    color: "#3f5d62",
    fontSize: 11,
    fontWeight: "700",
  },
  provinceValue: {
    color: "#183b42",
    fontSize: 11,
    fontWeight: "900",
  },
  provinceBar: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#d67b17",
  },
  policyStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#fff8e9",
    borderWidth: 1,
    borderColor: "#f1dfb2",
  },
  policyStatusIcon: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#f5e5bd",
  },
  policyStatusIconEnabled: {
    backgroundColor: "#12815e",
  },
  policyStatusCopy: {
    flex: 1,
  },
  policyStatusTitle: {
    color: "#294b51",
    fontSize: 12,
    fontWeight: "900",
  },
  policyStatusText: {
    marginTop: 2,
    color: "#71868a",
    fontSize: 9,
    lineHeight: 13,
  },
  policyMetricsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  policyMetric: {
    flex: 1,
    minHeight: 76,
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#f3f8f7",
  },
  policyMetricValue: {
    color: "#047a8f",
    fontSize: 20,
    fontWeight: "900",
  },
  policyMetricLabel: {
    marginTop: 3,
    color: "#687f83",
    fontSize: 9,
    lineHeight: 13,
  },
  policyFixedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 3,
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#e9f7f6",
  },
  policyFixedText: {
    flex: 1,
    color: "#31545a",
    fontSize: 10,
    fontWeight: "700",
  },
  policyField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 66,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dce8e6",
  },
  policyFieldCopy: {
    flex: 1,
  },
  policyFieldLabel: {
    color: "#31545a",
    fontSize: 11,
    fontWeight: "800",
  },
  policyFieldHelper: {
    marginTop: 3,
    color: "#7a8d90",
    fontSize: 9,
    lineHeight: 13,
  },
  policyInput: {
    width: 56,
    minHeight: 42,
    paddingHorizontal: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#b9d7dc",
    backgroundColor: "#fff",
    color: "#183b42",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  policySaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    marginTop: 14,
    borderRadius: 15,
    backgroundColor: "#047a8f",
  },
  policySaveButtonDisabled: {
    opacity: 0.55,
  },
  policySaveText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  policyAuditText: {
    marginTop: 9,
    color: "#7a8d90",
    fontSize: 9,
    lineHeight: 13,
    textAlign: "center",
  },
  integrationList: {
    gap: 8,
  },
  integrationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    padding: 11,
    borderRadius: 16,
    backgroundColor: "#f6faf9",
    borderWidth: 1,
    borderColor: "#dce8e6",
  },
  integrationIcon: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
  },
  integrationIconOk: {
    backgroundColor: "#12815e",
  },
  integrationIconWarning: {
    backgroundColor: "#f5e5bd",
  },
  integrationCopy: {
    flex: 1,
  },
  integrationTitle: {
    color: "#294b51",
    fontSize: 11,
    fontWeight: "900",
  },
  integrationText: {
    marginTop: 2,
    color: "#71868a",
    fontSize: 9,
    lineHeight: 13,
  },
  integrationBadge: {
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 9,
    fontSize: 8,
    fontWeight: "900",
  },
  integrationBadgeOk: {
    color: "#0c6b4e",
    backgroundColor: "#dff4ec",
  },
  integrationBadgeWarning: {
    color: "#76541c",
    backgroundColor: "#fff0c9",
  },
  integrationMetrics: {
    flexDirection: "row",
    gap: 7,
    marginTop: 10,
  },
  integrationMetric: {
    flex: 1,
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 14,
    backgroundColor: "#f3f8f7",
  },
  integrationMetricValue: {
    color: "#047a8f",
    fontSize: 18,
    fontWeight: "900",
  },
  integrationMetricValueError: {
    color: "#a43b32",
  },
  integrationMetricLabel: {
    marginTop: 3,
    color: "#687f83",
    fontSize: 8,
    lineHeight: 11,
    textAlign: "center",
  },
  integrationHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#fff8e9",
    borderWidth: 1,
    borderColor: "#f1dfb2",
  },
  integrationHintText: {
    flex: 1,
    color: "#76541c",
    fontSize: 9,
    lineHeight: 14,
  },
  integrationFootnote: {
    marginTop: 9,
    color: "#71868a",
    fontSize: 9,
    lineHeight: 13,
    textAlign: "center",
  },
  emptyText: {
    color: "#7a8d90",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  emptyModeration: {
    alignItems: "center",
    paddingVertical: 14,
  },
  emptyModerationTitle: {
    marginTop: 7,
    color: "#31545a",
    fontSize: 13,
    fontWeight: "800",
  },
  reportCard: {
    marginBottom: 11,
    padding: 14,
    borderRadius: 17,
    backgroundColor: "#fbfcfc",
    borderWidth: 1,
    borderColor: "#dce8e6",
  },
  reportTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reportReasonBadge: {
    flexShrink: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#fff0ed",
  },
  reportReasonText: {
    color: "#9c3c33",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  reportDate: {
    color: "#8b9b9e",
    fontSize: 9,
  },
  reportProvider: {
    marginTop: 10,
    color: "#193b42",
    fontSize: 14,
    fontWeight: "900",
  },
  reportLocation: {
    marginTop: 2,
    color: "#5f7b80",
    fontSize: 10,
  },
  reportReference: {
    marginTop: 4,
    color: "#047a8f",
    fontSize: 11,
    fontWeight: "700",
  },
  reportDetails: {
    marginTop: 10,
    color: "#455f64",
    fontSize: 11,
    lineHeight: 17,
  },
  reportDetailsMuted: {
    marginTop: 10,
    color: "#94a2a4",
    fontSize: 10,
    fontStyle: "italic",
  },
  reportActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 13,
  },
  reviewButton: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "#e6f4f7",
  },
  reviewButtonText: {
    color: "#047a8f",
    fontSize: 10,
    fontWeight: "800",
  },
  resolveButton: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "#12815e",
  },
  resolveButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  dismissButton: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#d8a49e",
    backgroundColor: "#fff",
  },
  dismissButtonText: {
    color: "#9c3c33",
    fontSize: 10,
    fontWeight: "800",
  },
  reportLoader: {
    marginTop: 14,
  },
});
