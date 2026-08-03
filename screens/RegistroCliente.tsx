import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Switch,
  Platform,
  Image,
  Alert,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../types/navigation";
import BotonVolver from '../components/BotonVolver';
import * as FileSystem from "expo-file-system";
import { supabase } from "../lib/supabase";
import uuid from "react-native-uuid";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import SelectDropdown from 'react-native-select-dropdown' 


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
  const pedirFoto = async (setFoto: React.Dispatch<React.SetStateAction<string | null>>) => {
    let permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso denegado", "Para tomar la foto necesitamos permiso de cámara.");
      return;
    }
    let resultado = await ImagePicker.launchCameraAsync({
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
    }
    if (step === 2) {
      if (!numeroDni.trim() || !direccionDni.trim() || !fechaNacimiento.trim()) {
        Alert.alert("Faltan datos", "Debes completar todos los campos del paso 2.");
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
  const LinkTexto = ({ url, texto }: { url: string; texto: string }) => (
    <Text
      style={styles.link}
      onPress={() => {
        Linking.openURL(url).catch(() => {
          Alert.alert("Error", "No se pudo abrir el enlace");
        });
      }}
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
        } as any);
      if (error) throw error;
      const urlPublica = supabase.storage.from("fotos-perfil").getPublicUrl(nombreArchivo).data.publicUrl;
      return urlPublica;
    };
    // Subir imágenes con la lógica ideal
        const nombreFotoPerfil = `${uuid.v4()}_perfil.jpg`;
        const urlFotoPerfil = fotoPerfil ? await subirImagen(fotoPerfil, nombreFotoPerfil) : null;


        // Insertar en Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuario no autenticado");

    const { error: insertError } = await supabase.from("usuarios").update({
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
      dni_verificado: true
    } as any)
    .eq("id", user.id);

    if (insertError) throw insertError;

    navigation.navigate("Home");
  } catch (error: any) {
    console.error("Error al registrar usuario:", error.message);
    Alert.alert("Error", "Ocurrió un error al guardar tus datos. Intentá de nuevo.");
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

        <KeyboardAwareScrollView style={{width:'100%'}}>
          <View style={{justifyContent: "center", alignItems: "center"}}>
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
                    {title: 'Masculino', value: 'masculino'},
                    {title: 'Femenino', value: 'femenino'},
                  ]}
                  onSelect={(selectedItem, index) => {
                    setSexo(selectedItem.value)
                  }}
                  renderButton={(selectedItem, isOpened) => {
                    return (
                      <View style={styles.dropdownButtonStyle}>
                        <Text style={[
                          styles.dropdownButtonTxtStyle,
                          !selectedItem && {color: '#999'}
                        ]}>
                          {(selectedItem && selectedItem.title) || 'Sexo'}
                        </Text>
                      </View>
                    );
                  }}
                  renderItem={(item, index, isSelected) => {
                    return (
                      <View style={{...styles.dropdownItemStyle, ...(isSelected && {backgroundColor: '#D2D9DF'})}}>
                        <Text style={styles.dropdownItemTxtStyle}>{item.title}</Text>
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
                <LinkTexto
                  url="https://inicio.tooriserviciosya.info/politicas-de-privacidad.html"
                  texto="Políticas de Privacidad"
                />
                <LinkTexto
                  url="https://inicio.tooriserviciosya.info/Terminos-y-condiciones.html"
                  texto="Términos y Condiciones"
                />

                <View style={styles.switchRow}>
                  <Switch value={acepto} onValueChange={setAcepto} />
                  <Text style={styles.switchText}>Acepto los términos y condiciones</Text>
                </View>

                <Text style={styles.leyenda}>
                  Servicios Ya es una plataforma de conexión entre trabajadores y clientes, y no asume responsabilidad alguna por las tareas o el desempeño de los trabajadores.
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
            <TouchableOpacity style={styles.botonNav} onPress={step < 3 ? siguiente : finalizarRegistro}>
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
    flex: .5,
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
    fontWeight:'900',
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
    fontWeight:'700',
  },
  botonesNav: {
    flexDirection: "row",
    justifyContent:'space-evenly',
    marginTop: 20,
    marginBottom:50
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
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
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
      backgroundColor: '#E9ECEF',
      borderRadius: 8,
    },
    dropdownItemStyle: {
      width: '100%',
      flexDirection: 'row',
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 8,
    },
    dropdownItemTxtStyle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '500',
      color: '#151E26',
    },
    dropdownItemIconStyle: {
      fontSize: 28,
      marginRight: 8,
    },
});
