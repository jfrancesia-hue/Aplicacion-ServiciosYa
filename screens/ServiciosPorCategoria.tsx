import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../types/navigation";
import { supabase } from "../lib/supabase";
import {
  getAvailableProviders,
  type ProviderAvailabilityStatus,
} from "../lib/availableProviders";
import BotonVolver from "../components/BotonVolver";
import BottomNavBar from "../components/home/BottomNavBar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getUserID } from "../store/authStore";
import {
  createUrgentWorkAlert,
  sendUrgentWorkPush,
} from "../lib/utils/urgentWorkNotification";
import { useLocationStore } from "../store/locationStore";
import {
  formatLocationScope,
  providerMatchesLocation,
  sameLocality,
} from "../lib/utils/geoSegmentation";
import TrustSafetyModal from "../components/trust/TrustSafetyModal";
import {
  getBlockedUserIds,
  isUserBlockedByMe,
} from "../lib/utils/trustSafety";
import vexo from "../lib/vexo";

type Props = NativeStackScreenProps<MainStackParamList, "ServiciosPorCategoria">;

const categoriasSensibles = [
  "Cuidado de niños", "Cuidado de adultos mayores", "Enfermero", "Psicólogo",
  "Kinesiólogo", "Nutricionista", "Masajista", "Terapista ocupacional",
  "Profesor de yoga", "Animador infantil", "Maquillador profesional",
];

interface Worker {
  id: string;
  nombre: string;
  edad?: number | null;
  foto_perfil?: string | null;
  provincia?: string | null;
  ciudad?: string | null;
  barrio?: string | null;
  categoria?: string[];
  matricula?: unknown;
  antecedentes?: unknown;
  verificado?: boolean;
  suscriptor?: boolean;
  antiguedad?: number | null;
  availabilityStatus?: ProviderAvailabilityStatus;
  availabilityLabel?: string;
  availabilityDetail?: string | null;
  availabilityUpdatedAt?: string | null;
  legacy?: boolean;
  campaignProfile?: boolean;
  completedJobs?: number;
  averageRating?: number | null;
  reviewCount?: number;
  averageResponseMinutes?: number | null;
  responseSampleSize?: number;
}

type RawWorker = Omit<Worker, "categoria"> & {
  categoria?: unknown;
};

function parseCategories(value: unknown): string[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [parsed];
    }
  }

  const values = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  return Array.from(
    new Set(values.map((category) => String(category).trim()).filter(Boolean)),
  );
}

