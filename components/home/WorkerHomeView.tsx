import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import CategoryList from "./CategoryList";
import { supabase } from "../../lib/supabase";
import { obtenerPedidosDisponibles } from "../../lib/tooriApi";
import { respondToMicaOrder } from "../../lib/micaOrder";
import { getWorkerServiceRequests } from "../../lib/serviceRequests";
import {
  buildQuotePricing,
  pricingModeLabel,
  type QuotePricingMode,
  type QuoteReferenceType,
} from "../../lib/utils/quotePricing";
import WorkerState from "./WorkerState";
import JobsOverview from "../jobs/JobsOverview";

type Tab = "calendario" | "ofertas" | "contratar";

export default function WorkerHomeView({ navigation, onCategoryPress, busqueda = "" }: { navigation: any; onCategoryPress: (cat: string) => void; busqueda?: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("calendario");

  useEffect(() => {
    if (busqueda.trim().length > 0) setActiveTab("contratar");
  }, [busqueda]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "calendario", label: "Calendario", icon: "calendar-today" },
    { id: "ofertas", label: "Ofertas", icon: "work-outline" },
    { id: "contratar", label: "Contratar", icon: "person-add-alt" },
  ];

  return (
    <View style={styles.container}>
      <WorkerState style={styles.availabilityCard} />
      {/* Tab buttons */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={tab.icon as any}
                size={20}
                color={isActive ? "#fff" : "#069eb3"}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === "contratar" ? (
        <ContratarView navigation={navigation} onCategoryPress={onCategoryPress} busqueda={busqueda} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={true}>
          {activeTab === "calendario" && <CalendarioView navigation={navigation} />}
          {activeTab === "ofertas" && <OfertasView navigation={navigation} />}
        </ScrollView>
      )}
    </View>
  );
}

function CalendarioView({ navigation }: { navigation: any }) {
  return <JobsOverview navigation={navigation} compact />;
}

