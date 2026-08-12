import React, { useState, useEffect, useRef, useCallback  } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  Linking,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { supabase } from "../lib/supabase";
import ChatInputBar from "../components/chat/ChatInputBar";
import MicaAssistantModal from "../components/chat/MicaAssistantModal";
import MicaSystemBubble from "../components/chat/MicaSystemBubble";
import BotonVolver from "../components/BotonVolver";
import { withModalProvider } from "../components/sheet/withModalProvider";
import { parseQuoteMessage, formatQuoteAmount, getQuotePricing } from "../lib/utils/quoteMessage";
import { pricingModeLabel, quotePricingSummary } from "../lib/utils/quotePricing";
import { calculateServiceConfirmationFee } from "../lib/constants/billing";
import VoiceMessageBubble from "../components/chat/VoiceMessageBubble";
import {
  CHAT_AUDIO_BUCKET,
  createAudioMessageContent,
  parseAudioMessageContent,
} from "../lib/utils/audioMessage";
import {
  createMicaAssistantContent,
  parseMicaSystemMessage,
} from "../lib/utils/micaMessage";
import TrustSafetyModal from "../components/trust/TrustSafetyModal";
import { useNavigation } from "@react-navigation/native";
import vexo from "../lib/vexo";
import { getPaymentReturnParam } from "../lib/utils/paymentReturn";
import { inspectChatContent, inspectChatText } from "../lib/utils/chatPolicy";

const CHAT_PAGE_SIZE = 40;

