import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import type React from "react";
import { useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import SelectDropdown from "react-native-select-dropdown";
import uuid from "react-native-uuid";
import BotonVolver from "../components/BotonVolver";
import { recordCurrentLegalAcceptance } from "../lib/legal/acceptance";
import type { LegalDocumentKind } from "../lib/legal/documents";
import { supabase } from "../lib/supabase";
import type { MainStackParamList } from "../types/navigation";

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function RegistroCliente() {
  const navigation = useNavigation<NavigationProp>();

  // Paso actual
  const [step, setStep] = useState(1);

  // Paso 1 datos personales
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [edad, setEdad] = useState("");
  const [sexo, setSexo] = useState("");
  const [numeroCelular, setNumeroCelular] = useState("");

  // Paso 2 fotos y dni
  const [direccionDni, setDireccionDni] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [numeroDni, setNumeroDni] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);

  // Paso 3 aceptación
  const [acepto, setAcepto] = useState(false);

  // Función para pedir foto con expo-image-picker
  const pedirFoto = async (
    setFoto: React.Dispatch<React.SetStateAction<string | null>>,
  ) => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        "Permiso denegado",
        "Para tomar la foto necesitamos permiso de cámara.",
      );
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!resultado.canceled) {
      setFoto(resultado.assets[0].uri);
    }
  };

  // Validar paso antes de avanzar
  const validarPaso = () => {
    if (step === 1) {
      if (!nombre || !apellido || !edad || !sexo) {
        Alert.alert("Completa todos los campos");
        return false;
      }
      const parsedAge = Number.parseInt(edad, 10);
      if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 100) {
        Alert.alert("Edad inválida", "Debes tener 18 años o más.");
        return false;
      }
    }
    if (step === 2) {
      if (
        !numeroDni.trim() ||
        !direccionDni.trim() ||
        !fechaNacimiento.trim()
      ) {
        Alert.alert(
          "Faltan datos",
          "Debes completar todos los campos del paso 2.",
        );
        return;
      }
      if (!/^\d{7,8}$/.test(numeroDni)) {
        Alert.alert("DNI inválido", "Debe ser un número de DNI válido.");
        return;
      }
      if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fechaNacimiento)) {
        Alert.alert("Fecha inválida", "Usá el formato DD/MM/AAAA.");
        return;
      }
    }
    if (step === 3) {
      if (!acepto) {
        Alert.alert("Debes aceptar los términos y condiciones");
        return false;
      }
    }
    return true;
  };

  // Avanzar paso
  const siguiente = () => {
    if (validarPaso()) {
      if (step < 3) setStep(step + 1);
      else navigation.navigate("Home"); // Finaliza el formulario sin cobro de registro
    }
  };

  // Retroceder paso
  const anterior = () => {
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };

  // Componente para links
  const LinkTexto = ({
    document,
    texto,
  }: { document: LegalDocumentKind; texto: string }) => (
    <Text
      style={styles.link}
      onPress={() => navigation.navigate("LegalDocument", { document })}
    >
      {texto}
    </Text>
  );

  const finalizarRegistro = async () => {
    if (!validarPaso()) return;

    try {
      // Subir imágenes del DNI al storage
      const subirImagen = async (uri: string, tipo: string) => {
        const nombreArchivo = `${tipo}_${uuid.v4()}.jpg`;
        const { data, error } = await supabase.storage
          .from("fotos-perfil")
          .upload(nombreArchivo, {
            uri,
            type: "image/jpeg",
            name: nombreArchivo,
          } as unknown as ArrayBuffer);
        if (error) throw error;
        const urlPublica = supabase.storage
          .from("fotos-perfil")
          .getPublicUrl(nombreArchivo).data.publicUrl;
        return urlPublica;
      };
      // Subir imágenes con la lógica ideal
      const nombreFotoPerfil = `${uuid.v4()}_perfil.jpg`;
      const urlFotoPerfil = fotoPerfil
        ? await subirImagen(fotoPerfil, nombreFotoPerfil)
        : null;

      // Insertar en Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error: insertError } = await supabase
        .from("usuarios")
        .update({
          nombre,
          apellido,
          edad: Number(edad),
          sexo,
          celular: numeroCelular,
          dni: numeroDni,
          domicilio: direccionDni,
          fecha_nacimiento: fechaNacimiento,
          rol: "user",
          foto_perfil: urlFotoPerfil,
          perfil_completo: true,
          creditos: 0,
          pago: true,
          dni_verificado: true,
        })
        .eq("id", user.id);

      if (insertError) throw insertError;

      await recordCurrentLegalAcceptance("client_registration");

      navigation.navigate("Home");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Error de registro desconocido";
      console.error("Error al registrar usuario:", message);
      Alert.alert(
        "Error",
        "Ocurrió un error al guardar tus datos. Intentá de nuevo.",
      );
    }
  };

  return (
    <ImageBackground
      source={require("../assets/fondoRegister.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <BotonVolver />
      <View style={styles.overlay}>
        <Text style={styles.title}>Registro - Cliente (Paso {step} de 3)</Text>

        <KeyboardAwareScrollView style={{ width: "100%" }}>
          <View style={{ justifyContent: "center", alignItems: "center" }}>
            {step === 1 && (
              <>
                <TextInput
                  placeholder="Nombre"
                  placeholderTextColor="#4e827d"
                  value={nombre}
                  onChangeText={setNombre}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Apellido"
                  placeholderTextColor="#4e827d"
                  value={apellido}
                  onChangeText={setApellido}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Edad"
                  placeholderTextColor="#4e827d"
                  value={edad}
                  onChangeText={setEdad}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <SelectDropdown
                  data={[
                    { title: "Masculino", value: "masculino" },
                    { title: "Femenino", value: "femenino" },
                  ]}
                  onSelect={(selectedItem, index) => {
                    setSexo(selectedItem.value);
                  }}
                  renderButton={(selectedItem, isOpened) => {
                    return (
                      <View style={styles.dropdownButtonStyle}>
                        <Text
                          style={[
                            styles.dropdownButtonTxtStyle,
                            !selectedItem && { color: "#999" },
                          ]}
                        >
                          {(selectedItem?.title) || "Sexo"}
                        </Text>
                      </View>
                    );
                  }}
                  renderItem={(item, index, isSelected) => {
                    return (
                      <View
                        style={{
                          ...styles.dropdownItemStyle,
                          ...(isSelected && { backgroundColor: "#D2D9DF" }),
                        }}
                      >
                        <Text style={styles.dropdownItemTxtStyle}>
                          {item.title}
                        </Text>
                      </View>
                    );
                  }}
                  showsVerticalScrollIndicator={false}
                  dropdownStyle={styles.dropdownMenuStyle}
                />
                <TextInput
                  placeholder="Número de celular"
                  placeholderTextColor="#4e827d"
                  value={numeroCelular}
                  onChangeText={setNumeroCelular}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </>
            )}

            {step === 2 && (
              <>
                <TextInput
                  placeholder="Número de DNI"
                  placeholderTextColor="#4e827d"
                  value={numeroDni}
                  onChangeText={setNumeroDni}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Dirección (como figura en el DNI)"
                  placeholderTextColor="#4e827d"
                  value={direccionDni}
                  onChangeText={setDireccionDni}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Fecha de nacimiento (DD/MM/AAAA)"
                  placeholderTextColor="#4e827d"
                  value={fechaNacimiento}
                  onChangeText={setFechaNacimiento}
                  style={styles.input}
                />
                <View style={styles.fotoWrapper}>
                  <Text style={styles.label}>Foto de perfil</Text>
                  {fotoPerfil ? (
                    <Image source={{ uri: fotoPerfil }} style={styles.foto} />
                  ) : (
                    <View style={[styles.foto, styles.fotoPlaceholder]}>
                      <Text style={{ color: "#999" }}>No hay foto</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.botonFoto}
                    onPress={() => pedirFoto(setFotoPerfil)}
                  >
                    <Text style={styles.botonFotoTexto}>Tomar foto</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.subtitulo}>Links legales:</Text>
                <LinkTexto document="privacy" texto="Políticas de Privacidad" />
                <LinkTexto document="terms" texto="Términos y Condiciones" />

                <View style={styles.switchRow}>
                  <Switch value={acepto} onValueChange={setAcepto} />
                  <Text style={styles.switchText}>
                    Acepto los términos y condiciones
                  </Text>
                </View>

                <Text style={styles.leyenda}>
                  Servicios Ya facilita la conexión, la coordinación y el canal
                  de reclamos. El alcance legal aplicable se detalla en los
                  términos y condiciones vigentes.
                </Text>
              </>
            )}
          </View>
          <View style={styles.botonesNav}>
            {step > 1 && (
              <TouchableOpacity style={styles.botonNav} onPress={anterior}>
                <Text style={styles.botonNavTexto}>Anterior</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.botonNav}
              onPress={step < 3 ? siguiente : finalizarRegistro}
            >
              <Text style={styles.botonNavTexto}>
                {step < 3 ? "Siguiente" : "Finalizar"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "130%",
  },
  overlay: {
    marginTop: 100,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 24,
    color: "#4A7C84",
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
    fontSize: 16,
    borderColor: "#A4D4AE",
    borderWidth: 1,
    width: 300,
  },
  fotosContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 320,
    marginBottom: 10,
  },
  fotoWrapper: {
    alignItems: "center",
    flex: 0.5,
    marginHorizontal: 5,
  },
  foto: {
    width: 140,
    height: 100,
    borderRadius: 12,
    marginBottom: 8,
  },
  fotoPlaceholder: {
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  botonFoto: {
    backgroundColor: "#4A7C84",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  botonFotoTexto: {
    color: "white",
    fontWeight: "600",
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#4A7C84",
  },
  link: {
    color: "#FaaB35",
    textDecorationLine: "underline",
    fontSize: 20,
    marginVertical: 4,
    fontWeight: "900",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  switchText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#4A7C84",
  },
  label: {
    fontSize: 15,
    color: "#4A7C84",
    fontWeight: "700",
    marginBottom: 8,
  },
  leyenda: {
    fontSize: 19,
    fontStyle: "italic",
    textAlign: "center",
    color: "#777",
    marginHorizontal: 20,
    fontWeight: "700",
  },
  botonesNav: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 20,
    marginBottom: 50,
  },
  botonNav: {
    backgroundColor: "#A4D4AE",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  botonNavTexto: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  dropdownButtonStyle: {
    width: 300,
    height: 50,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,

    backgroundColor: "#fff",
    padding: 14,
    marginVertical: 10,
    fontSize: 16,
    borderColor: "#E8C547",
    borderWidth: 1,
  },
  dropdownButtonTxtStyle: {
    flex: 1,
    fontSize: 16,
  },
  dropdownButtonArrowStyle: {
    fontSize: 28,
  },
  dropdownButtonIconStyle: {
    fontSize: 28,
    marginRight: 8,
  },
  dropdownMenuStyle: {
    backgroundColor: "#E9ECEF",
    borderRadius: 8,
  },
  dropdownItemStyle: {
    width: "100%",
    flexDirection: "row",
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },
  dropdownItemTxtStyle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "500",
    color: "#151E26",
  },
  dropdownItemIconStyle: {
    fontSize: 28,
    marginRight: 8,
  },
});