function extractCardDocUrl(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    try { return extractCardDocUrl(JSON.parse(val)); } catch (_) {}
    const m = val.match(/https?:\/\/[^\s'"<>]+/i);
    if (m) return m[0].replace(/[)\]"'.,;]+$/, '');
    return /^https?:\/\//i.test(val) ? val : null;
  }
  if (Array.isArray(val)) {
    for (const item of val) { const f = extractCardDocUrl(item); if (f) return f; }
    return null;
  }
  if (typeof val === 'object') {
    const record = val as Record<string, unknown>;
    for (const key of ['uri', 'url', 'path', 'link']) {
      if (record[key]) {
        const found = extractCardDocUrl(record[key]);
        if (found) return found;
      }
    }
    for (const key of Object.keys(record)) {
      const found = extractCardDocUrl(record[key]);
      if (found) return found;
    }
  }
  return null;
}

function formatResponseTime(minutes?: number | null) {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  if (minutes < 60) return `Responde en ~${Math.max(1, Math.round(minutes))} min`;
  if (minutes < 24 * 60) return `Responde en ~${Math.round(minutes / 60)} h`;
  return `Responde en ~${Math.round(minutes / (24 * 60))} días`;
}

function WorkerCard({ worker, onPress }: { worker: Worker; onPress: () => void }) {
  const ubicacion = [worker.ciudad, worker.provincia].filter(Boolean).join(", ");
  const availabilityStatus = worker.availabilityStatus ?? "to_confirm";
  const availabilityIcon =
    availabilityStatus === "online"
      ? "bolt"
      : availabilityStatus === "scheduled"
        ? "schedule"
        : availabilityStatus === "busy"
          ? "hourglass-top"
          : "chat";
  const hasMatricula = Boolean(extractCardDocUrl(worker.matricula));
  const hasAntecedentes = Boolean(extractCardDocUrl(worker.antecedentes));
  const trustLabel = worker.verificado
    ? "Identidad verificada"
    : hasMatricula || hasAntecedentes
      ? "Documentación cargada"
      : "Perfil básico";
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <Image
          source={
            worker.foto_perfil
              ? { uri: worker.foto_perfil }
              : require("../assets/serviciosya-logo-2026.png")
          }
          style={styles.avatar}
        />
        <View style={styles.cardInfo}>
          <Text style={styles.workerName}>{worker.nombre || "Sin nombre"}</Text>
          {!!ubicacion && (
            <View style={styles.metaRow}>
              <MaterialIcons name="location-on" size={13} color="#069eb3" />
              <Text style={styles.metaText}>{ubicacion}</Text>
            </View>
          )}
          {!!worker.edad && (
            <View style={styles.metaRow}>
              <MaterialIcons name="person" size={13} color="#069eb3" />
              <Text style={styles.metaText}>{worker.edad} años</Text>
            </View>
          )}
          {worker.antiguedad != null && (
            <View style={styles.metaRow}>
              <MaterialIcons name="work" size={13} color="#069eb3" />
              <Text style={styles.metaText}>{worker.antiguedad} años de experiencia</Text>
            </View>
          )}
        </View>
      </View>
      <View
        style={[
          styles.availabilityCard,
          availabilityStatus === "online" && styles.availabilityCardOnline,
          availabilityStatus === "busy" && styles.availabilityCardBusy,
        ]}
      >
        <View
          style={[
            styles.availabilityIcon,
            availabilityStatus === "online" && styles.availabilityIconOnline,
          ]}
        >
          <MaterialIcons
            name={availabilityIcon}
            size={15}
            color={availabilityStatus === "online" ? "#fff" : "#047a8f"}
          />
        </View>
        <View style={styles.availabilityCopy}>
          <Text style={styles.availabilityTitle}>
            {worker.availabilityLabel || "Disponibilidad a confirmar"}
          </Text>
          {!!worker.availabilityDetail && (
            <Text style={styles.availabilityDetail} numberOfLines={1}>
              {worker.availabilityDetail}
            </Text>
          )}
        </View>
      </View>
      {Array.isArray(worker.categoria) && worker.categoria.length > 0 && (
        <View style={styles.tagsRow}>
          {worker.categoria.map((cat) => (
            <View key={cat} style={styles.tag}><Text style={styles.tagText}>{cat}</Text></View>
          ))}
        </View>
      )}
      <View style={styles.badgesRow}>
        <View
          style={[
            styles.badge,
            worker.verificado
              ? styles.badgeVerified
              : hasMatricula || hasAntecedentes
                ? styles.badgeDoc
                : styles.badgeBasic,
          ]}
        >
          <MaterialIcons
            name={worker.verificado ? "verified-user" : hasMatricula || hasAntecedentes ? "description" : "person-outline"}
            size={13}
            color={worker.verificado || hasMatricula || hasAntecedentes ? "#fff" : "#516468"}
          />
          <Text
            style={[
              styles.badgeText,
              !worker.verificado &&
                !hasMatricula &&
                !hasAntecedentes &&
                styles.badgeTextBasic,
            ]}
          >
            {trustLabel}
          </Text>
        </View>
        {worker.suscriptor && <View style={[styles.badge, styles.badgeSub]}><MaterialIcons name="star" size={13} color="#fff" /><Text style={styles.badgeText}>Premium</Text></View>}
      </View>
      {(worker.completedJobs ?? 0) > 0 ||
      (worker.responseSampleSize ?? 0) >= 3 ? (
        <View style={styles.reputationRow}>
          {(worker.completedJobs ?? 0) > 0 ? (
            <View style={styles.reputationItem}>
              <MaterialIcons name="verified" size={15} color="#12815e" />
              <Text style={styles.reputationText}>
                {worker.averageRating != null
                  ? `${worker.averageRating.toFixed(1)} · `
                  : ""}
                {worker.completedJobs} trabajo
                {worker.completedJobs === 1 ? "" : "s"} confirmado
                {worker.completedJobs === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
          {(worker.responseSampleSize ?? 0) >= 3 &&
          worker.averageResponseMinutes != null ? (
            <View style={styles.reputationItem}>
              <MaterialIcons name="schedule" size={15} color="#047a8f" />
              <Text style={styles.reputationText}>
                {formatResponseTime(worker.averageResponseMinutes)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function WorkerDetailModal({
  worker,
  visible,
  onClose,
  onBlocked,
  workerServices,
  loadingServices,
}: {
  worker: Worker | null;
  visible: boolean;
  onClose: () => void;
  onBlocked: (providerId: string) => void;
  workerServices: WorkerService[];
  loadingServices: boolean;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [trustSafetyVisible, setTrustSafetyVisible] = useState(false);

  if (!worker) return null;
  const ubicacion = [worker.barrio, worker.ciudad, worker.provincia].filter(Boolean).join(", ");
  const hasMatricula = Boolean(extractCardDocUrl(worker.matricula));
  const hasAntecedentes = Boolean(extractCardDocUrl(worker.antecedentes));
  const hasVerificationEvidence =
    Boolean(worker.verificado) || hasMatricula || hasAntecedentes;

  const abrirDoc = (val: unknown) => {
    const url = extractCardDocUrl(val);
    if (!url) { Alert.alert("Sin documento", "No se encontró una URL válida en este documento."); return; }
    Linking.openURL(url).catch(() => Alert.alert("Error", "No se pudo abrir el documento."));
  };

  const compartirPerfil = async () => {
    if (!worker?.id) {
      Alert.alert("Error", "No se pudo identificar al profesional.");
      return;
    }
    const url = `https://tooriserviciosya.com/PerfileProfesionales.php?ids=${encodeURIComponent(worker.id)}`;
    const nombre = worker.nombre?.trim();
    const message = nombre
      ? `Mirá el perfil de ${nombre} en Servicios Ya: ${url}`
      : `Mirá este profesional en Servicios Ya: ${url}`;
    try {
      await Share.share({ message, url, title: nombre || "Profesional Servicios Ya" });
    } catch {
      // usuario canceló o falló el share — no hace falta avisar
    }
  };

  const contactarChat = async () => {
    const myId = getUserID();
    if (!myId) { Alert.alert("Error", "Debes iniciar sesión para enviar mensajes."); return; }
    if (!worker?.id) { Alert.alert("Error", "No se pudo identificar al profesional."); return; }
    if (worker.id.toLowerCase() === myId.toLowerCase()) {
      Alert.alert("Error", "No podés chatear con vos mismo.");
      return;
    }
    try {
      if (await isUserBlockedByMe(worker.id)) {
        Alert.alert(
          "Perfil bloqueado",
          "Desbloquealo desde Configuración para volver a contactarlo.",
        );
        return;
      }

      // La tabla `chats` tiene CHECK (participant_a < participant_b) y UNIQUE (participant_a, participant_b).
      // Ordenamos los UUIDs antes de buscar/insertar.
      const [participantA, participantB] = [myId, worker.id].slice().sort();

      const { data: existing, error: searchError } = await supabase
        .from("chats")
        .select("id")
        .eq("participant_a", participantA)
        .eq("participant_b", participantB)
        .maybeSingle();

      if (searchError) console.error("[contactarChat] búsqueda:", searchError);

      let chatId: string;

      if (existing) {
        chatId = existing.id;
      } else {
        const { data: created, error: createError } = await supabase
          .from("chats")
          .insert({ participant_a: participantA, participant_b: participantB })
          .select("id")
          .single();

        if (createError || !created) {
          console.error("[contactarChat] insert:", createError);
          Alert.alert(
            "Error",
            createError?.message
              ? `No se pudo iniciar el chat: ${createError.message}`
              : "No se pudo iniciar el chat.",
          );
          return;
        }
        chatId = created.id;
      }

      try {
        const { data: receptorUsuario } = await supabase
          .from("usuarios")
          .select("expo_token")
          .eq("id", worker.id)
          .single();

        if (receptorUsuario?.expo_token) {
          const urgentBody = `Un cliente quiere contactarte por ${worker.categoria?.[0] || "un servicio"}. Respondelo cuanto antes.`;

          await sendUrgentWorkPush({
            to: receptorUsuario.expo_token,
            title: "Tenes trabajo urgente",
            body: urgentBody,
            data: {
              screen: "ChatIndividual",
              params: {
                chatId,
                nombre: "Cliente",
                servicioId: "",
                usuarioId1: participantA,
                usuarioId2: participantB,
              },
            },
          });

          await createUrgentWorkAlert({
            supabase,
            source: "direct_contact",
            workerId: worker.id,
            clienteId: myId,
            chatId,
            category: worker.categoria?.[0] || null,
            title: "Tenes trabajo urgente",
            body: urgentBody,
            metadata: {
              worker_nombre: worker.nombre,
            },
          });
        }
      } catch (pushError) {
        console.log("[contactarChat] aviso urgente no enviado:", pushError);
      }

      onClose();
      vexo.marketplace("safe_chat_opened", {
        categoria: worker.categoria?.[0] || "sin_categoria",
        disponibilidad: worker.availabilityStatus || "to_confirm",
      });
      navigation.navigate("ChatIndividual", {
        chatId,
        nombre: worker.nombre || "Profesional",
        servicio: {},
        servicioId: "",
        usuarioId1: participantA,
        usuarioId2: participantB,
      });
    } catch (error: unknown) {
      console.error("[contactarChat] excepción:", error);
      const message = error instanceof Error ? error.message : null;
      Alert.alert(
        "Error",
        message
          ? `No se pudo abrir el chat: ${message}`
          : "No se pudo abrir el chat.",
      );
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <LinearGradient colors={["#069eb3", "#047a8f"]} style={styles.modalHero}>
              <Image
                source={
                  worker.foto_perfil
                    ? { uri: worker.foto_perfil }
                    : require("../assets/serviciosya-logo-2026.png")
                }
                style={styles.modalAvatar}
              />
              <Text style={styles.modalName}>{worker.nombre || "Sin nombre"}</Text>
              {!!worker.edad && <Text style={styles.modalAge}>{worker.edad} años</Text>}
            </LinearGradient>
            <View style={styles.modalContent}>
              {!!ubicacion && <View style={styles.modalRow}><MaterialIcons name="location-on" size={18} color="#069eb3" /><Text style={styles.modalRowText}>{ubicacion}</Text></View>}
              <View style={styles.modalRow}>
                <MaterialIcons
                  name={worker.availabilityStatus === "online" ? "bolt" : "schedule"}
                  size={18}
                  color={worker.availabilityStatus === "online" ? "#159447" : "#069eb3"}
                />
                <Text style={styles.modalRowText}>
                  {worker.availabilityLabel || "Disponibilidad a confirmar"}
                  {worker.availabilityDetail
                    ? ` · ${worker.availabilityDetail}`
                    : ""}
                </Text>
              </View>
              {(worker.completedJobs ?? 0) > 0 ? (
                <View style={styles.verifiedWorkPanel}>
                  <MaterialIcons name="verified" size={21} color="#12815e" />
                  <View style={styles.verifiedWorkCopy}>
                    <Text style={styles.verifiedWorkTitle}>
                      {worker.completedJobs} trabajo
                      {worker.completedJobs === 1 ? "" : "s"} confirmado
                      {worker.completedJobs === 1 ? "" : "s"} en la app
                    </Text>
                    <Text style={styles.verifiedWorkText}>
                      {worker.averageRating != null
                        ? `Calificación ${worker.averageRating.toFixed(1)} sobre 5`
                        : "Historial generado con servicios confirmados"}
                      {(worker.responseSampleSize ?? 0) >= 3 &&
                      worker.averageResponseMinutes != null
                        ? ` · ${formatResponseTime(worker.averageResponseMinutes)}`
                        : ""}
                    </Text>
                  </View>
                </View>
              ) : null}
              {worker.antiguedad != null && <View style={styles.modalRow}><MaterialIcons name="work" size={18} color="#069eb3" /><Text style={styles.modalRowText}>{worker.antiguedad} años de experiencia</Text></View>}

              {Array.isArray(worker.categoria) && worker.categoria.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.modalLabel}>Especialidades</Text>
                  <View style={styles.tagsRow}>
                    {worker.categoria.map((cat) => <View key={cat} style={styles.tag}><Text style={styles.tagText}>{cat}</Text></View>)}
                  </View>
                </View>
              )}

              <Text style={styles.modalLabel}>Información y confianza</Text>
              {hasVerificationEvidence && (
                <View style={styles.verRow}>
                  {worker.verificado && (
                    <View style={[styles.verItem, styles.verOk]}>
                      <MaterialIcons name="verified" size={15} color="#fff" />
                      <Text style={styles.verText}>Perfil verificado</Text>
                    </View>
                  )}
                  {hasMatricula && (
                    <View style={[styles.verItem, styles.verOk]}>
                      <MaterialIcons name="badge" size={15} color="#fff" />
                      <Text style={styles.verText}>Matrícula cargada</Text>
                    </View>
                  )}
                  {hasAntecedentes && (
                    <View style={[styles.verItem, styles.verOk]}>
                      <MaterialIcons
                        name="description"
                        size={15}
                        color="#fff"
                      />
                      <Text style={styles.verText}>
                        Antecedentes cargados
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {(!worker.verificado ||
                !hasMatricula ||
                !hasAntecedentes) && (
                <View style={styles.profileInfoNotice}>
                  <MaterialIcons name="info" size={18} color="#9a6a12" />
                  <Text style={styles.profileInfoText}>
                    La documentación de este perfil puede estar incompleta.
                    Confirmá experiencia, alcance, precio y disponibilidad
                    dentro del chat antes de contratar.
                  </Text>
                </View>
              )}

              {loadingServices ? (
                <ActivityIndicator size="small" color="#069eb3" style={{ marginVertical: 8 }} />
              ) : workerServices.length > 0 ? (
                <View style={{ marginBottom: 4 }}>
                  <Text style={styles.modalLabel}>Info del servicio</Text>
                  {workerServices.map((svc) => (
                    <View key={svc.id} style={styles.svcCard}>
                      <Text style={styles.svcTitle}>{svc.titulo}</Text>
                      {!!svc.descripcion && <Text style={styles.svcDesc}>{svc.descripcion}</Text>}
                      <View style={styles.svcMeta}>
                        {svc.precio != null && (
                          <View style={styles.svcMetaItem}>
                            <MaterialIcons name="attach-money" size={14} color="#047a8f" />
                            <Text style={styles.svcMetaText}>${svc.precio.toLocaleString("es-AR")}</Text>
                          </View>
                        )}
                        {!!svc.horario && (
                          <View style={styles.svcMetaItem}>
                            <MaterialIcons name="schedule" size={14} color="#047a8f" />
                            <Text style={styles.svcMetaText}>{svc.horario}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {(extractCardDocUrl(worker.matricula) || extractCardDocUrl(worker.antecedentes)) && (
                <>
                  <Text style={styles.modalLabel}>Documentos</Text>
                  {extractCardDocUrl(worker.matricula) && (
                    <TouchableOpacity style={styles.docBtn} onPress={() => abrirDoc(worker.matricula)}>
                      <MaterialIcons name="badge" size={18} color="#069eb3" />
                      <Text style={styles.docBtnText}>Ver Matrícula</Text>
                      <MaterialIcons name="open-in-new" size={16} color="#069eb3" />
                    </TouchableOpacity>
                  )}
                  {extractCardDocUrl(worker.antecedentes) && (
                    <TouchableOpacity style={styles.docBtn} onPress={() => abrirDoc(worker.antecedentes)}>
                      <MaterialIcons name="description" size={18} color="#069eb3" />
                      <Text style={styles.docBtnText}>Ver Antecedentes</Text>
                      <MaterialIcons name="open-in-new" size={16} color="#069eb3" />
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity style={styles.shareBtn} onPress={compartirPerfil}>
                <MaterialIcons name="share" size={20} color="#069eb3" />
                <Text style={styles.shareBtnText}>Compartir perfil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.safetyBtn}
                onPress={() => setTrustSafetyVisible(true)}
              >
                <MaterialIcons name="gpp-maybe" size={20} color="#a43b32" />
                <Text style={styles.safetyBtnText}>Reportar o bloquear</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.contactBtn} onPress={contactarChat}>
                <MaterialIcons name="shield" size={20} color="#fff" />
                <Text style={styles.contactBtnText}>Abrir chat seguro</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    <TrustSafetyModal
      visible={trustSafetyVisible}
      providerId={worker.id}
      providerName={worker.nombre}
      serviceId={workerServices[0]?.id ?? null}
      onClose={() => setTrustSafetyVisible(false)}
      onBlocked={onBlocked}
    />
    </>
  );
}

type UserLocation = { ciudad?: string; provincia?: string; localidad?: string } | null | undefined;

interface WorkerService {
  id: number;
  titulo: string;
  descripcion?: string | null;
  precio?: number | null;
  horario?: string | null;
}

export default function ServiciosPorCategoria({ route }: Props) {
  const { categoria } = route.params;
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Worker | null>(null);
  const [workerServices, setWorkerServices] = useState<WorkerService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [legacyIncluded, setLegacyIncluded] = useState(0);
  const [campaignIncluded, setCampaignIncluded] = useState(0);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [locationMode, setLocationMode] = useState<
    "auto" | "province" | "city"
  >("auto");
  const [profileLocation, setProfileLocation] =
    useState<UserLocation>(undefined);
  const effectiveLocation = useLocationStore((state) => state.effectiveLocation);
  const requestDeviceLocation = useLocationStore((state) => state.requestDeviceLocation);
  const locationLoading = useLocationStore((state) => state.isLoading);
  const locationErrorMessage = useLocationStore((state) => state.error);
  const gpsHasAddress = Boolean(
    effectiveLocation?.city ||
      effectiveLocation?.province ||
      effectiveLocation?.locality,
  );
  const locationPending =
    locationLoading ||
    (!gpsHasAddress && profileLocation === undefined);
  const combinedLocation = useMemo<UserLocation>(() => {
    const location = {
      ciudad:
        effectiveLocation?.city ??
        effectiveLocation?.locality ??
        profileLocation?.ciudad,
      provincia:
        effectiveLocation?.province ?? profileLocation?.provincia,
      localidad:
        effectiveLocation?.locality ??
        effectiveLocation?.city ??
        profileLocation?.localidad,
    };

    return location.ciudad || location.provincia || location.localidad
      ? location
      : null;
  }, [effectiveLocation, profileLocation]);
  const userLocation = locationPending ? undefined : combinedLocation;
  const locationError = !locationPending && !userLocation;
  const locationScope = formatLocationScope(userLocation);
  const fallbackTrackedRef = useRef("");

  const scopedWorkerGroups = useMemo(() => {
    const unblockedWorkers = workers.filter(
      (worker) => !blockedIds.has(worker.id),
    );
    const targetCity = userLocation?.ciudad || userLocation?.localidad;
    const provinceWorkers = userLocation
      ? unblockedWorkers.filter((worker) =>
          providerMatchesLocation(worker, userLocation),
        )
      : unblockedWorkers;
    const cityWorkers = targetCity
      ? provinceWorkers.filter((worker) =>
          [worker.ciudad, worker.barrio].some((value) =>
          sameLocality(value, targetCity),
          ),
        )
      : provinceWorkers;
    const availabilityOrder: Record<ProviderAvailabilityStatus, number> = {
      online: 0,
      scheduled: 1,
      to_confirm: 2,
      busy: 3,
    };

    const sortWorkers = (items: Worker[]) =>
      [...items].sort((a, b) => {
        const availabilityDifference =
          availabilityOrder[a.availabilityStatus ?? "to_confirm"] -
          availabilityOrder[b.availabilityStatus ?? "to_confirm"];
        if (availabilityDifference !== 0) return availabilityDifference;
        if (targetCity) {
          const aSameCity = sameLocality(a.ciudad || a.barrio, targetCity);
          const bSameCity = sameLocality(b.ciudad || b.barrio, targetCity);
          const cityDifference = Number(bSameCity) - Number(aSameCity);
          if (cityDifference !== 0) return cityDifference;
        }

        const aUpdated = Date.parse(a.availabilityUpdatedAt || "") || 0;
        const bUpdated = Date.parse(b.availabilityUpdatedAt || "") || 0;
        return bUpdated - aUpdated;
      });

    return {
      province: sortWorkers(provinceWorkers),
      city: sortWorkers(cityWorkers),
    };
  }, [blockedIds, userLocation, workers]);

  const visibleWorkers = useMemo(() => {
    if (locationMode === "province") return scopedWorkerGroups.province;
    if (locationMode === "city") return scopedWorkerGroups.city;
    return scopedWorkerGroups.city.length > 0
      ? scopedWorkerGroups.city
      : scopedWorkerGroups.province;
  }, [locationMode, scopedWorkerGroups]);

  const targetCity = userLocation?.ciudad || userLocation?.localidad;
  const locationFallbackActive =
    locationMode === "auto" &&
    Boolean(targetCity) &&
    scopedWorkerGroups.city.length === 0 &&
    scopedWorkerGroups.province.length > 0;

  useEffect(() => {
    if (!locationFallbackActive) return;
    const trackingKey = [
      categoria,
      userLocation?.ciudad,
      userLocation?.provincia,
    ].join("|");
    if (fallbackTrackedRef.current === trackingKey) return;
    fallbackTrackedRef.current = trackingKey;
    vexo.marketplace("location_fallback", {
      categoria,
      ciudad: userLocation?.ciudad || userLocation?.localidad || "sin_ciudad",
      provincia: userLocation?.provincia || "sin_provincia",
    });
  }, [
    categoria,
    locationFallbackActive,
    userLocation?.ciudad,
    userLocation?.localidad,
    userLocation?.provincia,
  ]);

  useEffect(() => {
    setLocationMode("auto");
  }, [
    categoria,
    userLocation?.ciudad,
    userLocation?.localidad,
    userLocation?.provincia,
  ]);

  useEffect(() => {
    if (!selected) { setWorkerServices([]); return; }
    setLoadingServices(true);
    supabase
      .from("servicios")
      .select("id, titulo, descripcion, precio, horario")
      .or(`user_id.eq.${selected.id},usuario_id.eq.${selected.id}`)
      .then(({ data }) => {
        setWorkerServices((data as WorkerService[]) || []);
        setLoadingServices(false);
      });
  }, [selected]);

  useEffect(() => {
    if (categoriasSensibles.includes(categoria)) {
      Alert.alert("⚠️ Importante", "Recuerda siempre solicitar un documento habilitante o antecedentes penales antes de contratar este servicio.");
    }
  }, [categoria]);

  useEffect(() => {
    if (
      !effectiveLocation &&
      !locationLoading &&
      !locationErrorMessage
    ) {
      requestDeviceLocation();
    }
  }, [
    effectiveLocation,
    locationErrorMessage,
    locationLoading,
    requestDeviceLocation,
  ]);

  useEffect(() => {
    let isMounted = true;
    const userId = getUserID();

    if (!userId) {
      setProfileLocation(null);
      return undefined;
    }

    supabase
      .from("usuarios")
      .select("ciudad, provincia")
      .eq("id", userId)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            console.warn(
              "[ServiciosPorCategoria] ubicación de perfil no disponible:",
              error,
            );
            setProfileLocation(null);
            return;
          }
          setProfileLocation(
            data
              ? {
                  ciudad: data.ciudad ?? undefined,
                  provincia: data.provincia ?? undefined,
                }
              : null,
          );
        },
        (error: unknown) => {
          if (!isMounted) return;
          console.warn(
            "[ServiciosPorCategoria] no se pudo consultar la ubicación de perfil:",
            error,
          );
          setProfileLocation(null);
        },
      );

    return () => {
      isMounted = false;
    };
  }, []);

  const cargarWorkers = useCallback(async () => {
    if (locationPending) return;
    setLoading(true);
    try {
      const [response, currentBlockedIds] = await Promise.all([
        getAvailableProviders(categoria, {
          city: userLocation?.ciudad,
          province: userLocation?.provincia,
          locality: userLocation?.localidad,
        }),
        getBlockedUserIds(),
      ]);

      setWorkers(response.providers);
      setBlockedIds(currentBlockedIds);
      setLegacyIncluded(response.meta.legacyIncluded ?? 0);
      setCampaignIncluded(response.meta.campaignIncluded ?? 0);
      vexo.marketplace("providers_loaded", {
        categoria,
        cantidad: response.providers.length,
        provincia: userLocation?.provincia || "sin_provincia",
      });
      setLoading(false);
      return;
    } catch (unifiedError) {
      console.warn(
        "[ServiciosPorCategoria] lectura unificada no disponible; se usa el perfil actual:",
        unifiedError,
      );
      vexo.marketplace("search_failed", {
        categoria,
        etapa: "indice_unificado",
        provincia: userLocation?.provincia || "sin_provincia",
      });
    }

    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nombre, edad, foto_perfil, provincia, ciudad, barrio, categoria, matricula, antecedentes, verificado, suscriptor, antiguedad")
        .eq("rol", "worker")
        .eq("perfilPublico", true)
        .order("creado_en", { ascending: false })
        .limit(1000);

      if (error) throw error;

      const catLower = categoria.trim().toLowerCase();
      const rawWorkers = (data || []) as unknown as RawWorker[];
      const filtrados = rawWorkers.filter((worker) => {
        const cats = parseCategories(worker.categoria).map((category) =>
          category.toLowerCase(),
        );
        if (cats.length === 0) return false;
        return cats.some(c => c.includes(catLower) || catLower.includes(c));
      });

      setWorkers(
        filtrados.map((worker) => ({
          ...worker,
          categoria: parseCategories(worker.categoria),
          availabilityStatus: "to_confirm",
          availabilityLabel: "Disponibilidad a confirmar",
          availabilityDetail: "Consultá por el chat interno",
        })),
      );
      setLegacyIncluded(0);
      setCampaignIncluded(0);
    } catch {
      Alert.alert("Error", "No se pudieron cargar los profesionales.");
    } finally {
      setLoading(false);
    }
  }, [categoria, locationPending, userLocation]);

  useEffect(() => {
    if (!locationPending) cargarWorkers();
  }, [cargarWorkers, locationPending]);

  const handleWorkerPress = useCallback(
    (worker: Worker) => {
      vexo.marketplace("provider_profile_viewed", {
        categoria,
        disponibilidad: worker.availabilityStatus || "to_confirm",
        perfil_campana: Boolean(worker.campaignProfile),
        perfil_historico: Boolean(worker.legacy),
      });
      setSelected(worker);
    },
    [categoria],
  );

  const handleProviderBlocked = useCallback((providerId: string) => {
    setBlockedIds((current) => new Set([...current, providerId]));
    setSelected(null);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <BotonVolver />
      <LinearGradient colors={["#069eb3", "#047a8f"]} style={styles.headerGrad}>
        <Text style={styles.headerTitle}>{categoria}</Text>
        <Text style={styles.headerSub}>
          {loading || locationPending
            ? "Buscando en tu zona..."
            : locationFallbackActive
              ? `${visibleWorkers.length} en la provincia · ampliamos la búsqueda`
              : `${visibleWorkers.length} prestador${visibleWorkers.length !== 1 ? "es" : ""} en tu zona`}
        </Text>
      </LinearGradient>

      {loading || locationPending ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#069eb3" />
          <Text style={styles.loadingText}>
            {loading
              ? "Buscando profesionales..."
              : "Detectando tu ciudad y provincia..."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleWorkers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WorkerCard worker={item} onPress={() => handleWorkerPress(item)} />
          )}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            locationError ? (
              <View style={styles.locationBanner}>
                <MaterialIcons name="location-off" size={18} color="#92400e" />
                <View style={styles.locationBannerCopy}>
                  <Text style={styles.locationBannerTitle}>
                    No pudimos definir tu zona
                  </Text>
                  <Text style={styles.locationBannerText}>
                    Mostramos todos los prestadores. Podés volver a intentar el
                    GPS.
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Volver a intentar obtener mi ubicación"
                  onPress={requestDeviceLocation}
                  style={styles.locationRetryButton}
                >
                  <MaterialIcons name="refresh" size={20} color="#047a8f" />
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={[
                  styles.scopeBanner,
                  locationFallbackActive && styles.scopeBannerFallback,
                ]}
              >
                <View style={styles.scopeIcon}>
                  <MaterialIcons
                    name={locationFallbackActive ? "travel-explore" : "my-location"}
                    size={18}
                    color="#fff"
                  />
                </View>
                <View style={styles.locationBannerCopy}>
                  <Text style={styles.scopeTitle}>
                    {locationFallbackActive && targetCity
                      ? `Ampliamos desde ${targetCity}`
                      : `Prestadores de ${locationScope || "tu zona"}`}
                  </Text>
                  <Text style={styles.scopeText}>
                    {locationFallbackActive
                      ? `No había resultados exactos en tu ciudad. Mostramos opciones de ${userLocation?.provincia || "tu provincia"} sin mezclar otras provincias.`
                      : "Priorizamos tu ciudad y a quienes informaron disponibilidad. Nunca mezclamos otra provincia automáticamente."}
                  </Text>
                  {(userLocation?.ciudad || userLocation?.localidad) && (
                    <View style={styles.scopeToggle}>
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => setLocationMode("auto")}
                        style={[
                          styles.scopeToggleButton,
                          locationMode === "auto" &&
                            styles.scopeToggleButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.scopeToggleText,
                            locationMode === "auto" &&
                              styles.scopeToggleTextActive,
                          ]}
                        >
                          Recomendado
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => setLocationMode("province")}
                        style={[
                          styles.scopeToggleButton,
                          locationMode === "province" &&
                            styles.scopeToggleButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.scopeToggleText,
                            locationMode === "province" &&
                              styles.scopeToggleTextActive,
                          ]}
                        >
                          Provincia
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() => setLocationMode("city")}
                        style={[
                          styles.scopeToggleButton,
                          locationMode === "city" &&
                            styles.scopeToggleButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.scopeToggleText,
                            locationMode === "city" &&
                              styles.scopeToggleTextActive,
                          ]}
                        >
                          Mi ciudad
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {legacyIncluded > 0 && (
                    <Text style={styles.legacyIncludedText}>
                      Incluye {legacyIncluded} registro
                      {legacyIncluded !== 1 ? "s" : ""} del formulario anterior
                      {campaignIncluded > 0
                        ? ` (${campaignIncluded} recuperado${campaignIncluded !== 1 ? "s" : ""} de campaña)`
                        : ""}
                      .
                    </Text>
                  )}
                </View>
              </View>
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={60} color="#a8dfe8" />
              <Text style={styles.emptyTitle}>Sin profesionales en tu zona</Text>
              <Text style={styles.emptyText}>
                No encontramos profesionales de {categoria}
                {locationScope ? ` disponibles en ${locationScope}` : ""} en
                este momento.
              </Text>
              <Text style={styles.emptyHint}>
                {locationMode === "city" &&
                scopedWorkerGroups.province.length > 0
                  ? "Hay prestadores en tu provincia. Podés ampliar el alcance sin mezclar otras provincias."
                  : "Probá otra categoría o cambiá tu ubicación desde el inicio."}
              </Text>
              {locationMode === "city" &&
              scopedWorkerGroups.province.length > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setLocationMode("province")}
                  style={styles.expandLocationButton}
                >
                  <Text style={styles.expandLocationButtonText}>
                    Ver toda la provincia
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      <WorkerDetailModal
        worker={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onBlocked={handleProviderBlocked}
        workerServices={workerServices}
        loadingServices={loadingServices}
      />
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f2f5" },
  headerGrad: { paddingHorizontal: 20, paddingVertical: 16, paddingTop: 40 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#069eb3", fontSize: 15 },
  listContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 30 },
  locationBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff7dd", borderRadius: 14, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: "#f4d47a" },
  locationBannerCopy: { flex: 1 },
  locationBannerTitle: { color: "#6b4700", fontSize: 14, fontWeight: "800", marginBottom: 2 },
  locationBannerText: { color: "#795548", fontSize: 12, fontWeight: "500", lineHeight: 17 },
  locationRetryButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#a8dfe8" },
  scopeBanner: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#e8f7f5", borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#b6e4df" },
  scopeBannerFallback: { backgroundColor: "#fff8e8", borderColor: "#efd49e" },
  scopeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#047a8f" },
  scopeTitle: { color: "#045f6f", fontSize: 15, fontWeight: "800", marginBottom: 2 },
  scopeText: { color: "#3c676b", fontSize: 12, lineHeight: 17 },
  scopeToggle: { flexDirection: "row", gap: 6, marginTop: 10 },
  scopeToggleButton: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 34, paddingHorizontal: 8, borderRadius: 17, borderWidth: 1, borderColor: "#9fcfca", backgroundColor: "rgba(255,255,255,0.65)" },
  scopeToggleButtonActive: { borderColor: "#047a8f", backgroundColor: "#047a8f" },
  scopeToggleText: { color: "#38666b", fontSize: 10, fontWeight: "800" },
  scopeToggleTextActive: { color: "#fff" },
  legacyIncludedText: { color: "#047a8f", fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 4 },
  expandLocationButton: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, backgroundColor: "#047a8f" },
  expandLocationButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#047a8f" },
  emptyText: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 20 },
  emptyHint: { fontSize: 12, color: "#7a7a7a", textAlign: "center", lineHeight: 18 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: "#069eb3", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  cardHeader: { flexDirection: "row", gap: 14, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#e8f7fa", borderWidth: 2, borderColor: "#a8dfe8" },
  cardInfo: { flex: 1, gap: 3 },
  workerName: { fontSize: 16, fontWeight: "700", color: "#222" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: "#555" },
  availabilityCard: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#eef8f9", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 11, borderWidth: 1, borderColor: "#cce8eb" },
  availabilityCardOnline: { backgroundColor: "#e9f8ee", borderColor: "#b9e5c8" },
  availabilityCardBusy: { backgroundColor: "#fff7e6", borderColor: "#f0d39b" },
  availabilityIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#d9f0f2" },
  availabilityIconOnline: { backgroundColor: "#159447" },
  availabilityCopy: { flex: 1 },
  availabilityTitle: { color: "#174d54", fontSize: 13, fontWeight: "800" },
  availabilityDetail: { color: "#4f6f73", fontSize: 11, marginTop: 1 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tag: { backgroundColor: "#e8f7fa", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#a8dfe8" },
  tagText: { fontSize: 12, color: "#047a8f", fontWeight: "600" },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeVerified: { backgroundColor: "#047a8f" },
  badgeDoc: { backgroundColor: "#069eb3" },
  badgeBasic: { backgroundColor: "#edf2f3", borderWidth: 1, borderColor: "#d3dfe1" },
  badgeSub: { backgroundColor: "#e6a817" },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  badgeTextBasic: { color: "#516468" },
  reputationRow: { gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e6efed" },
  reputationItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  reputationText: { flex: 1, color: "#31565b", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%", overflow: "hidden" },
  modalHero: { alignItems: "center", paddingVertical: 28, gap: 8 },
  modalAvatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: "rgba(255,255,255,0.6)" },
  modalName: { fontSize: 22, fontWeight: "800", color: "#fff" },
  modalAge: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  modalContent: { padding: 20, gap: 4 },
  modalRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  modalRowText: { fontSize: 15, color: "#333" },
  verifiedWorkPanel: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: "#bde4d5", backgroundColor: "#edf9f4" },
  verifiedWorkCopy: { flex: 1 },
  verifiedWorkTitle: { color: "#126846", fontSize: 13, lineHeight: 18, fontWeight: "900" },
  verifiedWorkText: { color: "#50746a", fontSize: 11, lineHeight: 16, marginTop: 2 },
  modalLabel: { fontSize: 12, fontWeight: "700", color: "#047a8f", marginBottom: 8, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.8 },
  verRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  verItem: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  verOk: { backgroundColor: "#069eb3" },
  verText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  profileInfoNotice: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#fff8e8", borderWidth: 1, borderColor: "#efd8a7", borderRadius: 12, padding: 12, marginBottom: 16 },
  profileInfoText: { flex: 1, color: "#6b5425", fontSize: 12, lineHeight: 18, fontWeight: "500" },
  docBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: "#f0f8fa", borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#a8dfe8" },
  docBtnText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#047a8f" },
  contactBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#069eb3", paddingVertical: 15, borderRadius: 30, marginTop: 10, shadowColor: "#069eb3", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  contactBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#fff", paddingVertical: 13, borderRadius: 30, marginTop: 16, borderWidth: 2, borderColor: "#069eb3" },
  shareBtnText: { color: "#069eb3", fontSize: 16, fontWeight: "700" },
  safetyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#fff8f7", paddingVertical: 12, borderRadius: 30, marginTop: 10, borderWidth: 1, borderColor: "#efc3bf" },
  safetyBtnText: { color: "#a43b32", fontSize: 14, fontWeight: "700" },
  closeBtn: { alignItems: "center", paddingVertical: 16, borderTopWidth: 1, borderTopColor: "#f0f2f5" },
  closeBtnText: { color: "#888", fontSize: 15, fontWeight: "600" },
  svcCard: { backgroundColor: "#f0f8fa", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#a8dfe8" },
  svcTitle: { fontSize: 15, fontWeight: "700", color: "#222", marginBottom: 4 },
  svcDesc: { fontSize: 13, color: "#555", lineHeight: 19, marginBottom: 8 },
  svcMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  svcMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  svcMetaText: { fontSize: 13, color: "#047a8f", fontWeight: "600" },
});
