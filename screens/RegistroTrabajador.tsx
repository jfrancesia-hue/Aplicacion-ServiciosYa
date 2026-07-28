import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Switch,
  Alert,
  Image,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../types/navigation";
import { supabase } from "../lib/supabase";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { AuthContext } from "../lib/context/AppContext";
import { syncPrestadorConToori } from "../lib/tooriApi";
import vexo from "../lib/vexo";
import type { UserUpdate } from "../types/db.overrides.types";

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type SelectedFile = {
  uri: string;
  tipo: "imagen" | "pdf";
  nombre: string;
};
type RegistrationUpdate = UserUpdate & {
  perfilPublico?: boolean;
};

export default function RegistroTrabajadorSimplificado() {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>([]);
  const [busquedaCategoria, setBusquedaCategoria] = useState("");
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  const [dni, setDni] = useState("");
  const [provincia, setProvincia] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [barrio, setBarrio] = useState("");
  const [matriculaArchivos, setMatriculaArchivos] = useState<SelectedFile[]>([]);
  const [antecedentesArchivos, setAntecedentesArchivos] = useState<SelectedFile[]>([]);
  const [antiguedad, setAntiguedad] = useState("");

  const navigation = useNavigation<NavigationProp>();
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [numeroCelular, setNumeroCelular] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [loading, setLoading] = useState(false);
  const { location, setLocation } = useContext(AuthContext);
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [mostrarModal, setMostrarModal] = useState(true);
  const [procesandoModal, setProcesandoModal] = useState(false);
  const [mostrarOpcionales, setMostrarOpcionales] = useState(false);

  const isInBolivia = (lat: number, lon: number) => {
    return lat >= -23.0 && lat <= -9.5 && lon >= -69.6 && lon <= -57.5;
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("nombre")
        .order("nombre", { ascending: true });
      if (!error && data) setCategorias(data.map((c) => c.nombre));
    })();
  }, []);

  const categoriasFiltradas = categorias.filter(
    (c) =>
      c.toLowerCase().includes(busquedaCategoria.toLowerCase()) &&
      !categoriasSeleccionadas.includes(c)
  );

  const agregarCategoria = (cat: string) => {
    if (categoriasSeleccionadas.length >= 3) {
      Alert.alert("Máximo 3 categorías");
      return;
    }
    setCategoriasSeleccionadas([...categoriasSeleccionadas, cat]);
    setBusquedaCategoria("");
    setMostrarDropdown(false);
  };

  const quitarCategoria = (cat: string) => {
    setCategoriasSeleccionadas(categoriasSeleccionadas.filter((c) => c !== cat));
  };

  const seleccionarFotoPerfil = async () => {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert("Permiso requerido", "Debes permitir acceso a la galería.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        setFotoPerfil(result.assets[0].uri);
      }
    } catch (e) {
      console.log("Error seleccionando foto:", e);
    }
  };

  const seleccionarArchivos = async (
    lista: SelectedFile[],
    setLista: (v: SelectedFile[]) => void,
    tipo: "imagen" | "pdf"
  ) => {
    if (lista.length >= 3) {
      Alert.alert("Máximo 3 archivos");
      return;
    }
    try {
      if (tipo === "imagen") {
        const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permiso.granted) {
          Alert.alert("Permiso requerido");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
        });
        if (!result.canceled && result.assets.length > 0) {
          setLista([...lista, { uri: result.assets[0].uri, tipo: "imagen", nombre: `imagen_${Date.now()}.jpg` }]);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets.length > 0) {
          const asset = result.assets[0];
          setLista([...lista, { uri: asset.uri, tipo: "pdf", nombre: asset.name }]);
        }
      }
    } catch (e) {
      console.log("Error seleccionando archivo:", e);
    }
  };

  const subirArchivo = async (uri: string, nombre: string, contentType: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    const nombreArchivo = `${user?.id}-${nombre}-${Date.now()}`;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage
      .from("imagenes")
      .upload(nombreArchivo, buffer, { contentType, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("imagenes").getPublicUrl(nombreArchivo);
    return data.publicUrl;
  };

  const subirFoto = async (uri: string) => {
    return await subirArchivo(uri, "perfil.jpg", "image/jpeg");
  };

  const subirListaArchivos = async (lista: SelectedFile[]) => {
    const urls: string[] = [];
    for (const archivo of lista) {
      const contentType = archivo.tipo === "pdf" ? "application/pdf" : "image/jpeg";
      const url = await subirArchivo(archivo.uri, archivo.nombre, contentType);
      urls.push(url);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (
      !nombre.trim() ||
      !numeroCelular.trim() ||
      categoriasSeleccionadas.length === 0 ||
      !ciudad.trim() ||
      !provincia.trim()
    ) {
      Alert.alert(
        "Faltan datos básicos",
        "Completá nombre, celular, especialidad, provincia y ciudad.",
      );
      return;
    }
    const edadNum = edad.trim() ? Number.parseInt(edad, 10) : null;
    if (
      edadNum !== null &&
      (Number.isNaN(edadNum) || edadNum < 18 || edadNum > 100)
    ) {
      Alert.alert("Edad inválida", "Debes ser mayor de 18 años.");
      return;
    }
    const antiguedadNum = antiguedad.trim()
      ? Number.parseFloat(antiguedad.replace(",", "."))
      : null;
    if (
      antiguedadNum !== null &&
      (Number.isNaN(antiguedadNum) || antiguedadNum < 0)
    ) {
      Alert.alert("Antigüedad inválida", "Ingresa un número válido.");
      return;
    }
    if (numeroCelular.length < 8) {
      Alert.alert("Celular inválido", "El número debe tener al menos 8 dígitos.");
      return;
    }
    if (!aceptaTerminos) {
      Alert.alert("Debes aceptar los términos y condiciones.");
      return;
    }
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        Alert.alert("Error", "No se pudo obtener el usuario.");
        return;
      }

      let urlFotoPerfil = null;
      if (fotoPerfil) {
        try { urlFotoPerfil = await subirFoto(fotoPerfil); } catch (e) {
          Alert.alert("Error", "No se pudo subir la foto.");
        }
      }

      let matriculaUrls: string[] = [];
      let antecedentesUrls: string[] = [];

      if (matriculaArchivos.length > 0) {
        matriculaUrls = await subirListaArchivos(matriculaArchivos);
      }
      if (antecedentesArchivos.length > 0) {
        antecedentesUrls = await subirListaArchivos(antecedentesArchivos);
      }

      // Cargar documentos no equivale a validarlos. La verificación se realiza
      // por separado para evitar insignias engañosas.
      const verificado = false;
      const enBolivia = location
        ? isInBolivia(location.latitude, location.longitude)
        : false;
      const domicilio = `${ciudad}, ${provincia}${barrio ? `, ${barrio}` : ""}`;

      const updateData: RegistrationUpdate = {
        rol: "worker",
        nombre: nombre.trim(),
        celular: numeroCelular.trim(),
        categoria: categoriasSeleccionadas,
        domicilio,
        ciudad: ciudad.trim(),
        provincia: provincia.trim(),
        barrio: barrio || null,
        verificado: false,
        perfil_completo: true,
        perfilPublico: true,
        dni_verificado: false,
        pago: !enBolivia,
        creditos: 0,
      };

      if (edadNum !== null) updateData.edad = edadNum;
      if (dni.trim()) updateData.dni = dni.trim();
      if (antiguedadNum !== null) updateData.antiguedad = antiguedadNum;
      if (matriculaUrls.length > 0) updateData.matricula = matriculaUrls[0];
      if (antecedentesUrls.length > 0) {
        updateData.antecedentes = antecedentesUrls[0];
      }
      if (urlFotoPerfil) updateData.foto_perfil = urlFotoPerfil;

      const { error } = await supabase.from("usuarios").update(updateData).eq("id", user.id);
      if (error) {
        Alert.alert("Error", "No se pudo guardar la información.");
        return;
      }

      const now = new Date();
      const availableUntil = new Date(
        now.getTime() + 12 * 60 * 60 * 1000,
      ).toISOString();
      const { error: availabilityError } = await supabase
        .from("workers")
        .upsert(
          {
            user_id: user.id,
            status: "ONLINE",
            last_seen_at: now.toISOString(),
            available_until: availableUntil,
            availability_duration_hours: 12,
          },
          { onConflict: "user_id" },
        );
      if (availabilityError) {
        console.warn(
          "El perfil se publicó, pero no se pudo confirmar disponibilidad:",
          availabilityError,
        );
      }

      const syncResult = await syncPrestadorConToori({
        appUserId: user.id,
        nombre,
        telefono: numeroCelular,
        email: user.email ?? null,
        oficios: categoriasSeleccionadas,
        ciudad,
        provincia,
        barrio: barrio || null,
        verificado,
      });

      if (!syncResult.ok && !syncResult.skipped) {
        console.warn("No se pudo sincronizar prestador con Toori/Mica", syncResult.error, syncResult.raw);
      }

      vexo.marketplace("basic_provider_registered", {
        categorias: categoriasSeleccionadas.length,
        provincia: provincia.trim(),
        documentos_cargados:
          matriculaUrls.length > 0 || antecedentesUrls.length > 0,
      });

      const redirectTo: "pagoInicial" | "Home" = enBolivia
        ? "pagoInicial"
        : "Home";
      Alert.alert("Perfil publicado", "Ya podés recibir consultas. Completá tus datos opcionales cuando quieras para sumar confianza.", [
        { text: "OK", onPress: () => navigation.navigate(redirectTo) },
      ]);
    } catch (err) {
      Alert.alert("Error", "Ocurrió un error al registrar tus datos.");
    } finally {
      setLoading(false);
    }
  };

  const elegirContratar = async () => {
    try {
      setProcesandoModal(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { Alert.alert("Error", "No se pudo obtener el usuario."); return; }
      const { error } = await supabase.from("usuarios").update({
        rol: "user", perfil_completo: true, dni_verificado: true,
      }).eq("id", user.id);
      if (error) { Alert.alert("Error", "No se pudo actualizar el perfil."); return; }
      setMostrarModal(false);
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e) {
      Alert.alert("Error", "Ocurrió un problema.");
    } finally {
      setProcesandoModal(false);
    }
  };

  return (
    <ImageBackground source={require("../assets/fondoRegister.png")} style={styles.background} resizeMode="cover">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

            <Modal visible={mostrarModal} transparent animationType="fade">
              <View style={styles.modalContainer}>
                <View style={styles.modalBox}>
                  <Text style={styles.modalTitle}>¿Qué buscas?</Text>
                  <TouchableOpacity style={styles.modalButton} onPress={elegirContratar} disabled={procesandoModal}>
                    <Text style={styles.modalButtonText}>{procesandoModal ? "Procesando..." : "Contratar"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.modalSecondary]} onPress={() => setMostrarModal(false)}>
                    <Text style={styles.modalSecondaryText}>Ofrecer servicio</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <View style={styles.overlay}>
              <Text style={styles.title}>Publicá tu perfil</Text>
              <View style={styles.basicInfoCard}>
                <Text style={styles.basicInfoTitle}>Primero, lo esencial</Text>
                <Text style={styles.basicInfoText}>
                  Con estos datos ya podrás aparecer en tu zona. La documentación es opcional.
                </Text>
              </View>

              <TextInput placeholder="Nombre completo" placeholderTextColor="#4e827d" value={nombre} onChangeText={setNombre} style={styles.input} />
              <TextInput placeholder="Número de celular (con código de país)" placeholderTextColor="#4e827d" value={numeroCelular} onChangeText={setNumeroCelular} keyboardType="phone-pad" style={styles.input} />

              {/* Ubicación */}
              <TextInput placeholder="Provincia" placeholderTextColor="#4e827d" value={provincia} onChangeText={setProvincia} style={styles.input} />
              <TextInput placeholder="Ciudad" placeholderTextColor="#4e827d" value={ciudad} onChangeText={setCiudad} style={styles.input} />

              {/* Categorías con buscador */}
              <Text style={styles.label}>Especialidad (hasta 3)</Text>
              <View style={{ width: "100%", zIndex: 10 }}>
                <TextInput
                  placeholder="Buscar categoría..."
                  placeholderTextColor="#4e827d"
                  value={busquedaCategoria}
                  onChangeText={(t) => { setBusquedaCategoria(t); setMostrarDropdown(true); }}
                  onFocus={() => setMostrarDropdown(true)}
                  style={styles.input}
                />
                {mostrarDropdown && categoriasFiltradas.length > 0 && (
                  <View style={styles.dropdown}>
                    {categoriasFiltradas.slice(0, 8).map((cat) => (
                      <TouchableOpacity key={cat} onPress={() => agregarCategoria(cat)} style={styles.dropdownItem}>
                        <Text style={styles.dropdownText}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.tagsContainer}>
                {categoriasSeleccionadas.map((cat) => (
                  <View key={cat} style={styles.tag}>
                    <Text style={styles.tagText}>{cat}</Text>
                    <TouchableOpacity onPress={() => quitarCategoria(cat)}>
                      <Text style={styles.tagClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setMostrarOpcionales((current) => !current)}
                style={styles.optionalToggle}
              >
                <Text style={styles.optionalToggleText}>
                  {mostrarOpcionales
                    ? "Ocultar datos opcionales"
                    : "Sumar foto, experiencia y documentos"}
                </Text>
                <Text style={styles.optionalToggleIcon}>
                  {mostrarOpcionales ? "−" : "+"}
                </Text>
              </TouchableOpacity>

              {mostrarOpcionales && (
                <View style={styles.optionalSection}>
              <Text style={styles.optionalIntro}>
                Estos datos ayudan a generar confianza, pero no son obligatorios para estar disponible.
              </Text>

              <Text style={styles.label}>Foto de perfil</Text>
              <TouchableOpacity onPress={seleccionarFotoPerfil} style={styles.fotoButton}>
                <Text style={styles.fotoButtonText}>Seleccionar foto</Text>
              </TouchableOpacity>
              {fotoPerfil && (
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <Image source={{ uri: fotoPerfil }} style={styles.avatarPreview} />
                </View>
              )}

              <TextInput placeholder="Edad (opcional)" placeholderTextColor="#4e827d" value={edad} onChangeText={setEdad} keyboardType="numeric" style={styles.input} />
              <TextInput placeholder="DNI (opcional)" placeholderTextColor="#4e827d" value={dni} onChangeText={setDni} keyboardType="numeric" style={styles.input} />
              <TextInput placeholder="Barrio (opcional)" placeholderTextColor="#4e827d" value={barrio} onChangeText={setBarrio} style={styles.input} />
              <TextInput placeholder="Años de experiencia (opcional)" placeholderTextColor="#4e827d" value={antiguedad} onChangeText={setAntiguedad} keyboardType="numeric" style={styles.input} />

              {/* Matrícula */}
              <Text style={styles.label}>Matrícula (opcional, hasta 3 archivos)</Text>
              <View style={styles.archivosBotones}>
                <TouchableOpacity style={styles.archivoBtn} onPress={() => seleccionarArchivos(matriculaArchivos, setMatriculaArchivos, "imagen")}>
                  <Text style={styles.archivoBtnText}>📷 Imagen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.archivoBtn} onPress={() => seleccionarArchivos(matriculaArchivos, setMatriculaArchivos, "pdf")}>
                  <Text style={styles.archivoBtnText}>📄 PDF</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.archivosPreview}>
                {matriculaArchivos.map((a, i) => (
                  <View key={`${a.uri}-${a.nombre}`} style={styles.archivoChip}>
                    <Text style={styles.archivoChipText} numberOfLines={1}>{a.nombre}</Text>
                    <TouchableOpacity onPress={() => setMatriculaArchivos(matriculaArchivos.filter((_, idx) => idx !== i))}>
                      <Text style={styles.tagClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
                </View>
              )}

              {/* Antecedentes */}
              <Text style={styles.label}>Antecedentes penales (opcional, hasta 3 archivos)</Text>
              <View style={styles.archivosBotones}>
                <TouchableOpacity style={styles.archivoBtn} onPress={() => seleccionarArchivos(antecedentesArchivos, setAntecedentesArchivos, "imagen")}>
                  <Text style={styles.archivoBtnText}>📷 Imagen</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.archivoBtn} onPress={() => seleccionarArchivos(antecedentesArchivos, setAntecedentesArchivos, "pdf")}>
                  <Text style={styles.archivoBtnText}>📄 PDF</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.archivosPreview}>
                {antecedentesArchivos.map((a, i) => (
                  <View key={`${a.uri}-${a.nombre}`} style={styles.archivoChip}>
                    <Text style={styles.archivoChipText} numberOfLines={1}>{a.nombre}</Text>
                    <TouchableOpacity onPress={() => setAntecedentesArchivos(antecedentesArchivos.filter((_, idx) => idx !== i))}>
                      <Text style={styles.tagClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Términos */}
              <View style={styles.switchContainer}>
                <Switch value={aceptaTerminos} onValueChange={setAceptaTerminos} trackColor={{ false: "#767577", true: "#E8C547" }} thumbColor={aceptaTerminos ? "#A4D4AE" : "#f4f3f4"} />
                <TouchableOpacity onPress={() => Linking.openURL("https://inicio.tooriserviciosya.info/Terminos-y-condiciones.html")}>
                  <Text style={[styles.switchLabel, { textDecorationLine: "underline" }]}>Acepto los términos y condiciones</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? "Publicando..." : "Publicar perfil básico"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    marginTop: 40,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: { fontSize: 24, color: "#4A7C84", fontWeight: "bold", marginBottom: 24, textAlign: "center" },
  basicInfoCard: { width: "100%", marginBottom: 12, padding: 14, borderRadius: 14, backgroundColor: "#e8f7f5", borderWidth: 1, borderColor: "#b6e4df" },
  basicInfoTitle: { color: "#047a8f", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  basicInfoText: { color: "#456b70", fontSize: 13, lineHeight: 18 },
  label: { fontSize: 15, fontWeight: "600", color: "#4A7C84", marginBottom: 6, alignSelf: "flex-start" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
    fontSize: 16,
    borderColor: "#4b4e6d",
    borderWidth: 1,
    width: "100%",
  },
  button: {
    backgroundColor: "#4b4e6d",
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 24,
    width: "100%",
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  switchContainer: { flexDirection: "row", alignItems: "center", marginVertical: 12, width: "100%" },
  switchLabel: { marginLeft: 12, flex: 1, fontSize: 14, color: "#4A7C84" },
  fotoButton: { backgroundColor: "#4b4e6d", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginBottom: 10 },
  fotoButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  avatarPreview: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: "#4b4e6d" },
  dropdown: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#4b4e6d",
    borderRadius: 10,
    width: "100%",
    maxHeight: 200,
    zIndex: 99,
  },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  dropdownText: { fontSize: 15, color: "#333" },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10, width: "100%" },
  tag: { flexDirection: "row", alignItems: "center", backgroundColor: "#4b4e6d", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  tagText: { color: "#fff", fontSize: 13 },
  tagClose: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  archivosBotones: { flexDirection: "row", gap: 10, marginBottom: 8, width: "100%" },
  archivoBtn: { flex: 1, backgroundColor: "#4b4e6d", padding: 10, borderRadius: 10, alignItems: "center" },
  archivoBtnText: { color: "#fff", fontSize: 14 },
  archivosPreview: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, width: "100%" },
  archivoChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#e8f4f8", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, gap: 6, maxWidth: "48%" },
  archivoChipText: { color: "#4b4e6d", fontSize: 12, flex: 1 },
  optionalToggle: { width: "100%", minHeight: 52, marginTop: 8, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "#8dcbd1", backgroundColor: "#f4fbfb" },
  optionalToggleText: { flex: 1, color: "#047a8f", fontSize: 14, fontWeight: "800" },
  optionalToggleIcon: { color: "#047a8f", fontSize: 24, fontWeight: "500", marginLeft: 10 },
  optionalSection: { width: "100%", padding: 14, borderRadius: 16, backgroundColor: "rgba(244,251,251,0.88)", borderWidth: 1, borderColor: "#d3e7e9" },
  optionalIntro: { color: "#5f7478", fontSize: 12, lineHeight: 17, marginBottom: 14 },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "85%", backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center" },
  modalTitle: { fontSize: 22, fontWeight: "700", color: "#4A7C84", marginBottom: 24 },
  modalButton: { width: "100%", backgroundColor: "#4b4e6d", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  modalButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  modalSecondary: { backgroundColor: "#F1F1F1" },
  modalSecondaryText: { color: "#4A7C84", fontSize: 16, fontWeight: "600" },
});