function ChatIndividual({ route }) {
  const navigation = useNavigation();
  const { chatId, nombre, servicio, usuarioId1, usuarioId2, servicioId } = route.params;

  const [mensajes, setMensajes] = useState([]);
  const [usuarioId, setUsuarioId] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [estrellas, setEstrellas] = useState(0);
  const [comentarioCalificacion, setComentarioCalificacion] = useState("");
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const [pagando, setPagando] = React.useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [micaAssistantVisible, setMicaAssistantVisible] = useState(false);
  const [askingMica, setAskingMica] = useState(false);
  const [trustSafetyVisible, setTrustSafetyVisible] = useState(false);
  const [transcriptEditor, setTranscriptEditor] = useState(null);
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [servicioData, setServicioData] = useState(servicio || {});
  const [canSendQuote, setCanSendQuote] = useState(false);
  const [reportandoIncidente, setReportandoIncidente] = useState(false);
  const processingPaymentReturn = useRef(null);
  const flatListRef = useRef(null);
  const messageChannelRef = useRef(null);
  const partnerId = usuarioId
    ? usuarioId1 === usuarioId
      ? usuarioId2
      : usuarioId1
    : usuarioId1 || usuarioId2;
  const chatUnlocked =
    jobStatus?.status === "approved" &&
    ["confirmed", "completed", "disputed"].includes(jobStatus?.job_status);

  const cargarEstadoTrabajo = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_chat_job_status", {
        p_chat_id: chatId,
      });
      if (error) throw error;
      setJobStatus(
        data && typeof data === "object" && data.payment_record_id
          ? data
          : null,
      );
    } catch (error) {
      console.warn("[chat] estado del trabajo no disponible:", error);
    }
  }, [chatId]);

  const verificarRetornoPago = useCallback(async (url) => {
    if (!url?.includes("presupuesto-confirmado")) return;

    const paymentRecordId = getPaymentReturnParam(url, "payment_record_id");
    const paymentId =
      getPaymentReturnParam(url, "payment_id") ||
      getPaymentReturnParam(url, "collection_id");
    const returnStatus =
      getPaymentReturnParam(url, "status") ||
      getPaymentReturnParam(url, "collection_status");

    if (returnStatus === "failure" || returnStatus === "rejected") {
      vexo.marketplace("payment_failed", {
        etapa: "retorno",
        estado: returnStatus,
      });
      Alert.alert(
        "Pago no aprobado",
        "Mercado Pago no aprobó la operación. Podés intentarlo nuevamente.",
      );
      return;
    }

    if (!paymentRecordId || !paymentId) {
      if (returnStatus === "pending") {
        vexo.marketplace("payment_started", {
          etapa: "retorno_pendiente",
        });
        Alert.alert(
          "Pago pendiente",
          "Mercado Pago todavía está procesando la operación.",
        );
      }
      return;
    }

    const operationKey = `${paymentRecordId}:${paymentId}`;
    if (processingPaymentReturn.current === operationKey) return;
    processingPaymentReturn.current = operationKey;
    setPagando(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "verify-payment",
        {
          body: { paymentRecordId, paymentId },
        },
      );
      if (error) throw error;
      if (!data?.approved) {
        Alert.alert(
          data?.status === "pending" ? "Pago pendiente" : "Pago no aprobado",
          data?.message ||
            "La operación todavía no fue confirmada por Mercado Pago.",
        );
        return;
      }

      Alert.alert(
        "Pago verificado",
        "La confirmación fue validada por Mercado Pago. Continuá coordinando el servicio desde este chat.",
      );
      vexo.marketplace("payment_confirmed", {
        origen: "retorno_mercadopago",
      });
      await cargarEstadoTrabajo();
    } catch (error) {
      processingPaymentReturn.current = null;
      vexo.marketplace("payment_failed", {
        etapa: "verificacion",
      });
      Alert.alert(
        "No pudimos verificar el pago",
        error instanceof Error
          ? error.message
          : "Intentá nuevamente desde el presupuesto.",
      );
    } finally {
      setPagando(false);
    }
  }, [cargarEstadoTrabajo]);

  useEffect(() => {
    void cargarEstadoTrabajo();
  }, [cargarEstadoTrabajo]);

  useEffect(() => {
    const linkSub = Linking.addEventListener("url", ({ url }) => {
      void verificarRetornoPago(url);
    });
    Linking.getInitialURL().then((url) => {
      if (url) void verificarRetornoPago(url);
    });

    return () => linkSub.remove();
  }, [verificarRetornoPago]);

  // Si el servicio llegó vacío, buscarlo desde la BD usando el usuario partner
  useEffect(() => {
    if (servicio?.titulo) return; // ya tiene datos
    const partnerId = usuarioId1 && usuarioId2
      ? (usuarioId1 !== usuarioId2 ? null : null) // se resuelve abajo
      : null;
    // Buscar el primer servicio del otro usuario del chat
    const fetchServicio = async () => {
      // Determinar quién es el partner (no el usuario actual)
      const { data: { user } } = await supabase.auth.getUser();
      const myId = user?.id;
      const workerId = usuarioId1 === myId ? usuarioId2 : usuarioId1;
      if (!workerId) return;
      const { data } = await supabase
        .from('servicios')
        .select('id, titulo, descripcion, categoria, horario, precio')
        .eq('usuario_id', workerId)
        .limit(1)
        .maybeSingle();
      if (data) setServicioData(data);
    };
    fetchServicio();
  }, []);

  // --- Cargar usuario y mensajes iniciales
  useEffect(() => {
    let isMounted = true;
    setLoadingMsg(true);
    setMensajes([]);
    setHasOlderMessages(false);

    const init = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error("No se pudo obtener el usuario:", error);
        return;
      }
      if (!isMounted) return;

      setUsuarioId(user.id);
      const [{ data: appProfile }, { data: marketplaceProfile }] =
        await Promise.all([
          supabase.from("usuarios").select("rol").eq("id", user.id).maybeSingle(),
          supabase.from("sy_perfiles").select("rol").eq("id", user.id).maybeSingle(),
        ]);
      setCanSendQuote(
        String(appProfile?.rol ?? "").toLowerCase() === "worker" ||
          String(marketplaceProfile?.rol ?? "").toLowerCase() === "prestador",
      );
      await cargarMensajes(user.id);
      suscribirRealtime(user.id);
    };

    init();

    return () => {
      isMounted = false;
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    };
  }, [chatId]);

  // --- Cargar mensajes de la BD
  const cargarMensajes = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(CHAT_PAGE_SIZE);

      if (error) {
        console.error("[chat] error al cargar mensajes:", error.message, error);
        setLoadingMsg(false);
        return;
      }

      const initialMessages = [...(data ?? [])].reverse();
      setMensajes(initialMessages);
      setHasOlderMessages((data?.length ?? 0) === CHAT_PAGE_SIZE);
      setLoadingMsg(false);
      marcarComoLeidos(initialMessages, userId);

      // scroll al final
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    } catch (e) {
      console.error("[chat] excepción cargarMensajes:", e);
      setLoadingMsg(false);
    }
  };

  const cargarMensajesAnteriores = useCallback(async () => {
    if (loadingOlderMessages || !hasOlderMessages || mensajes.length === 0) {
      return;
    }

    const oldestCreatedAt = mensajes.find(
      (message) => message.tipo !== "fecha" && message.created_at,
    )?.created_at;
    if (!oldestCreatedAt) {
      setHasOlderMessages(false);
      return;
    }

    setLoadingOlderMessages(true);
    try {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .eq("chat_id", chatId)
        .lt("created_at", oldestCreatedAt)
        .order("created_at", { ascending: false })
        .limit(CHAT_PAGE_SIZE);

      if (error) throw error;
      const olderMessages = [...(data ?? [])].reverse();
      setMensajes((current) => {
        const knownIds = new Set(current.map((message) => message.id));
        return [
          ...olderMessages.filter((message) => !knownIds.has(message.id)),
          ...current,
        ];
      });
      setHasOlderMessages((data?.length ?? 0) === CHAT_PAGE_SIZE);
      if (usuarioId) marcarComoLeidos(olderMessages, usuarioId);
    } catch (error) {
      Alert.alert(
        "No se pudo cargar el historial",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [
    chatId,
    hasOlderMessages,
    loadingOlderMessages,
    mensajes,
    usuarioId,
  ]);

  // --- Marcar mensajes no leídos como leídos
  const marcarComoLeidos = async (mensajesData, userId) => {
    const mensajesNoLeidos = mensajesData.filter(
      (msg) =>
        msg.remitente_id?.toString().trim() !== userId?.toString().trim() &&
        !msg.leido
    );
    if (mensajesNoLeidos.length > 0) {
      const ids = mensajesNoLeidos.map((msg) => msg.id);
      await supabase.from("mensajes").update({ leido: true }).in("id", ids);
    }
  };

  // --- Suscripción realtime solo para este chat
  const suscribirRealtime = (userId) => {
    const channel = supabase
      .channel(`mensajes:chat_${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const nuevo = payload.new;
          setMensajes((prev) =>
            prev.some((message) => message.id === nuevo.id)
              ? prev
              : [...prev, nuevo],
          );
          // Si el mensaje no es mío, marcarlo como leído
          if (nuevo.remitente_id !== userId) {
            marcarComoLeidos([nuevo], userId);
          }
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    messageChannelRef.current = channel;
  };

  // --- Enviar mensaje (la push la dispara el trigger SQL `trg_notify_on_new_message`)
  const enviarMensaje = useCallback(async (mensaje) => {
    if (!mensaje.trim() || !usuarioId) return;

    const cleanMessage = mensaje.trim();
    const quote = parseQuoteMessage(cleanMessage);
    if (quote && !canSendQuote) {
      throw new Error("Solo el prestador puede crear un presupuesto.");
    }
    const policy = inspectChatContent(cleanMessage);
    if (!chatUnlocked && !policy.allowed) throw new Error(policy.message);

    const { error } = await supabase.from("mensajes").insert({
      chat_id: chatId,
      remitente_id: usuarioId,
      contenido: cleanMessage,
    });

    if (error) {
      console.error("Error al enviar mensaje:", error.message);
      throw new Error(
        error.message?.includes("CHAT_CONTACT_BLOCKED")
          ? "No se pueden compartir datos de contacto antes de confirmar el servicio."
          : error.message?.includes("CHAT_PRICE_REQUIRES_QUOTE")
            ? "Para hablar de montos, el prestador debe usar Crear presupuesto."
            : error.message?.includes("CHAT_QUOTE_PROVIDER_ONLY")
              ? "Solo el prestador puede crear un presupuesto."
              : error.message?.includes("CHAT_BLOCKED")
                ? "La conversación está bloqueada y no admite mensajes nuevos."
                : "No se pudo enviar el mensaje. Intentá nuevamente.",
      );
    }

    if (quote) {
      vexo.marketplace("quote_sent", {
        categoria: servicioData?.categoria || servicioData?.titulo || "sin_categoria",
      });
    }

    await supabase
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatId);
  }, [usuarioId, chatId, canSendQuote, chatUnlocked, servicioData?.categoria, servicioData?.titulo]);

  const enviarAudio = useCallback(async ({
    uri,
    durationMs,
    mimeType,
  }) => {
    if (!usuarioId) throw new Error("Necesitás iniciar sesión para enviar audios.");

    const { data: ticket, error: ticketError } = await supabase.functions.invoke(
      "chat-audio",
      {
        body: {
          action: "create-upload",
          chatId,
          durationMs,
          mimeType,
        },
      },
    );

    if (ticketError || !ticket?.path || !ticket?.token) {
      throw new Error(
        ticket?.error || ticketError?.message || "No se pudo preparar el audio.",
      );
    }

    const base64Audio = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const file = Uint8Array.from(atob(base64Audio), (character) =>
      character.charCodeAt(0),
    );
    if (ticket.maxFileBytes && file.byteLength > ticket.maxFileBytes) {
      throw new Error("El audio supera el tamaño máximo permitido.");
    }

    const { error: uploadError } = await supabase.storage
      .from(CHAT_AUDIO_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, file, {
        contentType: mimeType,
      });

    if (uploadError) {
      throw new Error(`No se pudo subir el audio: ${uploadError.message}`);
    }

    let transcript;
    const { data: transcriptionData } = await supabase.functions.invoke(
      "chat-audio",
      {
        body: {
          action: "transcribe",
          chatId,
          path: ticket.path,
        },
      },
    );
    if (typeof transcriptionData?.transcript === "string") {
      transcript = transcriptionData.transcript;
    }

    const descartarAudio = () =>
      supabase.functions.invoke("chat-audio", {
        body: { action: "discard", chatId, path: ticket.path },
      });

    const isConfirmed =
      jobStatus?.status === "approved" &&
      ["confirmed", "completed", "disputed"].includes(jobStatus?.job_status);
    if (!isConfirmed) {
      if (!transcript?.trim()) {
        await descartarAudio();
        throw new Error(
          "Antes de aceptar el presupuesto, los audios necesitan transcripción para mantener protegido el chat.",
        );
      }
      const policy = inspectChatText(transcript);
      if (!policy.allowed) {
        await descartarAudio();
        throw new Error(policy.message);
      }
    }

    const contenido = createAudioMessageContent({
      path: ticket.path,
      durationMs,
      mimeType,
      transcript,
    });

    const { error: messageError } = await supabase.from("mensajes").insert({
      chat_id: chatId,
      remitente_id: usuarioId,
      contenido,
    });

    if (messageError) {
      await descartarAudio();
      throw new Error(
        messageError.message?.includes("CHAT_BLOCKED")
          ? "El audio se guardó, pero la conversación está bloqueada."
          : `El audio se subió, pero no se pudo enviar: ${messageError.message}`,
      );
    }

    vexo.marketplace("audio_sent", {
      duracion_segundos: Math.round(durationMs / 1000),
      transcripto: Boolean(transcript),
    });
    if (transcript) {
      vexo.marketplace("audio_transcribed", {
        duracion_segundos: Math.round(durationMs / 1000),
      });
    } else {
      vexo.marketplace("audio_transcription_failed", {
        duracion_segundos: Math.round(durationMs / 1000),
      });
    }

    await supabase
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatId);
  }, [chatId, usuarioId, jobStatus?.status, jobStatus?.job_status]);

  const sanitizeMicaContext = (value) =>
    String(value ?? "")
      .replace(/https?:\/\/\S+/gi, "[enlace externo oculto]")
      .replace(/(?:\+?\d[\s().-]*){8,}/g, "[dato de contacto oculto]")
      .slice(0, 1800);

  const buildMicaChatHistory = useCallback(async () => {
    const recentMessages = mensajes.slice(-24);
    let transcriptionAttempts = 0;

    return Promise.all(
      recentMessages.map(async (message) => {
        const micaMessage = parseMicaSystemMessage(message.contenido);
        if (micaMessage) {
          return {
            author: "mica",
            text: `MICA: ${sanitizeMicaContext(micaMessage.text)}`,
          };
        }

        const audioMessage = parseAudioMessageContent(message.contenido);
        let content = message.contenido ?? "";
        if (audioMessage) {
          let transcript = audioMessage.transcript;
          if (!transcript && transcriptionAttempts < 3) {
            transcriptionAttempts += 1;
            const { data } = await supabase.functions.invoke("chat-audio", {
              body: {
                action: "transcribe",
                chatId,
                path: audioMessage.path,
              },
            });
            if (typeof data?.transcript === "string") {
              transcript = data.transcript;
            }
          }
          content = transcript
            ? `Transcripción de audio: ${transcript}`
            : "Audio sin transcripción disponible";
        } else {
          const quote = parseQuoteMessage(message.contenido);
          if (quote) {
            content = [
              `Presupuesto ${formatQuoteAmount(quote.amount)}`,
              `Alcance: ${quote.scope}`,
              `Materiales: ${quote.materials}`,
              `Tiempo: ${quote.timeframe}`,
              `Garantía: ${quote.warranty}`,
            ].join(". ");
          }
        }

        const author =
          message.remitente_id === usuarioId ? "Yo" : "La otra persona";
        return {
          author: "user",
          text: `${author}: ${sanitizeMicaContext(content)}`,
        };
      }),
    );
  }, [chatId, mensajes, usuarioId]);

  const pedirAyudaAMica = useCallback(async (question) => {
    if (!usuarioId || askingMica) return;
    setAskingMica(true);

    try {
      const history = await buildMicaChatHistory();
      const { data, error } = await supabase.functions.invoke("mica-chat", {
        body: {
          mode: "intermediar-chat",
          message: question,
          history,
          insight: { chatId },
        },
      });

      if (error || !data?.reply) {
        throw new Error(
          data?.error || error?.message || "MICA no pudo responder.",
        );
      }

      const contenido = createMicaAssistantContent(data.reply, usuarioId);
      const { error: messageError } = await supabase.from("mensajes").insert({
        chat_id: chatId,
        remitente_id: usuarioId,
        contenido,
      });
      if (messageError) throw messageError;

      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);
      setMicaAssistantVisible(false);
      vexo.marketplace("mica_intervention", {
        audios_sin_transcribir: mensajes.some((message) => {
          const audio = parseAudioMessageContent(message.contenido);
          return Boolean(audio && !audio.transcript);
        }),
      });
    } catch (error) {
      vexo.marketplace("mica_response_failed", {
        audios_sin_transcribir: hasUntranscribedAudio,
      });
      Alert.alert(
        "MICA no pudo intervenir",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setAskingMica(false);
    }
  }, [
    askingMica,
    buildMicaChatHistory,
    chatId,
    mensajes,
    usuarioId,
  ]);

  const hasUntranscribedAudio = mensajes.some((message) => {
    const audio = parseAudioMessageContent(message.contenido);
    return Boolean(audio && !audio.transcript);
  });

  // ---  Función para formatear la fecha con "Hoy", "Ayer" o DD/MM/YYYY
  const formatearFecha = (fechaISO) => {
    const fecha = new Date(fechaISO); // UTC → local automáticamente
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    const mismaFecha = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (mismaFecha(fecha, hoy)) return "Hoy";
    if (mismaFecha(fecha, ayer)) return "Ayer";

    // Formato DD/MM/YYYY
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  // ---  Genera la lista con "chips" de fecha
  const mensajesConFechas = () => {
    const resultado = [];
    let ultimaFecha = null;

    for (const msg of mensajes) {
      const fechaMsg = formatearFecha(msg.created_at);
      if (fechaMsg !== ultimaFecha) {
        // Insertar chip de fecha
        resultado.push({ tipo: 'fecha', fecha: fechaMsg, id: `fecha-${fechaMsg}` });
        ultimaFecha = fechaMsg;
      }
      resultado.push({ ...msg, tipo: 'mensaje' });
    }

    return resultado;
  };

  const abrirEditorTranscripcion = (messageId, audioMessage) => {
    setTranscriptEditor({
      messageId,
      audioMessage,
      text: audioMessage.transcript || "",
    });
  };

  const guardarTranscripcion = async () => {
    if (!transcriptEditor || !usuarioId || savingTranscript) return;

    try {
      setSavingTranscript(true);
      const transcript = transcriptEditor.text.trim();
      const contenido = createAudioMessageContent({
        path: transcriptEditor.audioMessage.path,
        durationMs: transcriptEditor.audioMessage.durationMs,
        mimeType: transcriptEditor.audioMessage.mimeType,
        transcript,
      });
      const { error } = await supabase
        .from("mensajes")
        .update({ contenido })
        .eq("id", transcriptEditor.messageId)
        .eq("remitente_id", usuarioId);

      if (error) throw error;

      setMensajes((current) =>
        current.map((message) =>
          message.id === transcriptEditor.messageId
            ? { ...message, contenido }
            : message,
        ),
      );
      setTranscriptEditor(null);
    } catch (error) {
      Alert.alert(
        "No se pudo corregir",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setSavingTranscript(false);
    }
  };

  const renderItem = ({ item }) => {
    if (item.tipo === 'fecha') {
      return (
        <View style={styles.fechaChipContainer}>
          <Text style={styles.fechaChipText}>{item.fecha}</Text>
        </View>
      );
    }

    const esMio = item.remitente_id === usuarioId;
    const micaSystemMessage = parseMicaSystemMessage(item.contenido);
    if (micaSystemMessage) {
      return <MicaSystemBubble message={micaSystemMessage} />;
    }

    const audioMessage = parseAudioMessageContent(item.contenido);
    const quote = audioMessage ? null : parseQuoteMessage(item.contenido);
    const esPresupuestoTexto = typeof item.contenido === 'string' && item.contenido.startsWith('💰 Presupuesto:');
    const montoMatch = esPresupuestoTexto && item.contenido.match(/\$([\d.,]+)/);
    const montoNumerico = quote?.amount ?? (montoMatch ? Number.parseFloat(montoMatch[1].replace(/\./g, '').replace(',', '.')) : 0);
    const esPresupuesto = Boolean(quote) || esPresupuestoTexto;

    return (
      <View
        style={[
          quote ? styles.quoteMessageContainer : styles.mensajeContainer,
          esMio ? styles.mensajeDerecha : styles.mensajeIzquierda,
        ]}
      >
        {audioMessage ? (
          <VoiceMessageBubble
            chatId={chatId}
            message={audioMessage}
            isOwn={esMio}
            onEditTranscript={
              esMio
                ? () => abrirEditorTranscripcion(item.id, audioMessage)
                : undefined
            }
          />
        ) : quote ? (
          <View style={styles.quoteCard}>
            <View style={styles.quoteHeader}>
              <View>
                <Text style={styles.quoteEyebrow}>Presupuesto completo</Text>
                <Text style={styles.quoteTitle}>Propuesta profesional</Text>
              </View>
              <View style={styles.quoteBadge}>
                <Ionicons name="shield-checkmark" size={15} color="#047a8f" />
                <Text style={styles.quoteBadgeText}>App segura</Text>
              </View>
            </View>

            <Text style={styles.quoteAmount}>{formatQuoteAmount(quote.amount)}</Text>
            <Text style={styles.quotePricingMode}>
              {pricingModeLabel(getQuotePricing(quote).pricingMode)} · {quotePricingSummary(getQuotePricing(quote))}
            </Text>

            <View style={styles.quoteDivider} />
            <QuoteRow icon="construct-outline" label="Incluye" value={quote.scope} />
            <QuoteRow icon="cube-outline" label="Materiales" value={quote.materials} />
            <QuoteRow icon="time-outline" label="Tiempo" value={quote.timeframe} />
            <QuoteRow icon="ribbon-outline" label="Garantia" value={quote.warranty} />
            <QuoteRow icon="calendar-outline" label="Validez" value={quote.validUntil} />
            {quote.notes ? <QuoteRow icon="document-text-outline" label="Notas" value={quote.notes} /> : null}
          </View>
        ) : (
          <Text style={styles.textoMensaje}>{item.contenido}</Text>
        )}
        {esPresupuesto && !esMio && jobStatus?.status !== "approved" && (
          <TouchableOpacity
            style={styles.pagarBtn}
            onPress={() => pagarPresupuesto(item.id)}
            disabled={pagando}
            activeOpacity={0.8}
          >
            <Ionicons name="card-outline" size={15} color="#fff" />
            <Text style={styles.pagarBtnText}>
              {pagando ? 'Procesando...' : `Aceptar y pagar 10% ($${Math.round(calculateServiceConfirmationFee(montoNumerico)).toLocaleString('es-AR')})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEstrellas = () => {
    return (
      <View style={styles.estrellasContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity key={i} onPress={() => setEstrellas(i)}>
            <Ionicons
              name={i <= estrellas ? "star" : "star-outline"}
              size={32}
              color="#f5c518"
              style={{ marginHorizontal: 5 }}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const enviarCalificacion = async () => {
    if (!jobStatus?.payment_record_id) {
      Alert.alert(
        "Trabajo no confirmado",
        "Solo se puede calificar un trabajo con pago confirmado dentro de la app.",
      );
      return;
    }
    if (estrellas < 1 || estrellas > 5) {
      Alert.alert("Elegí una calificación", "Marcá entre 1 y 5 estrellas.");
      return;
    }

    setEnviandoCalificacion(true);
    try {
      const { data, error } = await supabase.rpc(
        "submit_service_job_review",
        {
          p_payment_record_id: jobStatus.payment_record_id,
          p_rating: estrellas,
          p_comment: comentarioCalificacion.trim() || null,
        },
      );
      if (error || !data?.ok) {
        throw new Error(
          error?.message || "No se pudo guardar la calificación.",
        );
      }

      vexo.marketplace("job_completed", {
        categoria: servicioData?.categoria || servicioData?.titulo || "sin_categoria",
      });
      vexo.marketplace("rating_submitted", {
        estrellas,
      });
      setModalVisible(false);
      setComentarioCalificacion("");
      await cargarEstadoTrabajo();
      Alert.alert(
        "Trabajo terminado",
        "La calificación quedó vinculada a un servicio confirmado.",
      );
    } catch (error) {
      Alert.alert(
        "No se pudo calificar",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  const pagarPresupuesto = async (messageId) => {
    setPagando(true);
    vexo.marketplace("payment_started", {
      origen: "presupuesto_chat",
    });
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-payment-preference",
        {
          body: {
            chatId,
            messageId,
          },
        },
      );
      if (error) throw error;

      if (data?.approved) {
        vexo.marketplace("payment_confirmed", {
          origen: "presupuesto_previamente_aprobado",
        });
        await cargarEstadoTrabajo();
        Alert.alert(
          "Pago verificado",
          "Este presupuesto ya tiene una confirmación de pago aprobada.",
        );
      } else if (data?.initPoint) {
        await Linking.openURL(data.initPoint);
      } else {
        throw new Error(
          data?.error || "No se pudo generar el pago. Intentá nuevamente.",
        );
      }
    } catch (error) {
      vexo.marketplace("payment_failed", {
        etapa: "crear_preferencia",
      });
      Alert.alert(
        "No se pudo iniciar el pago",
        error instanceof Error
          ? error.message
          : "Falló la conexión segura con Mercado Pago.",
      );
    } finally {
      setPagando(false);
    }
  };

  const reportarIncidente = useCallback((category) => {
    if (!jobStatus?.payment_record_id || reportandoIncidente) return;
    const label =
      category === "provider_no_show"
        ? "El prestador no se presentó"
        : "El trabajo no se realizó";
    Alert.alert(
      "Abrir reclamo con MICA",
      `${label}. MICA registrará el caso y, si requiere intervención humana, lo enviará a la bandeja operativa de Agustín.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Abrir reclamo",
          style: "destructive",
          onPress: async () => {
            setReportandoIncidente(true);
            try {
              const { data, error } = await supabase.rpc(
                "report_service_job_incident",
                {
                  p_payment_record_id: jobStatus.payment_record_id,
                  p_category: category,
                  p_details: label,
                },
              );
              if (error || !data?.ok) {
                throw new Error(error?.message || "No se pudo registrar el reclamo.");
              }
              await cargarEstadoTrabajo();
              Alert.alert(
                "Reclamo registrado",
                `MICA abrió el caso ${data.case_number}. Quedó en revisión y también aparecerá en la bandeja operativa de Agustín.`,
              );
            } catch (error) {
              Alert.alert(
                "No se pudo abrir el reclamo",
                error instanceof Error ? error.message : "Intentá nuevamente.",
              );
            } finally {
              setReportandoIncidente(false);
            }
          },
        },
      ],
    );
  }, [cargarEstadoTrabajo, jobStatus?.payment_record_id, reportandoIncidente]);

  const elegirTipoIncidente = useCallback(() => {
    Alert.alert(
      "¿Qué pasó con el servicio?",
      "MICA puede iniciar el reclamo sin cerrar el trabajo ni ordenar un reembolso automático.",
      [
        { text: "No se presentó", onPress: () => reportarIncidente("provider_no_show") },
        { text: "No se realizó", onPress: () => reportarIncidente("work_not_completed") },
        { text: "Cancelar", style: "cancel" },
      ],
    );
  }, [reportarIncidente]);

  return (
    <>
      <BotonVolver />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.titulo}>{nombre}</Text>
            <View style={styles.secureChatRow}>
              <Ionicons name="shield-checkmark" size={13} color="#e7fffb" />
              <Text style={styles.secureChatText}>Chat interno protegido</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityLabel="Seguridad de la conversación"
              activeOpacity={0.78}
              onPress={() => setTrustSafetyVisible(true)}
              style={styles.safetyHeaderButton}
            >
              <Ionicons name="shield-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Pedir ayuda a MICA"
              activeOpacity={0.78}
              onPress={() => setMicaAssistantVisible(true)}
              style={styles.micaHelpButton}
            >
              <Ionicons name="sparkles" size={16} color="#087989" />
              <Text style={styles.micaHelpButtonText}>Ayuda MICA</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loadingMsg ? (
          <View style={styles.spinnerContainer}>
            <ActivityIndicator size="large" color="#FFA13C" />
            <Text style={styles.spinnerText}>Cargando mensajes...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={mensajesConFechas()}
            keyExtractor={(item, index) => item.id?.toString() ?? `fecha-${index}`}
            renderItem={renderItem}
            ListHeaderComponent={
              <View>
                {jobStatus ? (
                  <JobStatusBanner
                    status={jobStatus}
                    reporting={reportandoIncidente}
                    onReportIssue={elegirTipoIncidente}
                    onReview={() => {
                      setEstrellas(0);
                      setComentarioCalificacion("");
                      setModalVisible(true);
                    }}
                  />
                ) : null}
                {hasOlderMessages ? (
                  <TouchableOpacity
                    activeOpacity={0.78}
                    disabled={loadingOlderMessages}
                    onPress={cargarMensajesAnteriores}
                    style={styles.loadOlderButton}
                  >
                    {loadingOlderMessages ? (
                      <ActivityIndicator size="small" color="#087989" />
                    ) : (
                      <Ionicons name="time-outline" size={16} color="#087989" />
                    )}
                    <Text style={styles.loadOlderText}>
                      {loadingOlderMessages
                        ? "Cargando historial..."
                        : "Ver mensajes anteriores"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <ChatRules />
              </View>
            }
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 10 }}
            //onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            //onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {!loadingMsg && (
          <ChatInputBar
            serviceId={servicioId}
            onSend={enviarMensaje}
            onSendAudio={enviarAudio}
            canSendQuote={canSendQuote}
            contentProtectionActive={!chatUnlocked}
          />
        )}

        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalFondo}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitulo}>Finalizar y calificar</Text>
              <Text style={styles.modalHint}>
                Confirmá que el trabajo terminó. Tu opinión quedará vinculada a
                este servicio verificado.
              </Text>
              {renderEstrellas()}
              <TextInput
                editable={!enviandoCalificacion}
                multiline
                maxLength={800}
                onChangeText={setComentarioCalificacion}
                placeholder="Contá brevemente cómo fue el trabajo (opcional)"
                placeholderTextColor="#87979a"
                style={styles.ratingCommentInput}
                textAlignVertical="top"
                value={comentarioCalificacion}
              />
              <TouchableOpacity
                disabled={enviandoCalificacion || estrellas === 0}
                style={[
                  styles.botonModal,
                  styles.botonEnviarCalificacion,
                  (enviandoCalificacion || estrellas === 0) &&
                    styles.botonModalDisabled,
                ]}
                onPress={enviarCalificacion}
              >
                {enviandoCalificacion ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.textoBotonModal}>
                    Confirmar trabajo terminado
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                disabled={enviandoCalificacion}
                style={styles.botonCerrarModal}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(transcriptEditor)}
          animationType="fade"
          transparent
          onRequestClose={() => {
            if (!savingTranscript) setTranscriptEditor(null);
          }}
        >
          <View style={styles.transcriptModalOverlay}>
            <View style={styles.transcriptModalCard}>
              <Text style={styles.transcriptModalTitle}>
                Corregir transcripción
              </Text>
              <Text style={styles.transcriptModalHint}>
                Escuchá el audio y corregí nombres, precios, horarios o
                direcciones antes de pedir ayuda a MICA.
              </Text>
              <TextInput
                editable={!savingTranscript}
                multiline
                maxLength={4000}
                onChangeText={(text) =>
                  setTranscriptEditor((current) =>
                    current ? { ...current, text } : current,
                  )
                }
                placeholder="Escribí lo que dice el audio..."
                placeholderTextColor="#829296"
                style={styles.transcriptModalInput}
                textAlignVertical="top"
                value={transcriptEditor?.text || ""}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={savingTranscript}
                onPress={guardarTranscripcion}
                style={styles.transcriptSaveButton}
              >
                {savingTranscript ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.transcriptSaveText}>
                    Guardar corrección
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={savingTranscript}
                onPress={() => setTranscriptEditor(null)}
                style={styles.transcriptCancelButton}
              >
                <Text style={styles.transcriptCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <MicaAssistantModal
          visible={micaAssistantVisible}
          loading={askingMica}
          hasUntranscribedAudio={hasUntranscribedAudio}
          onClose={() => {
            if (!askingMica) setMicaAssistantVisible(false);
          }}
          onAsk={pedirAyudaAMica}
        />

        {partnerId ? (
          <TrustSafetyModal
            visible={trustSafetyVisible}
            providerId={partnerId}
            providerName={nombre}
            serviceId={
              Number.isFinite(Number(servicioData?.id || servicioId))
                ? Number(servicioData?.id || servicioId)
                : null
            }
            onClose={() => setTrustSafetyVisible(false)}
            onBlocked={() => {
              setTrustSafetyVisible(false);
              navigation.goBack();
            }}
          />
        ) : null}

      </KeyboardAvoidingView>
    </>
  );
}

export default withModalProvider(ChatIndividual);

function QuoteRow({ icon, label, value }) {
  return (
    <View style={styles.quoteRow}>
      <View style={styles.quoteRowIcon}>
        <Ionicons name={icon} size={15} color="#047a8f" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quoteRowLabel}>{label}</Text>
        <Text style={styles.quoteRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function JobStatusBanner({ status, onReview, onReportIssue, reporting }) {
  const completed = status.job_status === "completed";
  const disputed = status.job_status === "disputed";
  const incidentClosed = ["resolved", "dismissed"].includes(status.incident_status);
  const amount = Number(status.amount_total ?? 0);
  return (
    <View
      style={[
        jobStyles.container,
        completed && jobStyles.containerCompleted,
        disputed && jobStyles.containerDisputed,
      ]}
    >
      <View
        style={[
          jobStyles.icon,
          completed && jobStyles.iconCompleted,
        ]}
      >
        <Ionicons
          name={completed ? "checkmark-done" : disputed ? "alert-circle" : "shield-checkmark"}
          size={19}
          color="#fff"
        />
      </View>
      <View style={jobStyles.copy}>
        <Text style={jobStyles.eyebrow}>
          {completed ? "TRABAJO VERIFICADO" : disputed ? incidentClosed ? "RECLAMO REVISADO" : "RECLAMO EN REVISIÓN" : "SERVICIO CONFIRMADO"}
        </Text>
        <Text style={jobStyles.title}>
          {completed
            ? "Trabajo terminado dentro de la app"
            : disputed
              ? `Caso ${status.incident_case_number ?? "abierto"} ${incidentClosed ? "cerrado por soporte" : "derivado a soporte"}`
              : "El presupuesto quedó confirmado"}
        </Text>
        <Text style={jobStyles.text}>
          {amount > 0
            ? `Presupuesto de ${formatQuoteAmount(amount)}. `
            : ""}
          {completed
            ? status.rating
              ? `Calificación registrada: ${status.rating}/5.`
              : "El cierre quedó registrado."
            : disputed
              ? incidentClosed
                ? "La revisión humana finalizó. El pago conserva su historial y no se reembolsa automáticamente."
                : "MICA reunió el contexto y el equipo operativo puede tomar el caso desde su bandeja."
            : status.is_payer
              ? "Cuando finalice, cerralo y calificá al prestador."
              : "El cliente podrá cerrarlo y calificar al finalizar."}
        </Text>
        {status.can_review ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onReview}
            style={jobStyles.reviewButton}
          >
            <Ionicons name="star-outline" size={16} color="#fff" />
            <Text style={jobStyles.reviewButtonText}>
              Finalizar y calificar
            </Text>
          </TouchableOpacity>
        ) : null}
        {status.is_payer && status.job_status === "confirmed" ? (
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={reporting}
            onPress={onReportIssue}
            style={jobStyles.issueButton}
          >
            <Ionicons name="help-circle-outline" size={15} color="#8a4b08" />
            <Text style={jobStyles.issueButtonText}>
              {reporting ? "Abriendo reclamo..." : "¿No se presentó o hubo un problema?"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const jobStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#b9dfe5",
    backgroundColor: "#eaf8fb",
  },
  containerCompleted: {
    borderColor: "#bde4d5",
    backgroundColor: "#edf9f4",
  },
  containerDisputed: {
    borderColor: "#f0c78a",
    backgroundColor: "#fff8e8",
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#047a8f",
  },
  iconCompleted: {
    backgroundColor: "#12815e",
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    color: "#047a8f",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 2,
    color: "#1e4148",
    fontSize: 13,
    fontWeight: "900",
  },
  text: {
    marginTop: 4,
    color: "#587277",
    fontSize: 10.5,
    lineHeight: 15,
  },
  reviewButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#12815e",
  },
  reviewButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  issueButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingVertical: 5,
  },
  issueButtonText: {
    color: "#8a4b08",
    fontSize: 10.5,
    fontWeight: "700",
  },
});

function ChatRules() {
  const rules = [
    { icon: "🔢", text: "No compartas teléfonos ni datos de contacto externos. Coordiná todo dentro del chat seguro." },
    { icon: "💬", text: "Podés conversar y pedir aclaraciones antes de aceptar. Mantené toda la coordinación dentro de este chat." },
    { icon: "💰", text: "El prestador envía el monto con \"Crear presupuesto\". Al aceptar, el cliente paga la comisión del 10% dentro de la app." },
    { icon: "🤝", text: "Tratá con respeto a todos los usuarios. El lenguaje ofensivo puede resultar en una suspensión." },
    { icon: "🔒", text: "No compartas contraseñas, datos bancarios ni información personal sensible." },
    { icon: "⚠️", text: "Los acuerdos fuera de la plataforma no tienen cobertura ni garantía de Servicios Ya." },
  ];
  return (
    <View style={rulesStyles.container}>
      <View style={rulesStyles.header}>
        <Text style={rulesStyles.headerIcon}>🛡️</Text>
        <Text style={rulesStyles.headerTitle}>Reglas del chat</Text>
      </View>
      {rules.map((r) => (
        <View key={r.text} style={rulesStyles.row}>
          <Text style={rulesStyles.ruleIcon}>{r.icon}</Text>
          <Text style={rulesStyles.ruleText}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

const rulesStyles = StyleSheet.create({
  container: {
    backgroundColor: "#f0fbfd",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#b2e4ee",
    padding: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  headerIcon: { fontSize: 17 },
  headerTitle: { fontSize: 14, fontWeight: "800", color: "#047a8f" },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 7,
  },
  ruleIcon: { fontSize: 14, marginTop: 1 },
  ruleText: { flex: 1, fontSize: 12.5, color: "#445", lineHeight: 18 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8FAF7", // Turquesa clarito
  },
  spinnerContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  spinnerText: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#19D4C6", // Turquesa fuerte
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    justifyContent: "space-between",
    elevation: 6,
    shadowColor: "#19D4C6AA",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "left",
  },
  headerCopy: {
    flex: 1,
  },
  secureChatRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  secureChatText: {
    color: "#e7fffb",
    fontSize: 11,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  safetyHeaderButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: 14,
    backgroundColor: "rgba(4,122,143,0.28)",
  },
  micaHelpButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
  },
  micaHelpButtonText: {
    color: "#087989",
    fontSize: 11,
    fontWeight: "900",
  },
  loadOlderButton: {
    minHeight: 40,
    marginBottom: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#dff5f2",
    borderWidth: 1,
    borderColor: "#b8e1dc",
  },
  loadOlderText: {
    color: "#087989",
    fontSize: 12,
    fontWeight: "800",
  },
  botonInfo: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: "#FFA13C",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
    marginLeft: 10,
    elevation: 2,
  },
  textoBotonInfo:{
    color:"#fff",
    fontWeight:'bold'
  },
  // Burbujas de chat
  mensajeContainer: {
    maxWidth: "78%",
    padding: 13,
    borderRadius: 22,
    marginVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  quoteMessageContainer: {
    maxWidth: "92%",
    padding: 4,
    borderRadius: 10,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  mensajeDerecha: {
    alignSelf: "flex-end",
    backgroundColor: "#19D4C6",
  },
  mensajeIzquierda: {
    alignSelf: "flex-start",
    backgroundColor: "#FFA13C",
  },
  textoMensaje: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  quoteCard: {
    width: "100%",
    minWidth: 286,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d5eef2",
    padding: 14,
  },
  quoteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  quoteEyebrow: {
    color: "#047a8f",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  quoteTitle: {
    color: "#102a35",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  quoteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    backgroundColor: "#e8fbf7",
    borderWidth: 1,
    borderColor: "#b9ece7",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  quoteBadgeText: {
    color: "#047a8f",
    fontSize: 11,
    fontWeight: "900",
  },
  quoteAmount: {
    color: "#102a35",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 12,
  },
  quotePricingMode: {
    color: "#53747c",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  quoteDivider: {
    height: 1,
    backgroundColor: "#e5f2f4",
    marginVertical: 12,
  },
  quoteRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 10,
  },
  quoteRowIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eefbfd",
  },
  quoteRowLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  quoteRowValue: {
    color: "#1f3540",
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "600",
  },
  pagarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#25D366",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pagarBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  // MODAL
  modalFondo: {
    flex: 1,
    backgroundColor: "rgba(34, 34, 34, 0.32)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 26,
    alignItems: "center",
    position: "relative",
    shadowColor: "#19D4C6",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 18,
  },
  modalTitulo: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 14,
    color: "#19D4C6",
    textAlign: "center",
  },
  modalHint: {
    marginBottom: 14,
    color: "#60777c",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  estrellasContainer: {
    flexDirection: "row",
    marginBottom: 18,
  },
  ratingCommentInput: {
    width: "100%",
    minHeight: 90,
    maxHeight: 130,
    marginBottom: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#b9deda",
    backgroundColor: "#f8fcfb",
    color: "#25464c",
    fontSize: 13,
  },
  botonModal: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 28,
    alignItems: "center",
    marginVertical: 6,
  },
  botonDenunciar: {
    backgroundColor: "#E45757",
  },
  botonEnviarCalificacion: {
    backgroundColor: "#12815e",
  },
  botonModalDisabled: {
    opacity: 0.45,
  },
  textoBotonModal: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  botonCerrarModal: {
    position: "absolute",
    top: 10,
    right: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 3,
  },
  transcriptModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(14,34,38,0.58)",
  },
  transcriptModalCard: {
    width: "100%",
    maxWidth: 440,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "#fff",
  },
  transcriptModalTitle: {
    color: "#173f45",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  transcriptModalHint: {
    marginTop: 7,
    color: "#5b7074",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  transcriptModalInput: {
    minHeight: 130,
    marginTop: 16,
    padding: 13,
    color: "#1e3438",
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: "#b9dadd",
    borderRadius: 14,
    backgroundColor: "#f8fcfc",
  },
  transcriptSaveButton: {
    minHeight: 48,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#047a8f",
  },
  transcriptSaveText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  transcriptCancelButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  transcriptCancelText: {
    color: "#687b7f",
    fontSize: 14,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fechaChipContainer: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginVertical: 8,
    backgroundColor: '#E0F7FA', // color base del chip
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3, // para Android
    borderWidth: 1,
    borderColor: '#B2EBF2', // borde sutil
  },
  fechaChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00796B',
    textAlign: 'center',
  },
});
