import React, { useContext, useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  Modal,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import { AuthContext } from "../lib/context/AppContext";
import type { MainStackParamList } from "../types/navigation";

type RouteParams = NonNullable<MainStackParamList["PasarelaPagoWorker"]>;
type Navigation = NativeStackNavigationProp<MainStackParamList>;

export default function PasarelaPagoWorker() {
  const { params } = useRoute() as { params?: RouteParams };
  const navigation = useNavigation<Navigation>();
  const notificacion = params?.notificacion;
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [trabajadorId, setTrabajadorId] = useState<string | null>(null);

  const { loadUnreadMessages, loadNotifications } = useContext(AuthContext);

  useEffect(() => {
    const prepararAceptacion = async () => {
      const { data, error } = await supabase.auth.getUser();
      const currentWorkerId = error ? null : data?.user?.id;

      if (!currentWorkerId || !notificacion?.id || !notificacion?.emisor_id) {
        navigation.goBack();
        return;
      }

      setTrabajadorId(currentWorkerId);
      setLoading(false);
      setMostrarModal(true);
    };

    prepararAceptacion();
  }, [navigation, notificacion?.emisor_id, notificacion?.id]);

  const manejarPagoExitoso = async () => {
    if (!trabajadorId || !notificacion?.id || !notificacion?.emisor_id) return;

    const { error: notificationError } = await supabase
      .from("notificaciones")
      .update({ estado: "aceptado", leido: true })
      .eq("id", notificacion.id);

    if (notificationError) {
      Alert.alert("Error", "No se pudo aceptar la notificacion.");
      return;
    }

    loadNotifications();

    const [participantA, participantB] = [
      trabajadorId,
      notificacion.emisor_id,
    ].slice().sort();

    const { data: chatExistente, error: chatSearchError } = await supabase
      .from("chats")
      .select("id")
      .eq("participant_a", participantA)
      .eq("participant_b", participantB)
      .maybeSingle();

    if (chatSearchError) {
      Alert.alert("Error", "No se pudo verificar el chat existente.");
      return;
    }

    let chatId: string;
    if (chatExistente?.id) {
      chatId = chatExistente.id;
    } else {
      const { data: nuevoChat, error: nuevoChatError } = await supabase
        .from("chats")
        .insert({ participant_a: participantA, participant_b: participantB })
        .select("id")
        .single();

      if (nuevoChatError || !nuevoChat?.id) {
        Alert.alert("Error", "No se pudo crear el chat.");
        return;
      }

      chatId = nuevoChat.id;

      await supabase.from("mensajes").insert([
        {
          chat_id: chatId,
          remitente_id: trabajadorId,
          contenido:
            "IMPORTANTE\n\nEste chat fue creado exclusivamente para coordinar los detalles del servicio.\n\nSolucionesYa no se hace responsable por la ejecucion del servicio. Al finalizar, deja tu calificacion.",
        },
        {
          chat_id: chatId,
          remitente_id: trabajadorId,
          contenido:
            "Se concreto una propuesta de trabajo. Este chat funciona como comprobante.",
        },
      ]);
    }

    loadUnreadMessages();

    navigation.replace("ChatIndividual", {
      chatId,
      nombre: "Cliente",
      servicio: {},
      servicioId: notificacion.servicio_id ?? "",
      usuarioId1: participantA,
      usuarioId2: participantB,
    });
  };

  const cancelarPago = () => {
    setMostrarModal(false);
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <Modal transparent visible={mostrarModal} animationType="fade">
      <View style={styles.modalFondo}>
        <View style={styles.modalContenido}>
          <Text style={styles.titulo}>Aceptar trabajo</Text>
          <Text style={styles.descripcion}>
            Por ahora los prestadores no pagan para aceptar trabajos. El cobro
            activo es el 10% al cliente cuando confirma presupuesto.
          </Text>
          <Pressable style={styles.boton} onPress={manejarPagoExitoso}>
            <Text style={styles.textoBoton}>Continuar sin cobro</Text>
          </Pressable>
          <Pressable style={styles.botonSecundario} onPress={cancelarPago}>
            <Text style={styles.textoBotonSecundario}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContenido: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    alignItems: "center",
    elevation: 8,
  },
  titulo: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  descripcion: {
    textAlign: "center",
    marginBottom: 24,
    color: "#333",
    lineHeight: 20,
  },
  boton: {
    backgroundColor: "#FFA13C",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    marginBottom: 14,
    elevation: 6,
    shadowColor: "#FFA13C",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    alignItems: "center",
    width: "100%",
  },
  botonSecundario: {
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
  },
  textoBoton: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  textoBotonSecundario: {
    color: "#666",
    fontSize: 15,
    fontWeight: "700",
  },
});
