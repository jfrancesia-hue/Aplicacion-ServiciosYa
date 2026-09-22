import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SelectCitySheetView from "../components/home/SelectCitySheetView";
import { withModalProvider } from "../components/sheet/withModalProvider";
import {
  type MyServiceRequest,
  type PreferredBudgetMode,
  type ServiceRequestUrgency,
  type ToolsResponsibility,
  cancelServiceRequest,
  createManualServiceRequest,
  getMyServiceRequests,
} from "../lib/serviceRequests";
import { supabase } from "../lib/supabase";
import { uniqueCategoryNames } from "../lib/utils/categoryNames";
import { getMicaRequestLocationStatus } from "../lib/utils/micaLocation";
import { useLocationStore } from "../store/locationStore";
import type { MainStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<MainStackParamList, "PublicarNecesidad">;

const urgencyOptions: Array<{
  value: ServiceRequestUrgency;
  label: string;
  detail: string;
}> = [
  { value: "normal", label: "Normal", detail: "Sin apuro" },
  { value: "pronto", label: "Pronto", detail: "En los próximos días" },
  { value: "urgente", label: "Urgente", detail: "Necesito prioridad" },
];

const toolsOptions: Array<{ value: ToolsResponsibility; label: string }> = [
  { value: "a_coordinar", label: "A coordinar" },
  { value: "prestador", label: "Los lleva el prestador" },
  { value: "cliente", label: "Los tengo yo" },
];

const budgetModes: Array<{ value: PreferredBudgetMode; label: string }> = [
  { value: "a_coordinar", label: "Que el prestador recomiende" },
  { value: "proyecto", label: "Por proyecto" },
  { value: "hora", label: "Por hora" },
  { value: "dia", label: "Por día" },
];

const LOCATION_SHEET_SNAP_POINTS = ["70%"];

function statusCopy(request: MyServiceRequest) {
  if (request.chatId || request.selectedBudgetId) return "Presupuesto elegido";
  if (["cancelada", "cancelado"].includes(request.status.toLowerCase()))
    return "Cancelada";
  if (["finalizada", "finalizado"].includes(request.status.toLowerCase()))
    return "Finalizada";
  if (request.responseCount > 0)
    return `${request.responseCount} propuesta${request.responseCount === 1 ? "" : "s"}`;
  return "Esperando propuestas";
}

function PublicarNecesidad({ navigation, route }: Props) {
  const effectiveLocation = useLocationStore(
    (state) => state.effectiveLocation,
  );
  const locationSource = useLocationStore((state) => state.source);
  const automaticZoneRef = useRef("");
  const locationSheetRef = useRef<BottomSheetModal>(null);
  const [activeView, setActiveView] = useState<"history" | "new">(
    route.params?.view ?? "history",
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [zone, setZone] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [province, setProvince] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>("normal");
  const [toolsResponsibility, setToolsResponsibility] =
    useState<ToolsResponsibility>("a_coordinar");
  const [teamSize, setTeamSize] = useState(1);
  const [budgetMode, setBudgetMode] =
    useState<PreferredBudgetMode>("a_coordinar");
  const [requests, setRequests] = useState<MyServiceRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const [{ data: categoryRows }, { data: profile }] = await Promise.all([
        supabase.from("categorias").select("nombre").order("nombre"),
        supabase
          .from("usuarios")
          .select("ciudad,provincia")
          .eq("id", auth.user.id)
          .maybeSingle(),
      ]);

      const values = uniqueCategoryNames(
        (categoryRows ?? []).map((item) => item.nombre),
      );
      setCategories(values);
      if (values.length > 0) setCategory((current) => current || values[0]);

      const locationState = useLocationStore.getState();
      const detectedLocation =
        locationState.source === "ip" ? null : locationState.effectiveLocation;
      const detectedCity =
        detectedLocation?.city ?? detectedLocation?.locality ?? profile?.ciudad;
      const detectedProvince = detectedLocation?.province ?? profile?.provincia;
      const location = [detectedCity, detectedProvince]
        .filter(Boolean)
        .join(", ");
      setCity(detectedCity ?? null);
      setProvince(detectedProvince ?? null);
      setZone((current) => current || location);
    };

    loadInitialData().catch(() => undefined);
  }, []);

  useEffect(() => {
    setActiveView(route.params?.view ?? "history");
  }, [route.params?.view]);

  useEffect(() => {
    const currentCity =
      effectiveLocation?.city ?? effectiveLocation?.locality ?? null;
    const currentProvince = effectiveLocation?.province ?? null;
    if (locationSource === "ip" || (!currentCity && !currentProvince)) return;

    const automaticZone = [currentCity, currentProvince]
      .filter(Boolean)
      .join(", ");
    setCity(currentCity);
    setProvince(currentProvince);
    setZone((current) =>
      !current.trim() || current === automaticZoneRef.current
        ? automaticZone
        : current,
    );
    automaticZoneRef.current = automaticZone;
  }, [effectiveLocation, locationSource]);

  const loadRequests = useCallback(async () => {
    try {
      setRequestsError(null);
      setRequests(await getMyServiceRequests());
    } catch (error) {
      console.warn("[Publicaciones] no se pudieron cargar", error);
      setRequestsError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar tus búsquedas.",
      );
    } finally {
      setLoadingRequests(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const descriptionRemaining = useMemo(
    () => Math.max(0, 20 - description.trim().length),
    [description],
  );

  const submit = async () => {
    if (!category.trim()) {
      Alert.alert(
        "Falta la categoría",
        "Elegí el tipo de servicio que necesitás.",
      );
      return;
    }
    if (description.trim().length < 20) {
      Alert.alert(
        "Contanos un poco más",
        `La descripción necesita ${descriptionRemaining} caracteres más para que el prestador pueda cotizar bien.`,
      );
      return;
    }
    if (!zone.trim()) {
      Alert.alert(
        "Falta la zona",
        "Indicá la localidad o zona donde se realizará el trabajo.",
      );
      return;
    }
    const requestLocation = getMicaRequestLocationStatus({
      requestedZone: zone,
      fallbackCity: city,
      fallbackProvince: province,
    });
    if (!requestLocation.isComplete || !effectiveLocation) {
      Alert.alert(
        "Falta confirmar la ubicación",
        "Usá el GPS o ingresá una dirección exacta. Una ciudad o un barrio sin coordenadas no alcanza para publicar.",
        [
          { text: "Ahora no", style: "cancel" },
          {
            text: "Elegir manualmente",
            onPress: () => locationSheetRef.current?.present(),
          },
        ],
      );
      return;
    }

    setSubmitting(true);
    try {
      const offerId = await createManualServiceRequest({
        category: category.trim(),
        description: description.trim(),
        zone: requestLocation.label as string,
        city: requestLocation.city,
        province: requestLocation.province,
        latitude: effectiveLocation.latitude,
        longitude: effectiveLocation.longitude,
        urgency,
        toolsResponsibility,
        teamSize,
        preferredBudgetMode: budgetMode,
      });

      setDescription("");
      setUrgency("normal");
      setToolsResponsibility("a_coordinar");
      setTeamSize(1);
      setBudgetMode("a_coordinar");
      await loadRequests();
      setActiveView("history");

      Alert.alert(
        "Publicación activa",
        "Los prestadores compatibles ya pueden verla y enviarte una propuesta. Tus datos de contacto siguen protegidos.",
        [
          { text: "Seguir acá", style: "cancel" },
          {
            text: "Ver seguimiento",
            onPress: () =>
              navigation.navigate("MicaChat", {
                mode: "buscar-servicio",
                offerId,
              }),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        "No se pudo publicar",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = (request: MyServiceRequest) => {
    Alert.alert(
      "Cancelar publicación",
      "Dejará de mostrarse a nuevos prestadores. Las propuestas recibidas quedarán registradas.",
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Cancelar publicación",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelServiceRequest(request.id);
              await loadRequests();
            } catch (error) {
              Alert.alert(
                "No se pudo cancelar",
                error instanceof Error ? error.message : "Intentá nuevamente.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={23} color="#064b59" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>
            {activeView === "history" ? "Mis búsquedas" : "Nueva publicación"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {activeView === "history"
              ? "Seguimiento, propuestas e historial"
              : "Recibí propuestas de prestadores"}
          </Text>
        </View>
      </View>

      <View style={styles.viewTabs}>
        <TouchableOpacity
          onPress={() => setActiveView("history")}
          style={[
            styles.viewTab,
            activeView === "history" && styles.viewTabActive,
          ]}
        >
          <Ionicons
            name="documents-outline"
            size={18}
            color={activeView === "history" ? "#fff" : "#087d8d"}
          />
          <Text
            style={[
              styles.viewTabText,
              activeView === "history" && styles.viewTabTextActive,
            ]}
          >
            Mis búsquedas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveView("new")}
          style={[styles.viewTab, activeView === "new" && styles.viewTabActive]}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={activeView === "new" ? "#fff" : "#087d8d"}
          />
          <Text
            style={[
              styles.viewTabText,
              activeView === "new" && styles.viewTabTextActive,
            ]}
          >
            Nueva publicación
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRequests();
            }}
          />
        }
      >
        {activeView === "new" ? (
          <>
            <View style={styles.introCard}>
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color="#087d8d"
              />
              <Text style={styles.introText}>
                Publicá el trabajo sin compartir teléfono, email ni enlaces.
                Podés conversar cada propuesta antes de elegirla.
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>¿Qué necesitás?</Text>

              <Text style={styles.label}>Categoría</Text>
              <View style={styles.pickerShell}>
                {categories.length === 0 ? (
                  <ActivityIndicator
                    color="#069eb3"
                    style={styles.pickerLoading}
                  />
                ) : (
                  <Picker
                    selectedValue={category}
                    onValueChange={setCategory}
                    style={styles.picker}
                  >
                    {categories.map((item) => (
                      <Picker.Item key={item} label={item} value={item} />
                    ))}
                  </Picker>
                )}
              </View>

              <Text style={styles.label}>Descripción del trabajo</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Ej: necesito reparar una pérdida debajo de la mesada; empezó hoy y la llave de paso funciona."
                placeholderTextColor="#8a9aa0"
                multiline
                maxLength={1500}
                style={[styles.input, styles.descriptionInput]}
              />
              <Text style={styles.helperText}>
                {descriptionRemaining > 0
                  ? `Faltan ${descriptionRemaining} caracteres como mínimo.`
                  : "Buen nivel de detalle para recibir propuestas."}
              </Text>

              <Text style={styles.label}>Ciudad y provincia</Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => locationSheetRef.current?.present()}
                style={[
                  styles.locationPicker,
                  (!city || !province) && styles.locationPickerMissing,
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={city && province ? "#087d8d" : "#9a6000"}
                />
                <View style={styles.locationPickerCopy}>
                  <Text style={styles.locationPickerValue}>
                    {[city, province].filter(Boolean).join(", ") ||
                      "Ubicación sin confirmar"}
                  </Text>
                  <Text style={styles.locationPickerHint}>
                    {locationSource === "ip" && !city
                      ? "La IP es aproximada: elegí la ciudad manualmente"
                      : "Usá GPS o elegí una ciudad de Argentina"}
                  </Text>
                </View>
                <Text style={styles.locationPickerAction}>
                  {city && province ? "Cambiar" : "Elegir"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Barrio o referencia</Text>
              <TextInput
                value={zone}
                onChangeText={setZone}
                placeholder="Ej: Barrio 9 de Julio"
                placeholderTextColor="#8a9aa0"
                style={styles.input}
              />
              <Text style={styles.helperText}>
                No publiques calle ni número: se comparten con el prestador
                elegido dentro del chat seguro.
              </Text>

              <Text style={styles.label}>Prioridad</Text>
              <View style={styles.optionGrid}>
                {urgencyOptions.map((option) => {
                  const selected = urgency === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                      ]}
                      onPress={() => setUrgency(option.value)}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          selected && styles.optionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.optionDetail}>{option.detail}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {urgency === "urgente" ? (
                <Text style={styles.noticeText}>
                  La publicación quedará destacada como prioritaria. El plazo de
                  respuesta de 20 minutos se usa al elegir un prestador y
                  enviarle una solicitud urgente explícita.
                </Text>
              ) : null}

              <Text style={styles.label}>Herramientas y materiales</Text>
              <View style={styles.chipRow}>
                {toolsOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.chip,
                      toolsResponsibility === option.value &&
                        styles.chipSelected,
                    ]}
                    onPress={() => setToolsResponsibility(option.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        toolsResponsibility === option.value &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>
                Personas estimadas para el trabajo
              </Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => setTeamSize((value) => Math.max(1, value - 1))}
                >
                  <Ionicons name="remove" size={20} color="#087d8d" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{teamSize}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() =>
                    setTeamSize((value) => Math.min(10, value + 1))
                  }
                >
                  <Ionicons name="add" size={20} color="#087d8d" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>
                Modalidad de presupuesto preferida
              </Text>
              <View style={styles.chipRow}>
                {budgetModes.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.chip,
                      budgetMode === option.value && styles.chipSelected,
                    ]}
                    onPress={() => setBudgetMode(option.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        budgetMode === option.value && styles.chipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                disabled={submitting}
                style={[
                  styles.submitButton,
                  submitting && styles.disabledButton,
                ]}
                onPress={submit}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="megaphone-outline" size={20} color="#fff" />
                    <Text style={styles.submitText}>Publicar necesidad</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {activeView === "history" ? (
          <>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>Todas tus búsquedas</Text>
              <Text style={styles.historyHint}>
                Tocá una para ver sus propuestas
              </Text>
            </View>

            {requestsError ? (
              <View style={styles.errorCard}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={25}
                  color="#a33f3f"
                />
                <Text style={styles.errorText}>{requestsError}</Text>
                <TouchableOpacity
                  onPress={loadRequests}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : loadingRequests ? (
              <ActivityIndicator
                color="#069eb3"
                style={styles.historyLoading}
              />
            ) : requests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="documents-outline" size={28} color="#7b9298" />
                <Text style={styles.emptyText}>
                  Todavía no publicaste ninguna necesidad.
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveView("new")}
                  style={styles.emptyAction}
                >
                  <Text style={styles.emptyActionText}>Crear la primera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              requests.map((request) => {
                const closed = [
                  "cancelada",
                  "cancelado",
                  "finalizada",
                  "finalizado",
                ].includes(request.status.toLowerCase());
                const canCancel =
                  !closed && !request.selectedBudgetId && !request.chatId;
                return (
                  <TouchableOpacity
                    key={request.id}
                    activeOpacity={0.8}
                    style={[
                      styles.requestCard,
                      closed && styles.requestCardDisabled,
                    ]}
                    onPress={() =>
                      navigation.navigate("MicaChat", {
                        mode: "buscar-servicio",
                        offerId: request.id,
                      })
                    }
                  >
                    <View style={styles.requestTopRow}>
                      <View style={styles.sourceBadge}>
                        <Text style={styles.sourceText}>
                          {request.source === "manual_app"
                            ? "PUBLICACIÓN"
                            : "MICA"}
                        </Text>
                      </View>
                      <Text style={styles.requestDate}>
                        {new Date(request.createdAt).toLocaleDateString(
                          "es-AR",
                        )}
                      </Text>
                    </View>
                    <Text style={styles.requestCategory}>
                      {request.category}
                    </Text>
                    <View style={styles.requestZoneRow}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color="#087d8d"
                      />
                      <Text style={styles.requestZone} numberOfLines={2}>
                        {request.zone || "Ubicación no informada"}
                      </Text>
                    </View>
                    <Text style={styles.requestDescription} numberOfLines={3}>
                      {request.description}
                    </Text>
                    <View style={styles.requestFooter}>
                      <View style={styles.requestStatus}>
                        <Ionicons
                          name={
                            closed
                              ? "archive-outline"
                              : request.responseCount > 0
                                ? "mail-open-outline"
                                : "time-outline"
                          }
                          size={15}
                          color="#087d8d"
                        />
                        <Text style={styles.requestStatusText}>
                          {statusCopy(request)}
                        </Text>
                      </View>
                      {canCancel ? (
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => cancel(request)}
                        >
                          <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>
      <BottomSheetModal
        ref={locationSheetRef}
        snapPoints={LOCATION_SHEET_SNAP_POINTS}
        enablePanDownToClose
      >
        <SelectCitySheetView />
      </BottomSheetModal>
    </KeyboardAvoidingView>
  );
}

export default withModalProvider(PublicarNecesidad);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6f7" },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dbe5e7",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#eaf8fa",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#14343b" },
  headerSubtitle: { fontSize: 13, color: "#607b81", marginTop: 2 },
  viewTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dbe5e7",
  },
  viewTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bcdde1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  viewTabActive: { backgroundColor: "#087d8d", borderColor: "#087d8d" },
  viewTabText: { color: "#087d8d", fontSize: 12, fontWeight: "900" },
  viewTabTextActive: { color: "#fff" },
  content: { padding: 16, paddingBottom: 44 },
  introCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#e9f8f9",
    borderWidth: 1,
    borderColor: "#c9ecef",
    marginBottom: 14,
  },
  introText: {
    flex: 1,
    color: "#315e67",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    elevation: 2,
  },
  sectionTitle: { color: "#183a42", fontSize: 18, fontWeight: "900" },
  label: {
    color: "#314f56",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 17,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cedbde",
    borderRadius: 13,
    backgroundColor: "#fbfdfd",
    paddingHorizontal: 13,
    minHeight: 48,
    color: "#17383f",
    fontSize: 15,
  },
  descriptionInput: {
    minHeight: 112,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  helperText: { marginTop: 5, color: "#6c848a", fontSize: 11 },
  locationPicker: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: "#bcdde1",
    borderRadius: 13,
    backgroundColor: "#effafb",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationPickerMissing: {
    borderColor: "#efc56f",
    backgroundColor: "#fff8e8",
  },
  locationPickerCopy: { flex: 1 },
  locationPickerValue: { color: "#244950", fontSize: 13, fontWeight: "900" },
  locationPickerHint: {
    color: "#71878c",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  locationPickerAction: { color: "#087d8d", fontSize: 11, fontWeight: "900" },
  pickerShell: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#cedbde",
    borderRadius: 13,
    backgroundColor: "#fbfdfd",
    overflow: "hidden",
    justifyContent: "center",
  },
  picker: { color: "#17383f" },
  pickerLoading: { padding: 14 },
  optionGrid: { flexDirection: "row", gap: 8 },
  optionCard: {
    flex: 1,
    minHeight: 68,
    padding: 9,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d4dfe1",
    borderRadius: 12,
    backgroundColor: "#fbfdfd",
  },
  optionCardSelected: { borderColor: "#069eb3", backgroundColor: "#e8f8fa" },
  optionLabel: { color: "#425d63", fontWeight: "800", fontSize: 13 },
  optionLabelSelected: { color: "#057f91" },
  optionDetail: { color: "#71878c", fontSize: 10, marginTop: 3 },
  noticeText: { marginTop: 8, color: "#946014", fontSize: 11, lineHeight: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#cfdbde",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipSelected: { borderColor: "#069eb3", backgroundColor: "#e6f7f9" },
  chipText: { color: "#536c72", fontSize: 12, fontWeight: "700" },
  chipTextSelected: { color: "#057f91" },
  counterRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#e7f7f9",
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    minWidth: 30,
    textAlign: "center",
    color: "#183a42",
    fontSize: 18,
    fontWeight: "900",
  },
  submitButton: {
    marginTop: 22,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#069eb3",
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: { opacity: 0.65 },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  historyHeader: { marginTop: 24, marginBottom: 10 },
  historyHint: { color: "#6d8388", fontSize: 12, marginTop: 3 },
  historyLoading: { padding: 28 },
  emptyCard: {
    alignItems: "center",
    gap: 8,
    padding: 28,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  emptyText: { color: "#6a8085", fontSize: 13 },
  emptyAction: {
    marginTop: 6,
    borderRadius: 11,
    backgroundColor: "#087d8d",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  emptyActionText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  errorCard: {
    alignItems: "center",
    gap: 8,
    padding: 22,
    borderRadius: 16,
    backgroundColor: "#fff1f1",
    borderWidth: 1,
    borderColor: "#f1c5c5",
  },
  errorText: { color: "#8d3c3c", fontSize: 12, textAlign: "center" },
  retryButton: {
    borderRadius: 10,
    backgroundColor: "#a33f3f",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryButtonText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#069eb3",
  },
  requestCardDisabled: { opacity: 0.55, borderLeftColor: "#9daeb1" },
  requestZoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  requestZone: { flex: 1, color: "#087d8d", fontSize: 11, fontWeight: "800" },
  requestTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourceBadge: {
    backgroundColor: "#e8f7f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  sourceText: { color: "#057f91", fontSize: 9, fontWeight: "900" },
  requestDate: { color: "#85979b", fontSize: 11 },
  requestCategory: {
    marginTop: 9,
    color: "#17383f",
    fontWeight: "900",
    fontSize: 16,
  },
  requestDescription: {
    marginTop: 4,
    color: "#50696f",
    fontSize: 13,
    lineHeight: 18,
  },
  requestFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requestStatus: { flexDirection: "row", gap: 5, alignItems: "center" },
  requestStatusText: { color: "#087d8d", fontWeight: "800", fontSize: 12 },
  cancelButton: { paddingHorizontal: 9, paddingVertical: 6 },
  cancelText: { color: "#a34545", fontSize: 12, fontWeight: "800" },
});