function OfertasView({ navigation }: { navigation: any }) {
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    );
    if (loading) anim.start();
    else anim.stop();
    return () => anim.stop();
  }, [loading]);

  const cargarOfertas = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener datos del usuario para consultar el puente Web/Mica.
      const { data: userData } = await supabase
        .from("usuarios")
        .select("categoria, id, nombre, celular, ciudad, provincia")
        .eq("id", user.id)
        .single();

      const categoriasUsuario: string[] = Array.isArray(userData?.categoria)
        ? userData.categoria.map((c: string) => c.trim()).filter(Boolean)
        : userData?.categoria
        ? [String(userData.categoria).trim()].filter(Boolean)
        : [];

      const userId = userData?.id || user.id;
      const [bridgeResult, appRequests] = await Promise.all([
        obtenerPedidosDisponibles({
          appUserId: userId,
          telefono: userData?.celular ? String(userData.celular) : null,
          oficios: categoriasUsuario,
          ciudad: userData?.ciudad ?? null,
          provincia: userData?.provincia ?? null,
          limit: 30,
        }),
        getWorkerServiceRequests({
          userId,
          trades: categoriasUsuario,
          city: userData?.ciudad ?? null,
          province: userData?.provincia ?? null,
          limit: 30,
        }),
      ]);

      const merged = new Map<string, any>();
      if (bridgeResult.ok) {
        for (const pedido of bridgeResult.data.pedidos) {
          if (!pedido.yaRespondio) merged.set(String(pedido.id), pedido);
        }
      }
      for (const pedido of appRequests) {
        if (pedido.alreadyResponded) continue;
        merged.set(String(pedido.id), {
          id: pedido.id,
          categoria: pedido.category,
          zona: pedido.zone,
          descripcion: pedido.description,
          estado: pedido.status,
          paso: pedido.step,
          createdAt: pedido.createdAt,
          mediaUrl: pedido.mediaUrl,
          videoUrls: pedido.videoUrls,
          presupuestoEstimado: pedido.estimatedBudget,
          source: pedido.source,
          metadata: pedido.metadata,
        });
      }

      setOfertas(
        Array.from(merged.values()).sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        ),
      );
    } catch (e: any) {
      setError("Error al cargar ofertas. Intenta nuevamente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargarOfertas(); }, []);

  const onRefresh = () => { setRefreshing(true); cargarOfertas(); };

  const [modalVisible, setModalVisible] = useState(false);
  const [ofertaSeleccionada, setOfertaSeleccionada] = useState<any>(null);
  const [modalidad, setModalidad] = useState<QuotePricingMode>("project");
  const [monto, setMonto] = useState("");
  const [unidades, setUnidades] = useState("1");
  const [tipoReferencia, setTipoReferencia] =
    useState<QuoteReferenceType>("estimate");
  const [descripcion, setDescripcion] = useState("");
  const [horarios, setHorarios] = useState("");
  const [materiales, setMateriales] = useState("Materiales incluidos");
  const [garantia, setGarantia] = useState("7 dias");
  const [validez, setValidez] = useState("24 horas");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const pricing = useMemo(
    () =>
      buildQuotePricing({
        pricingMode: modalidad,
        unitRate: Number(monto.replace(",", ".")),
        estimatedUnits: Number(unidades.replace(",", ".")),
        referenceType: tipoReferencia,
      }),
    [modalidad, monto, tipoReferencia, unidades],
  );

  const enviarPresupuesto = (oferta: any) => {
    setOfertaSeleccionada(oferta);
    setModalidad("project");
    setMonto("");
    setUnidades("1");
    setTipoReferencia("estimate");
    setDescripcion("");
    setHorarios("");
    setMateriales("Materiales incluidos");
    setGarantia("7 dias");
    setValidez("24 horas");
    setNotas("");
    setModalVisible(true);
  };

  const confirmarPresupuesto = async () => {
    if (pricing.amount <= 0 || !descripcion.trim() || !horarios.trim()) {
      Alert.alert("Campos incompletos", "Completá todos los campos antes de enviar.");
      return;
    }
    setEnviando(true);
    try {
      await respondToMicaOrder(String(ofertaSeleccionada.id), {
        type: "budget",
        amount: pricing.amount,
        pricingMode: pricing.pricingMode,
        unitRate: pricing.unitRate,
        estimatedUnits: pricing.estimatedUnits,
        referenceType: pricing.referenceType,
        description: descripcion.trim(),
        availability: horarios.trim(),
        materials: materiales.trim() || "A confirmar",
        warranty: garantia.trim() || "Sin garantía especificada",
        validUntil: validez.trim() || "24 horas",
        notes: notas.trim() || undefined,
      });

      setModalVisible(false);
      Alert.alert("¡Presupuesto enviado!", "Tu presupuesto fue enviado correctamente.", [
        { text: "OK", onPress: () => cargarOfertas() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo enviar el presupuesto.");
    } finally {
      setEnviando(false);
    }
  };

  const confirmarNoDisponible = async () => {
    if (!ofertaSeleccionada) return;
    setEnviando(true);
    try {
      await respondToMicaOrder(String(ofertaSeleccionada.id), {
        type: "decline",
      });

      setModalVisible(false);
      Alert.alert("Gracias", "Marcamos que no podés tomar este pedido.", [
        { text: "OK", onPress: () => cargarOfertas() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo responder el pedido.");
    } finally {
      setEnviando(false);
    }
  };

  const SkeletonCard = () => (
    <View style={styles.ofertaCard}>
      <Animated.View style={[styles.skeletonBadge, { opacity: pulse }]} />
      <Animated.View style={[styles.skeletonBadge, { width: "75%", height: 14, borderRadius: 8, opacity: pulse }]} />
      <Animated.View style={[styles.skeletonBadge, { width: "55%", height: 14, borderRadius: 8, opacity: pulse }]} />
      <Animated.View style={[styles.skeletonBlock, { opacity: pulse }]} />
    </View>
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#069eb3"]} />}
    >
      {/* Ofertas disponibles */}
      <Text style={styles.seccionTitle}>
        <MaterialIcons name="bolt" size={16} color="#069eb3" /> Publicaciones compatibles
      </Text>
      <Text style={styles.seccionSubtitle}>
        Necesidades de clientes que coinciden con tu profesión y tu zona
      </Text>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : error ? (
        <View style={styles.ofertasInfoBox}>
          <MaterialIcons name="error-outline" size={20} color="#d32f2f" />
          <Text style={[styles.ofertasInfoText, { color: "#d32f2f" }]}>{error}</Text>
        </View>
      ) : ofertas.length === 0 ? (
        <>
          <View style={styles.ofertasInfoBox}>
            <MaterialIcons name="info-outline" size={20} color="#047a8f" />
            <Text style={styles.ofertasInfoText}>
              Estamos buscando ofertas para tus profesiones. Si no ves ninguna, no te desesperes, es normal que no hayan tantas ofertas disponibles en tu zona.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.soporteButton}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate("MicaChat", { mode: "ofrecer-servicio" })
            }
          >
            <MaterialIcons name="support-agent" size={20} color="#fff" />
            <Text style={styles.soporteButtonText}>Consultar a MICA</Text>
          </TouchableOpacity>
        </>
      ) : (
        ofertas.map((oferta) => (
          <TouchableOpacity
            key={oferta.id}
            style={styles.ofertaCard}
            activeOpacity={0.85}
            onPress={() => enviarPresupuesto(oferta)}
          >
            <View style={styles.ofertaBadge}>
              <Text style={styles.ofertaBadgeText}>{oferta.categoria || "Sin categoría"}</Text>
            </View>
            <Text style={styles.ofertaTitulo}>{oferta.descripcion || "Sin descripción"}</Text>
            {!!oferta.nombre_cliente && (
              <Text style={styles.ofertaMeta}>👤 {oferta.nombre_cliente}</Text>
            )}
            {!!oferta.zona && (
              <Text style={styles.ofertaMeta}>📍 {oferta.zona}</Text>
            )}
            <View style={styles.ofertaFooter}>
              <Text style={styles.ofertaFooterText}>
                🕐 {(() => { const d = new Date(oferta.createdAt || Date.now()); return d.toLocaleString("es-AR"); })()}
              </Text>
              <View style={styles.presupuestosBadge}>
                <MaterialIcons name="send" size={12} color="#fff" />
                <Text style={styles.presupuestosBadgeText}>
                  {oferta.source === "manual_app" ? "Publicación" : "Pedido MICA"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 20 }} />

      {/* Modal presupuesto */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Presupuesto profesional</Text>
            {ofertaSeleccionada && (
              <View style={[styles.ofertasInfoBox, { marginBottom: 16 }]}>
                <MaterialIcons name="work-outline" size={18} color="#047a8f" />
                <Text style={styles.ofertasInfoText} numberOfLines={3}>
                  {ofertaSeleccionada.descripcion}
                </Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Modalidad</Text>
            <View style={styles.quoteModeRow}>
              {(["project", "hour", "day"] as QuotePricingMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.quoteModeChip, modalidad === mode && styles.quoteModeChipActive]}
                  onPress={() => setModalidad(mode)}
                >
                  <Text style={[styles.quoteModeText, modalidad === mode && styles.quoteModeTextActive]}>
                    {pricingModeLabel(mode)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>
              {modalidad === "project" ? "Importe cerrado ($)" : modalidad === "hour" ? "Tarifa por hora ($)" : "Tarifa por día ($)"}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: 5000"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              value={monto}
              onChangeText={setMonto}
            />

            {modalidad !== "project" ? (
              <>
                <Text style={styles.modalLabel}>
                  {modalidad === "hour" ? "Horas estimadas" : "Días estimados"}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ej: 3"
                  placeholderTextColor="#aaa"
                  keyboardType="decimal-pad"
                  value={unidades}
                  onChangeText={setUnidades}
                />
                <View style={styles.quoteModeRow}>
                  {(["estimate", "cap"] as QuoteReferenceType[]).map((kind) => (
                    <TouchableOpacity
                      key={kind}
                      style={[styles.quoteModeChip, tipoReferencia === kind && styles.quoteModeChipActive]}
                      onPress={() => setTipoReferencia(kind)}
                    >
                      <Text style={[styles.quoteModeText, tipoReferencia === kind && styles.quoteModeTextActive]}>
                        {kind === "estimate" ? "Total estimado" : "Tope máximo"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.quoteTotalBox}>
              <Text style={styles.quoteTotalLabel}>Total de referencia</Text>
              <Text style={styles.quoteTotalValue}>
                ${Math.round(pricing.amount).toLocaleString("es-AR")}
              </Text>
            </View>

            <Text style={styles.modalLabel}>Que incluye tu propuesta</Text>
            <TextInput
              style={[styles.modalInput, { height: 86, textAlignVertical: "top" }]}
              placeholder="Ej: visita, diagnostico, reparacion, limpieza y prueba final"
              placeholderTextColor="#aaa"
              multiline
              value={descripcion}
              onChangeText={setDescripcion}
            />

            <Text style={styles.modalLabel}>Materiales</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Incluidos / aparte / a confirmar"
              placeholderTextColor="#aaa"
              value={materiales}
              onChangeText={setMateriales}
            />

            <Text style={styles.modalLabel}>Tiempo u horarios disponibles</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Lunes a viernes de 9 a 18hs"
              placeholderTextColor="#aaa"
              value={horarios}
              onChangeText={setHorarios}
            />

            <View style={styles.modalTwoColumns}>
              <View style={styles.modalColumn}>
                <Text style={styles.modalLabel}>Garantia</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ej: 7 dias"
                  placeholderTextColor="#aaa"
                  value={garantia}
                  onChangeText={setGarantia}
                />
              </View>
              <View style={styles.modalColumn}>
                <Text style={styles.modalLabel}>Validez</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ej: 24 horas"
                  placeholderTextColor="#aaa"
                  value={validez}
                  onChangeText={setValidez}
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>Notas para el cliente</Text>
            <TextInput
              style={[styles.modalInput, { height: 72, textAlignVertical: "top" }]}
              placeholder="Ej: no incluye repuestos especiales si aparecen piezas rotas"
              placeholderTextColor="#aaa"
              multiline
              value={notas}
              onChangeText={setNotas}
            />

            <TouchableOpacity
              style={[styles.soporteButton, { marginTop: 8 }]}
              activeOpacity={0.85}
              onPress={confirmarPresupuesto}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="send" size={18} color="#fff" />
                  <Text style={styles.soporteButtonText}>Enviar presupuesto</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={confirmarNoDisponible}
              disabled={enviando}
            >
              <Text style={styles.modalCancelText}>No puedo tomarlo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setModalVisible(false)}
              disabled={enviando}
            >
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function ContratarView({ navigation, onCategoryPress, busqueda }: { navigation: any; onCategoryPress: (cat: string) => void; busqueda: string }) {
  return (
    <CategoryList
      busqueda={busqueda}
      onCategoryPress={onCategoryPress}
      isUserRestricted={false}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  availabilityCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 2,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: "#e8f7fa",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 5,
  },
  tabButtonActive: {
    backgroundColor: "#069eb3",
    shadowColor: "#069eb3",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#069eb3",
  },
  tabLabelActive: {
    color: "#fff",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  // Placeholder views
  placeholderCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    shadowColor: "#069eb3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    gap: 14,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#047a8f",
  },
  placeholderText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  // Ofertas
  ofertasCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#069eb3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    gap: 16,
  },
  ofertasHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ofertasTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#047a8f",
  },
  skeletonContainer: {
    gap: 12,
    paddingVertical: 4,
  },
  skeletonBadge: {
    width: 110,
    height: 28,
    backgroundColor: "#a8dfe8",
    borderRadius: 20,
    marginBottom: 10,
  },
  skeletonBlock: {
    height: 50,
    backgroundColor: "#a8dfe8",
    borderRadius: 10,
    marginTop: 4,
  },
  seccionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#047a8f",
    marginBottom: 4,
    marginTop: 4,
  },
  seccionSubtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 14,
  },
  ofertaCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#069eb3",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  ofertaBadge: {
    backgroundColor: "#069eb3",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  ofertaBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  ofertaTitulo: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
    marginBottom: 6,
  },
  ofertaDesc: {
    fontSize: 13,
    color: "#555",
    marginBottom: 4,
  },
  ofertaMeta: {
    fontSize: 13,
    color: "#666",
    marginBottom: 3,
  },
  ofertaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  ofertaFooterText: {
    fontSize: 12,
    color: "#888",
  },
  presupuestosBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#047a8f",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  presupuestosBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  ofertasInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f0f8fa",
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#069eb3",
  },
  ofertasInfoText: {
    flex: 1,
    color: "#047a8f",
    fontSize: 13,
    lineHeight: 20,
  },
  soporteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#069eb3",
    paddingVertical: 13,
    borderRadius: 30,
    gap: 8,
    shadowColor: "#069eb3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  soporteButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  // Modal presupuesto
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
    maxHeight: "88%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#047a8f",
    marginBottom: 16,
    textAlign: "center",
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047a8f",
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: "#f0f8fa",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#a8dfe8",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#222",
  },
  quoteModeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 5,
  },
  quoteModeChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c7dadd",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  quoteModeChipActive: {
    borderColor: "#069eb3",
    backgroundColor: "#e8f8fa",
  },
  quoteModeText: {
    color: "#61787d",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  quoteModeTextActive: { color: "#057f91" },
  quoteTotalBox: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#e9f8fa",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quoteTotalLabel: { color: "#315e67", fontSize: 12, fontWeight: "800" },
  quoteTotalValue: { color: "#047a8f", fontSize: 19, fontWeight: "900" },
  modalTwoColumns: {
    flexDirection: "row",
    gap: 10,
  },
  modalColumn: {
    flex: 1,
  },
  modalCancelBtn: {
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 10,
  },
  modalCancelText: {
    color: "#888",
    fontSize: 15,
    fontWeight: "600",
  },
});
