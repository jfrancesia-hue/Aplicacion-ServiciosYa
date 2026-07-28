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
  source: "profile" | "service";
  provider_id: string;
  reason_category: string;
  details: string | null;
  status: "pending" | "reviewing" | "resolved" | "dismissed";
  service_id: number | null;
  created_at: string;
  providerName: string;
  providerLocation: string;
};

const REPORT_REASON_LABELS: Record<string, string> = {
  inappropriate_content: "Contenido inapropiado",
  false_information: "Información falsa",
  spam: "Spam",
  potential_scam: "Posible estafa",
  security_issue: "Problema de seguridad",
  other: "Otro motivo",
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

export default function OperationalDashboard() {
  const { rol } = useSuspenseProfile();
  const [periodDays, setPeriodDays] = useState<(typeof PERIODS)[number]>(30);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);

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
        const [summaryResult, reportsResult] = await Promise.all([
          supabase.functions.invoke("operational-dashboard", {
            body: { action: "summary", days: periodDays },
          }),
          supabase.functions.invoke("operational-dashboard", {
            body: { action: "reports" },
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

        setSummary(summaryResult.data as DashboardSummary);
        setReports((reportsResult.data?.reports ?? []) as ModerationReport[]);
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
          <Text style={styles.heroTitle}>Panel de ServiciosYa</Text>
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

            <View style={styles.section}>
              <SectionHeader
                icon="shield-outline"
                title="Cola de moderación"
                subtitle="Los datos de quien reportó permanecen protegidos"
              />
              {reports.length === 0 ? (
                <View style={styles.emptyModeration}>
                  <Ionicons name="checkmark-circle" size={30} color="#12815e" />
                  <Text style={styles.emptyModerationTitle}>
                    No hay reportes de perfiles pendientes
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
                        {report.providerName}
                      </Text>
                      <Text style={styles.reportLocation}>
                        {report.providerLocation}
                      </Text>
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
                                Tomar revisión
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
                              Resolver
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
