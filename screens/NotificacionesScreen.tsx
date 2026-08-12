import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState, useContext } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import BotonVolver from "../components/BotonVolver";
import { AuthContext } from "../lib/context/AppContext";
import { supabase } from "../lib/supabase";
import { userNotificationsQueryOptions } from "../lib/utils/notificationes";
import { respondToUrgentWorkAlert } from "../lib/utils/urgentWorkNotification";
import vexo from "../lib/vexo";
import { getUserID } from "../store/authStore";
import type { NotificacionRow, ServicioRow } from "../types/db.overrides.types";
import type { MainStackParamList } from "../types/navigation";

type NotificationItem = NotificacionRow & { foto_perfil?: string | null };
type Navigation = NativeStackNavigationProp<MainStackParamList>;

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState<NotificationItem[]>([]);
  const { data, isFetched } = useQuery({
    ...userNotificationsQueryOptions,
    staleTime: 200,
    refetchOnMount: true,
  });
  const navigation = useNavigation<Navigation>();

  const { loadUnreadMessages } = useContext(AuthContext);

  useEffect(() => {
    if (data && isFetched) {
      setNotificaciones(data as NotificationItem[]);
    }
  }, [data, isFetched]);

  const marcarComoLeida = async (id: string) => {
    const { error } = await supabase
      .from("notificaciones")
      .update({ leido: true })
      .eq("id", id);

    if (!error) {
      setNotificaciones((prev) =>
        prev.map((item) => (item.id === id ? { ...item, leido: true } : item)),
      );
    }
  };

  const eliminarNotificacion = async (id: string) => {
    const { error } = await supabase
      .from("notificaciones")
      .delete()
      .eq("id", id);
    if (!error) {
      setNotificaciones((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const eliminarTodasNotificaciones = async () => {
    const userId = getUserID();
    const { error } = await supabase
      .from("notificaciones")
      .delete()
      .eq("receptor_id", userId);

    if (!error) {
      setNotificaciones([]);
    }
  };

  const aceptarNotificacion = async (notificacion: NotificacionRow) => {
    const userId = getUserID();

    if (!userId || !notificacion?.emisor_id || !notificacion?.id) {
      Alert.alert("Error", "Faltan datos de la notificación.");
      return;
    }
    vexo.accept(notificacion.servicio_id ?? "");

    const urgentAlertId = notificacion.urgent_work_alert_id;
    const isUrgent = Boolean(urgentAlertId);
    if (urgentAlertId) {
      try {
        const result = await respondToUrgentWorkAlert(
          urgentAlertId,
          "accepted",
        );
        if (!result.ok) {
          await marcarComoLeida(notificacion.id);
          Alert.alert(
            "La solicitud ya no está disponible",
            result.reason === "expired"
              ? "Venció el plazo de 20 minutos y el pedido comenzó a reasignarse."
              : "Esta urgencia ya había sido respondida.",
          );
          return;
        }
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo responder la urgencia.",
        );
        return;
      }
    }

    // Continuar con el resto del flujo normalmente
    if (!isUrgent) {
      const { error: errorEstado } = await supabase
        .from("notificaciones")
        .update({ estado: "aceptado" })
        .eq("id", notificacion.id);

      if (!errorEstado) {
        console.log('Estado actualizado correctamente a "aceptado"');
      }

      // Llamar a la API PHP para registrar evento contratacion_aceptada
      try {
        const eventoPayload = {
          tipo_evento: "contratacion_aceptada",
          datos: {
            contratante_id: notificacion.emisor_id, // este es el ID de la contratación
            contratado_id: userId, // este es quien acepta
          },
        };

        const response = await fetch(
          "https://insightpulse.store/api/registrar_evento.php",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(eventoPayload),
          },
        );

        const result = await response.json();

        if (!response.ok || result.error) {
          Alert.alert(
            "Error",
            "No se pudo registrar la aceptación en el servidor.",
          );
          console.error("API error:", result);
          return;
        }

        console.log("Evento registrado correctamente:", result);
      } catch (error) {
        console.error("Error al llamar la API:", error);
        Alert.alert("Error", "Error al comunicarse con el servidor.");
        return;
      }
    }

    Alert.alert("✅ Servicio confirmado", "Has aceptado la solicitud.");
    await marcarComoLeida(notificacion.id);

    // chats.participant_a < participant_b (CHECK constraint)
    const [participantA, participantB] = [userId, notificacion.emisor_id]
      .slice()
      .sort();

    // Verificar si ya existe un chat entre los dos usuarios
    const { data: chatExistente, error: errorCheck } = await supabase
      .from("chats")
      .select("id")
      .eq("participant_a", participantA)
      .eq("participant_b", participantB)
      .maybeSingle();

    if (errorCheck) {
      Alert.alert("Error", "No se pudo verificar chats existentes.");
      return;
    }

    const mensajeImportante = `📢 **IMPORTANTE** 📢

Este chat ha sido creado exclusivamente para que puedas coordinar y acordar los detalles del servicio con el trabajador.

⚠️ **Soluciones Ya no se hace responsable** por la calidad del servicio ofrecido ni por cualquier eventualidad durante su ejecución.

⭐ **Al finalizar el servicio, desde este chat podrás dejar tu calificación y opinión sobre el trabajador para ayudar a otros usuarios.**

────────────────────────────`;

    const mensajeTicket = `🎫 Se ha concretado una propuesta de trabajo. Este chat funcionará como comprobante. Puedes coordinar los detalles del servicio aquí.`;

    let chatId: string;
    if (chatExistente) {
      chatId = chatExistente.id;
      await supabase.from("mensajes").insert({
        chat_id: chatId,
        remitente_id: userId,
        contenido: mensajeImportante,
      });
    } else {
      const { data: nuevoChat, error: errorNuevoChat } = await supabase
        .from("chats")
        .insert({ participant_a: participantA, participant_b: participantB })
        .select("id")
        .single();

      if (errorNuevoChat || !nuevoChat) {
        Alert.alert(
          "Error al crear el chat",
          errorNuevoChat?.message || "Error desconocido",
        );
        return;
      }

      chatId = nuevoChat.id;
      await supabase.from("mensajes").insert([
        { chat_id: chatId, remitente_id: userId, contenido: mensajeImportante },
        { chat_id: chatId, remitente_id: userId, contenido: mensajeTicket },
      ]);
    }

    const otroUsuarioId = notificacion.emisor_id;
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("nombre, foto_perfil")
      .eq("id", otroUsuarioId)
      .single();

    const servicioId = notificacion.servicio_id ?? "";
    const servicioIdNumber = Number(servicioId);
    const { data: servicio } = Number.isFinite(servicioIdNumber)
      ? await supabase
          .from("servicios")
          .select("id, titulo, descripcion, categoria, horario")
          .eq("id", servicioIdNumber)
          .maybeSingle()
      : { data: null };

    loadUnreadMessages();
    navigation.navigate("ChatIndividual", {
      chatId,
      nombre: servicio
        ? `${usuario?.nombre || "Desconocido"} - ${servicio.titulo}`
        : usuario?.nombre || "Desconocido",
      servicio: (servicio ?? {}) as Partial<ServicioRow>,
      usuarioId1: participantA,
      usuarioId2: participantB,
      servicioId,
    });
  };

  const rechazarNotificacion = async (notificacion: NotificacionRow) => {
    if (notificacion.urgent_work_alert_id) {
      try {
        const result = await respondToUrgentWorkAlert(
          notificacion.urgent_work_alert_id,
          "declined",
        );
        await marcarComoLeida(notificacion.id);
        Alert.alert(
          result.ok ? "Solicitud rechazada" : "Solicitud cerrada",
          result.ok
            ? "Gracias por responder. Buscaremos otro prestador."
            : "La urgencia ya no estaba disponible.",
        );
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "No se pudo rechazar la urgencia.",
        );
      }
      return;
    }
    const { error } = await supabase
      .from("notificaciones")
      .update({ estado: "rechazado" })
      .eq("id", notificacion.id);

    if (!error) {
      await eliminarNotificacion(notificacion.id);
      Alert.alert("❌ Solicitud rechazada", "Has rechazado la solicitud.");
    } else {
      Alert.alert("Error", "No se pudo rechazar la solicitud.");
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isUrgent = Boolean(item.urgent_work_alert_id);
    const isLegacyRequest = Boolean(
      item.emisor_id && item.servicio_id && !item.estado,
    );
    const canRespond = !item.leido && (isUrgent || isLegacyRequest);
    return (
      <View style={[styles.item, !item.leido && styles.noLeido]}>
        {item.foto_perfil && (
          <Image source={{ uri: item.foto_perfil }} style={styles.fotoPerfil} />
        )}
        <Text style={styles.mensaje}>{item.mensaje}</Text>
        <Text style={styles.fecha}>
          {new Date(item.created_at).toLocaleString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
        {isUrgent && item.urgent_response_deadline ? (
          <Text style={styles.urgentDeadline}>
            Responder antes de{" "}
            {new Date(item.urgent_response_deadline).toLocaleTimeString(
              "es-AR",
              { hour: "2-digit", minute: "2-digit" },
            )}
          </Text>
        ) : null}
        <View style={styles.botones}>
          {canRespond ? (
            <>
              <TouchableOpacity
                style={[styles.boton, styles.botonAceptar]}
                onPress={() => aceptarNotificacion(item)}
              >
                <Text style={styles.botonTexto}>Aceptar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.boton, styles.botonRechazar]}
                onPress={() => rechazarNotificacion(item)}
              >
                <Text style={styles.botonTexto}>Rechazar</Text>
              </TouchableOpacity>
            </>
          ) : !item.leido ? (
            <TouchableOpacity
              style={[styles.boton, styles.botonAceptar]}
              onPress={() => marcarComoLeida(item.id)}
            >
              <Text style={styles.botonTexto}>Marcar como leída</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.boton, styles.botonEliminar]}
              onPress={() => eliminarNotificacion(item.id)}
            >
              <Text style={styles.botonTexto}>Eliminar</Text>
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
            Estado: {item.estado || "pendiente"}
          </Text>
        </View>
      </View>
    );
  };

  if (!isFetched) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BotonVolver />
      <Text style={styles.titulo}>Notificaciones</Text>
      {notificaciones.length === 0 ? (
        <Text style={styles.sinNotificaciones}>
          No tienes notificaciones aún.
        </Text>
      ) : (
        <FlatList
          data={notificaciones}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
        />
      )}
      {notificaciones.length > 0 && (
        <TouchableOpacity
          style={styles.eliminarTodoBoton}
          onPress={eliminarTodasNotificaciones}
        >
          <Text style={styles.botonTexto}>Eliminar todas</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#E8FAF7", // turquesa claro
  },
  titulo: {
    fontSize: 25,
    fontWeight: "900",
    marginVertical: 14,
    textAlign: "center",
    color: "#19D4C6",
    letterSpacing: 1,
  },
  item: {
    backgroundColor: "#fff",
    padding: 18,
    marginBottom: 15,
    borderRadius: 22,
    elevation: 5,
    shadowColor: "#19D4C6",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    position: "relative",
    minHeight: 120,
    justifyContent: "center",
  },
  noLeido: {
    borderLeftWidth: 5,
    borderLeftColor: "#FFA13C", // naranja
    backgroundColor: "#FEF8F5",
  },
  mensaje: {
    fontSize: 16,
    marginBottom: 7,
    fontWeight: "600",
    color: "#222",
    paddingRight: 55, // para la foto de perfil
  },
  fecha: {
    fontSize: 12,
    color: "#999",
    marginBottom: 5,
    paddingRight: 55,
  },
  urgentDeadline: {
    color: "#a43b32",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  botones: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    alignItems: "center",
    gap: 7,
  },
  boton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 18,
    marginRight: 8,
    marginTop: 3,
    fontWeight: "700",
    elevation: 2,
  },
  botonTexto: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  botonAceptar: {
    backgroundColor: "#19D4C6",
  },
  botonRechazar: {
    backgroundColor: "#FFA13C",
  },
  botonEliminar: {
    backgroundColor: "#e04d4d",
  },
  eliminarTodoBoton: {
    backgroundColor: "#e04d4d",
    padding: 13,
    borderRadius: 20,
    marginTop: 22,
    alignItems: "center",
    elevation: 3,
  },
  sinNotificaciones: {
    textAlign: "center",
    fontSize: 17,
    color: "#888",
    marginTop: 55,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  fotoPerfil: {
    width: 48,
    height: 48,
    borderRadius: 24,
    position: "absolute",
    top: 17,
    right: 18,
    borderWidth: 2,
    borderColor: "#19D4C6",
    backgroundColor: "#E8FAF7",
  },
});
