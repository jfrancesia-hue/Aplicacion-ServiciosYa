import React, { useState, useEffect } from "react";
import {
  Alert,
  Dimensions, // Keep platform for potential future use
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Picker } from "@react-native-picker/picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
// 1. Import the new component
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import SelectDropdown from "react-native-select-dropdown";
import BotonVolver from "../components/BotonVolver";
import GenericAutocomplete from "../components/GenericAutocomplete";
import { withDropDownProvider } from "../components/forms/withDropDownProvider";
import LocationInput from "../components/location/LocationInput";
import { withModalProvider } from "../components/sheet/withModalProvider";
import { supabase } from "../lib/supabase";
import showToast from "../lib/toast";
import { isTooriBridgeConfigured, syncPrestador } from "../lib/tooriBridge";
import { categoriasDisponibles } from "../lib/utils/categorias";
import { locationQueryString } from "../lib/utils/location";
import vexo from "../lib/vexo";
import { getUserID } from "../store/authStore";
import type { LocationItem } from "../types/location";
import type { MainStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<MainStackParamList, "OfrecerServicio">;

function normalizeOficios(values: Array<string | string[] | null | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function OfrecerServicio({ navigation }: Props) {
  // ... (all your state and functions remain exactly the same)
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [horario, setHorario] = useState("");
  const [precio, setPrecio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState<LocationItem>();

  const handleSubmit = async () => {
    if (
      !titulo ||
      !categoria ||
      !horario ||
      !precio ||
      !descripcion ||
      !ubicacion
    ) {
      Alert.alert("Error", "Por favor completa todos los campos.");
      return;
    }

    const userId = getUserID();

    try {
      // 🔹 Si el usuario ya pagó, crear el servicio
      const servicio = {
        user_id: userId,
        titulo,
        categoria,
        horario,
        precio: Number(precio),
        descripcion,
        location: locationQueryString(ubicacion.lat, ubicacion.lng),
        country: ubicacion.isoCountryCode,
      };

      const { data, error } = await supabase.from("servicios").insert(servicio);
      vexo.servicio(servicio.titulo);

      if (error) {
        console.error("Error de Supabase:", error);
        throw new Error(error.message || "Error desconocido de Supabase");
      }
      try {
        if (isTooriBridgeConfigured()) {
          const { data: perfil } = await supabase
            .from("usuarios")
            .select(
              "id,nombre,email,celular,categoria,ciudad,provincia,dni_verificado",
            )
            .eq("id", userId)
            .single();

          const telefono = perfil?.celular ? String(perfil.celular) : "";
          if (perfil?.id && perfil?.nombre && telefono) {
            await syncPrestador({
              appUserId: perfil.id,
              nombre: perfil.nombre,
              email: perfil.email ?? undefined,
              telefono,
              oficios: normalizeOficios([categoria, perfil.categoria]),
              ciudad: perfil.ciudad ?? ubicacion.name ?? undefined,
              provincia: perfil.provincia ?? undefined,
              verificado: Boolean(perfil.dni_verificado),
            });
          }
        }
      } catch (bridgeError) {
        console.warn(
          "No se pudo sincronizar prestador con Web/Mica",
          bridgeError,
        );
      }

      showToast.success(
        "Éxito",
        "Servicio creado y vinculado al flujo Servicios Ya/Mica.",
      );
      navigation.goBack();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      console.error("Error al insertar el servicio:", message);
      Alert.alert("Error", `No se pudo crear el servicio: ${message}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#E8FAF7" }}>
      <BotonVolver />
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContentContainer}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        extraScrollHeight={Platform.OS === "ios" ? 24 : 96}
        extraHeight={Platform.OS === "ios" ? 80 : 140}
        enableOnAndroid={true}
      >
        <Text style={[styles.title, { marginTop: 20 }]}>
          Publicar un Servicio
        </Text>

        <View style={styles.inputContainer}>
          {/* All your inputs remain the same */}
          <Text style={styles.label}>Título del servicio</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Electricista a domicilio"
            placeholderTextColor="#888"
            value={titulo}
            onChangeText={setTitulo}
          />

          <GenericAutocomplete<string>
            label="Categoría"
            data={categoriasDisponibles}
            onSelectItem={(value) => setCategoria(value ?? "")}
            placeholder="Ej: Categoria"
            itemToDropdownItem={(value) => ({
              id: value,
              title: value,
              payload: value,
            })}
            dropdownProps={{
              InputComponent: TextInput,
              flatListProps: undefined,
              suggestionsListContainerStyle: undefined,
              suggestionsListMaxHeight: Dimensions.get("window").height * 0.4,
            }}
          />

          <Text style={styles.label}>Horario</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Lunes a Viernes de 9 a 18hs"
            placeholderTextColor="#888"
            value={horario}
            onChangeText={setHorario}
          />

          <Text style={styles.label}>Precio</Text>
          <TextInput
            style={styles.input}
            placeholder="Precio aprox, Ej: $5000 por hora"
            placeholderTextColor="#888"
            value={precio}
            onChangeText={setPrecio}
            keyboardType="numeric"
          />

          <LocationInput onChange={(value) => setUbicacion(value)} />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, { height: 100 }]}
            placeholder="Breve descripción (máx 300 caracteres)"
            placeholderTextColor="#888"
            value={descripcion}
            onChangeText={(text) => {
              if (text.length <= 300) setDescripcion(text);
            }}
            multiline
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Publicar Servicio</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

export default withDropDownProvider(withModalProvider(OfrecerServicio));

const styles = StyleSheet.create({
  // 3. Adjust the styles. The main container now handles the background.
  container: {
    flex: 1,
    backgroundColor: "#E8FAF7",
  },
  // The content container handles padding and growth.
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 120,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 24,
    color: "#19D4C6",
    letterSpacing: 0.5,
  },
  // ... rest of the styles are unchanged
  inputContainer: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 22,
    elevation: 8,
    shadowColor: "#19D4C6",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    marginBottom: 32,
  },
  label: {
    fontSize: 15,
    color: "#19D4C6",
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C8ECE8",
    fontSize: 17,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    color: "#333",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#C8ECE8",
    borderRadius: 12,
    marginBottom: 15,
    overflow: "hidden",
    backgroundColor: "#FAFAFA",
  },
  picker: {
    height: 50,
    width: "100%",
    color: "#222",
    fontSize: 17,
    backgroundColor: "#FAFAFA",
  },
  submitButton: {
    marginTop: 22,
    backgroundColor: "#FFA13C", // Naranja
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#FFA13C",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  dropdownButtonStyle: {
    height: 50,
    width: "100%",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
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
