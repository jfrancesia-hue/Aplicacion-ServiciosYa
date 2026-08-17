import React, { useState, useEffect, useRef, useCallback } from "react";
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
import ServiceSystemBubble from "../components/chat/ServiceSystemBubble";
import BotonVolver from "../components/BotonVolver";
import { withModalProvider } from "../components/sheet/withModalProvider";
import {
  parseQuoteMessage,
  formatQuoteAmount,
  getQuotePricing,
} from "../lib/utils/quoteMessage";
import {
  pricingModeLabel,
  quotePricingSummary,
} from "../lib/utils/quotePricing";
import ServiceSchedulePanel from "../components/chat/ServiceSchedulePanel";
import MicaIncidentIntakeModal from "../components/chat/MicaIncidentIntakeModal";
import QuoteOperationalNoticeModal from "../components/quotes/QuoteOperationalNoticeModal";
import {
  calculateServiceConfirmationFee,
  QUOTE_OPERATIONAL_NOTICE_VERSION,
} from "../lib/constants/billing";
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
import { parseServiceSystemMessage } from "../lib/utils/serviceSystemMessage";
import TrustSafetyModal from "../components/trust/TrustSafetyModal";
import { useNavigation } from "@react-navigation/native";
import vexo from "../lib/vexo";
import { getPaymentReturnParam } from "../lib/utils/paymentReturn";
import { inspectChatContent, inspectChatText } from "../lib/utils/chatPolicy";

const CHAT_PAGE_SIZE = 40;

function ChatIndividual({ route }) {
  const navigation = useNavigation();
  const { chatId, nombre, servicio, usuarioId1, usuarioId2, servicioId } =
    route.params;

  const [mensajes, setMensajes] = useState([]);
  const [usuarioId, setUsuarioId] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewTarget, setReviewTarget] = useState("provider");
  const [estrellas, setEstrellas] = useState(0);
  const [comentarioCalificacion, setComentarioCalificacion] = useState("");
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const [pagando, setPagando] = React.useState(false);
  const [isProvider, setIsProvider] = useState(false);
  const [quoteStates, setQuoteStates] = useState({});
  const [requestingQuoteChanges, setRequestingQuoteChanges] = useState(null);
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [visitNote, setVisitNote] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);
  const [cancellationModalVisible, setCancellationModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationDetail, setCancellationDetail] = useState("");
  const [cancellingReservation, setCancellingReservation] = useState(false);
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
  const [incidentIntakeVisible, setIncidentIntakeVisible] = useState(false);
  const [pendingPaymentQuote, setPendingPaymentQuote] = useState(null);
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

  const cargarPresupuestosChat = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("chat_quotes")
        .select(
          "id,message_id,version,provider_id,client_id,amount_provider,fee_rate,fee_amount,client_total,status,accepted_at,paid_at",
        )
        .eq("chat_id", chatId)
        .order("version", { ascending: true });
      if (error) throw error;
      setQuoteStates(
        Object.fromEntries((data ?? []).map((quote) => [quote.message_id, quote])),
      );
    } catch (error) {
      console.warn("[chat] propuestas no disponibles:", error);
    }
  }, [chatId]);

  const verificarRetornoPago = useCallback(
    async (url) => {
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
        await Promise.all([cargarEstadoTrabajo(), cargarPresupuestosChat()]);
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
    },
    [cargarEstadoTrabajo, cargarPresupuestosChat],
  );

  useEffect(() => {
    void cargarEstadoTrabajo();
    void cargarPresupuestosChat();
  }, [cargarEstadoTrabajo, cargarPresupuestosChat]);

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
    const partnerId =
      usuarioId1 && usuarioId2
        ? usuarioId1 !== usuarioId2
          ? null
          : null // se resuelve abajo
        : null;
    // Buscar el primer servicio del otro usuario del chat
    const fetchServicio = async () => {
      // Determinar quién es el partner (no el usuario actual)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const myId = user?.id;
      const workerId = usuarioId1 === myId ? usuarioId2 : usuarioId1;
      if (!workerId) return;
      const { data } = await supabase
        .from("servicios")
        .select("id, titulo, descripcion, categoria, horario, precio")
        .eq("usuario_id", workerId)
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
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        console.error("No se pudo obtener el usuario:", error);
        return;
      }
      if (!isMounted) return;

      setUsuarioId(user.id);
      const [{ data: appProfile }, { data: marketplaceProfile }] =
        await Promise.all([
          supabase
            .from("usuarios")
            .select("rol")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("sy_perfiles")
            .select("rol")
            .eq("id", user.id)
            .maybeSingle(),
        ]);
      const currentUserIsProvider =
        String(appProfile?.rol ?? "").toLowerCase() === "worker" ||
        String(marketplaceProfile?.rol ?? "").toLowerCase() === "prestador";
      setCanSendQuote(currentUserIsProvider);
      setIsProvider(currentUserIsProvider);
      await Promise.all([
        cargarMensajes(user.id),
        cargarPresupuestosChat(),
        cargarEstadoTrabajo(),
      ]);
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
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
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
  }, [chatId, hasOlderMessages, loadingOlderMessages, mensajes, usuarioId]);

  // --- Marcar mensajes no leídos como leídos
  const marcarComoLeidos = async (mensajesData, userId) => {
    const mensajesNoLeidos = mensajesData.filter(
      (msg) =>
        msg.remitente_id?.toString().trim() !== userId?.toString().trim() &&
        !msg.leido,
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
          void cargarPresupuestosChat();
          void cargarEstadoTrabajo();
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    messageChannelRef.current = channel;
  };

  // --- Enviar mensaje (la push la dispara el trigger SQL `trg_notify_on_new_message`)
  const enviarMensaje = useCallback(
    async (mensaje) => {
      if (!mensaje.trim() || !usuarioId) return;

      const cleanMessage = mensaje.trim();
      const quote = parseQuoteMessage(cleanMessage);
      if (quote && !canSendQuote) {
        throw new Error("Solo el prestador puede crear un presupuesto.");
      }
      const policy = inspectChatContent(cleanMessage);
      if (!chatUnlocked && !policy.allowed) throw new Error(policy.message);

      if (quote) {
        const { data, error } = await supabase.rpc("send_chat_quote", {
          p_chat_id: chatId,
          p_amount: quote.amount,
          p_scope: quote.scope,
          p_materials: quote.materials,
          p_timeframe: quote.timeframe,
          p_warranty: quote.warranty,
          p_validity_text: quote.validUntil,
          p_notes: quote.notes ?? null,
          p_pricing_mode: quote.pricingMode ?? "project",
          p_unit_rate: quote.unitRate ?? quote.amount,
          p_estimated_units: quote.estimatedUnits ?? 1,
          p_reference_type: quote.referenceType ?? "fixed",
          p_operational_notice_version:
            quote.operationalNoticeVersion ?? null,
          p_operational_notice_accepted_at:
            quote.operationalNoticeAcceptedAt ?? null,
        });
        if (error || !data?.ok) {
          throw new Error(
            error?.message?.includes("QUOTE_ALREADY_CONFIRMED")
              ? "Ya existe una reserva confirmada o con pago iniciado en este chat."
              : error?.message || "No se pudo enviar la propuesta.",
          );
        }

        vexo.marketplace("quote_sent", {
          categoria:
            servicioData?.categoria || servicioData?.titulo || "sin_categoria",
        });
        await cargarPresupuestosChat();
        return;
      }

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

      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);
    },
    [
      usuarioId,
      chatId,
      canSendQuote,
      chatUnlocked,
      cargarPresupuestosChat,
      servicioData?.categoria,
      servicioData?.titulo,
    ],
  );

  const enviarAudio = useCallback(
    async ({ uri, durationMs, mimeType }) => {
      if (!usuarioId)
        throw new Error("Necesitás iniciar sesión para enviar audios.");

      const { data: ticket, error: ticketError } =
        await supabase.functions.invoke("chat-audio", {
          body: {
            action: "create-upload",
            chatId,
            durationMs,
            mimeType,
          },
        });

      if (ticketError || !ticket?.path || !ticket?.token) {
        throw new Error(
          ticket?.error ||
            ticketError?.message ||
            "No se pudo preparar el audio.",
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
    },
    [chatId, usuarioId, jobStatus?.status, jobStatus?.job_status],
  );

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
        const serviceSystemMessage = parseServiceSystemMessage(message.contenido);
        if (serviceSystemMessage) {
          return {
            author: "system",
            text: `ServiciosYa: ${sanitizeMicaContext(serviceSystemMessage.text)}`,
          };
        }

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

  const pedirAyudaAMica = useCallback(
    async (question) => {
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
    },
    [askingMica, buildMicaChatHistory, chatId, mensajes, usuarioId],
  );

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
    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
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
        resultado.push({
          tipo: "fecha",
          fecha: fechaMsg,
          id: `fecha-${fechaMsg}`,
        });
        ultimaFecha = fechaMsg;
      }
      resultado.push({ ...msg, tipo: "mensaje" });
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

  const solicitarCambiosPresupuesto = (quoteState) => {
    Alert.alert(
      "Pedir cambios",
      "La propuesta quedará pendiente de revisión. Podés explicar el cambio en el chat y el prestador deberá enviar una nueva versión.",
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Pedir cambios",
          onPress: async () => {
            setRequestingQuoteChanges(quoteState.id);
            try {
              const { data, error } = await supabase.rpc(
                "request_chat_quote_changes",
                {
                  p_quote_id: quoteState.id,
                  p_reason: "Revisar precio, alcance o condiciones",
                },
              );
              if (error || !data?.ok) {
                throw new Error(error?.message || "No se pudo pedir el cambio.");
              }
              await cargarPresupuestosChat();
            } catch (error) {
              Alert.alert(
                "No se pudo pedir el cambio",
                error instanceof Error ? error.message : "Intentá nuevamente.",
              );
            } finally {
              setRequestingQuoteChanges(null);
            }
          },
        },
      ],
    );
  };

  const confirmarReserva = (messageId, amount, feeAmount, clientTotal) => {
    Alert.alert(
      "Aceptar y reservar",
      `Precio del trabajo: ${formatQuoteAmount(amount)}\nCargo de reserva ServiciosYa: ${formatQuoteAmount(feeAmount)}\nCosto total: ${formatQuoteAmount(clientTotal)}\n\nAhora pagás solamente la reserva. El trabajo se paga directamente al prestador al finalizar.`,
      [
        { text: "Seguir conversando", style: "cancel" },
        {
          text: `Pagar ${formatQuoteAmount(feeAmount)}`,
          onPress: () => pagarPresupuesto(messageId),
        },
      ],
    );
  };

  const abrirAgendaVisita = () => {
    const suggested = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setVisitDate(
      `${String(suggested.getDate()).padStart(2, "0")}/${String(suggested.getMonth() + 1).padStart(2, "0")}/${suggested.getFullYear()}`,
    );
    setVisitTime("09:00");
    setVisitNote("");
    setVisitModalVisible(true);
  };

  const proponerVisita = async () => {
    if (!jobStatus?.payment_record_id) return;
    const dateMatch = visitDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const timeMatch = visitTime.trim().match(/^(\d{2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) {
      Alert.alert("Fecha inválida", "Usá el formato DD/MM/AAAA y HH:MM.");
      return;
    }

    const scheduledFor = new Date(
      Number(dateMatch[3]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[1]),
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      0,
      0,
    );
    const validDate =
      scheduledFor.getFullYear() === Number(dateMatch[3]) &&
      scheduledFor.getMonth() === Number(dateMatch[2]) - 1 &&
      scheduledFor.getDate() === Number(dateMatch[1]) &&
      scheduledFor.getHours() === Number(timeMatch[1]) &&
      scheduledFor.getMinutes() === Number(timeMatch[2]) &&
      scheduledFor.getTime() > Date.now();
    if (!validDate) {
      Alert.alert("Fecha inválida", "Elegí una fecha y hora futuras.");
      return;
    }

    setSavingVisit(true);
    try {
      const { data, error } = await supabase.rpc("propose_service_visit", {
        p_payment_record_id: jobStatus.payment_record_id,
        p_scheduled_for: scheduledFor.toISOString(),
        p_note: visitNote.trim() || null,
      });
      if (error || !data?.ok) {
        throw new Error(error?.message || "No se pudo proponer la visita.");
      }
      setVisitModalVisible(false);
      await cargarEstadoTrabajo();
    } catch (error) {
      Alert.alert(
        "No se pudo proponer la visita",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setSavingVisit(false);
    }
  };

  const responderVisita = async (accept) => {
    if (!jobStatus?.payment_record_id) return;
    try {
      setSavingVisit(true);
      const { data, error } = await supabase.rpc("respond_service_visit", {
        p_payment_record_id: jobStatus.payment_record_id,
        p_accept: accept,
      });
      if (error || !data?.ok) {
        throw new Error(error?.message || "No se pudo responder la fecha.");
      }
      await cargarEstadoTrabajo();
    } catch (error) {
      Alert.alert(
        "No se pudo actualizar la visita",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setSavingVisit(false);
    }
  };

  const abrirCancelacionReserva = () => {
    setCancellationReason(
      jobStatus?.is_provider ? "provider_cancelled" : "client_changed_mind",
    );
    setCancellationDetail("");
    setCancellationModalVisible(true);
  };

  const solicitarCancelacionReserva = async () => {
    if (
      !jobStatus?.payment_record_id ||
      !cancellationReason ||
      cancellingReservation
    ) {
      return;
    }

    setCancellingReservation(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "request-reservation-cancellation",
        {
          body: {
            paymentRecordId: jobStatus.payment_record_id,
            reasonCode: cancellationReason,
            reasonDetail: cancellationDetail.trim() || null,
          },
        },
      );
      if (error) throw error;

      setCancellationModalVisible(false);
      await Promise.all([cargarEstadoTrabajo(), cargarPresupuestosChat()]);

      if (data?.refunded) {
        Alert.alert(
          "Devolución procesada",
          `La reserva quedó cancelada y Mercado Pago recibió la devolución total del cargo. Código: ${data.requestCode ?? "registrado"}.`,
        );
      } else if (data?.reviewRequired) {
        Alert.alert(
          "Solicitud registrada",
          `El caso quedó en revisión. Código: ${data.requestCode ?? "registrado"}. Vas a ver cualquier cambio dentro de este chat.`,
        );
      } else if (!data?.ok) {
        Alert.alert(
          "Cancelación registrada",
          data?.message ||
            "La devolución requiere revisión. El caso quedó guardado.",
        );
      }
    } catch (error) {
      await cargarEstadoTrabajo();
      Alert.alert(
        "No se pudo cancelar",
        error instanceof Error
          ? error.message
          : "Intentá nuevamente desde la reserva.",
      );
    } finally {
      setCancellingReservation(false);
    }
  };

  const renderItem = ({ item }) => {
    if (item.tipo === "fecha") {
      return (
        <View style={styles.fechaChipContainer}>
          <Text style={styles.fechaChipText}>{item.fecha}</Text>
        </View>
      );
    }

    const esMio = item.remitente_id === usuarioId;
    const serviceSystemMessage = parseServiceSystemMessage(item.contenido);
    if (serviceSystemMessage) {
      return <ServiceSystemBubble message={serviceSystemMessage} />;
    }

    const micaSystemMessage = parseMicaSystemMessage(item.contenido);
    if (micaSystemMessage) {
      return <MicaSystemBubble message={micaSystemMessage} />;
    }

    const audioMessage = parseAudioMessageContent(item.contenido);
    const quote = audioMessage ? null : parseQuoteMessage(item.contenido);
    const esPresupuestoTexto =
      typeof item.contenido === "string" &&
      item.contenido.startsWith("💰 Presupuesto:");
    const montoMatch =
      esPresupuestoTexto && item.contenido.match(/\$([\d.,]+)/);
    const montoNumerico =
      quote?.amount ??
      (montoMatch
        ? Number.parseFloat(montoMatch[1].replace(/\./g, "").replace(",", "."))
        : 0);
    const esPresupuesto = Boolean(quote) || esPresupuestoTexto;
    const quoteState = quote ? quoteStates[item.id] ?? null : null;
    const providerAmount = Number(quoteState?.amount_provider ?? montoNumerico);
    const feeAmount = Number(
      quoteState?.fee_amount ??
        quote?.feeAmount ??
        calculateServiceConfirmationFee(providerAmount),
    );
    const clientTotal = Number(
      quoteState?.client_total ?? quote?.clientTotal ?? providerAmount + feeAmount,
    );
    const canReserve =
      Boolean(quoteState) &&
      !esMio &&
      quoteState.client_id === usuarioId &&
      ["pending", "accepted_payment_pending"].includes(quoteState.status);

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
                <Text style={styles.quoteEyebrow}>Propuesta de trabajo</Text>
                <Text style={styles.quoteTitle}>
                  Propuesta {quoteState?.version || quote.version
                    ? `v${quoteState?.version ?? quote.version}`
                    : "segura"}
                </Text>
              </View>
              <View style={styles.quoteBadge}>
                <Ionicons name="shield-checkmark" size={15} color="#047a8f" />
                <Text style={styles.quoteBadgeText}>
                  {quoteStatusLabel(quoteState?.status)}
                </Text>
              </View>
            </View>

            <Text style={styles.quotePriceLabel}>Precio del prestador</Text>
            <Text style={styles.quoteAmount}>
              {formatQuoteAmount(providerAmount)}
            </Text>
            <Text style={styles.quotePricingMode}>
              {pricingModeLabel(getQuotePricing(quote).pricingMode)} ·{" "}
              {quotePricingSummary(getQuotePricing(quote))}
            </Text>
            <View style={styles.quotePaymentBreakdown}>
              <View style={styles.quotePaymentRow}>
                <Text style={styles.quotePaymentLabel}>Reserva ServiciosYa (10%)</Text>
                <Text style={styles.quotePaymentValue}>{formatQuoteAmount(feeAmount)}</Text>
              </View>
              <View style={[styles.quotePaymentRow, styles.quotePaymentTotalRow]}>
                <Text style={styles.quotePaymentTotalLabel}>Costo total</Text>
                <Text style={styles.quotePaymentTotalValue}>{formatQuoteAmount(clientTotal)}</Text>
              </View>
              <Text style={styles.quotePaymentHint}>
                Se paga ahora solo la reserva. El trabajo se paga directamente al prestador al finalizar.
              </Text>
            </View>

            <View style={styles.quoteDivider} />
            <QuoteRow
              icon="construct-outline"
              label="Incluye"
              value={quote.scope}
            />
            <QuoteRow
              icon="cube-outline"
              label="Materiales"
              value={quote.materials}
            />
            <QuoteRow
              icon="time-outline"
              label="Tiempo"
              value={quote.timeframe}
            />
            <QuoteRow
              icon="ribbon-outline"
              label="Garantia"
              value={quote.warranty}
            />
            <QuoteRow
              icon="calendar-outline"
              label="Validez"
              value={quote.validUntil}
            />
            {quote.notes ? (
              <QuoteRow
                icon="document-text-outline"
                label="Notas"
                value={quote.notes}
              />
            ) : null}
          </View>
        ) : (
          <Text style={styles.textoMensaje}>{item.contenido}</Text>
        )}
        {canReserve ? (
          <View style={styles.quoteActions}>
            <TouchableOpacity
              style={styles.pagarBtn}
              onPress={() => confirmarReserva(item.id, providerAmount, feeAmount, clientTotal)}
              disabled={pagando}
              activeOpacity={0.8}
            >
              <Ionicons name="card-outline" size={15} color="#fff" />
              <Text style={styles.pagarBtnText}>
                {pagando
                  ? "Procesando..."
                  : quoteState.status === "accepted_payment_pending"
                    ? `Continuar pago de ${formatQuoteAmount(feeAmount)}`
                    : `Aceptar y reservar por ${formatQuoteAmount(feeAmount)}`}
              </Text>
            </TouchableOpacity>
            {quoteState.status === "pending" ? (
              <TouchableOpacity
                style={styles.requestChangesBtn}
                onPress={() => solicitarCambiosPresupuesto(quoteState)}
                disabled={requestingQuoteChanges === quoteState.id}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={15} color="#047a8f" />
                <Text style={styles.requestChangesText}>
                  {requestingQuoteChanges === quoteState.id ? "Actualizando..." : "Pedir cambios"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {quote && !quoteState && !esMio ? (
          <Text style={styles.legacyQuoteHint}>
            Esta propuesta es anterior al sistema de reserva. Pedile al prestador una nueva versión para poder aceptarla.
          </Text>
        ) : null}
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
        reviewTarget === "client"
          ? "submit_client_job_review"
          : "submit_service_job_review",
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

      if (reviewTarget === "provider") {
        vexo.marketplace("job_completed", {
          categoria:
            servicioData?.categoria || servicioData?.titulo || "sin_categoria",
        });
      }
      vexo.marketplace("rating_submitted", {
        estrellas,
      });
      setModalVisible(false);
      setComentarioCalificacion("");
      await cargarEstadoTrabajo();
      Alert.alert(
        reviewTarget === "provider"
          ? "Trabajo terminado"
          : "Cliente calificado",
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
            operationalNotice: {
              version: QUOTE_OPERATIONAL_NOTICE_VERSION,
              acceptedAt: new Date().toISOString(),
            },
          },
        },
      );
      if (error) throw error;

      if (data?.approved) {
        vexo.marketplace("payment_confirmed", {
          origen: "presupuesto_previamente_aprobado",
        });
        await Promise.all([cargarEstadoTrabajo(), cargarPresupuestosChat()]);
        Alert.alert(
          "Pago verificado",
          "Este presupuesto ya tiene una confirmación de pago aprobada.",
        );
      } else if (data?.initPoint) {
        await cargarPresupuestosChat();
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

  const reportarIncidente = useCallback(
    async (category, intake) => {
      if (!jobStatus?.payment_record_id || reportandoIncidente) return;
      setReportandoIncidente(true);
      try {
        const { data, error } = await supabase.rpc(
          "submit_service_incident_intake",
          {
            p_payment_record_id: jobStatus.payment_record_id,
            p_category: category,
            p_intake: intake,
          },
        );
        if (error || !data?.ok) {
          throw new Error(error?.message || "No se pudo registrar el reclamo.");
        }
        setIncidentIntakeVisible(false);
        await cargarEstadoTrabajo();
        Alert.alert(
          "Reclamo registrado",
          `MICA abrió el caso ${data.case_number}. El resumen quedó derivado a la bandeja operativa de Agustín.`,
        );
      } catch (error) {
        Alert.alert(
          "No se pudo abrir el reclamo",
          error instanceof Error ? error.message : "Intentá nuevamente.",
        );
        throw error;
      } finally {
        setReportandoIncidente(false);
      }
    },
    [cargarEstadoTrabajo, jobStatus?.payment_record_id, reportandoIncidente],
  );

  const elegirTipoIncidente = useCallback(() => {
    setIncidentIntakeVisible(true);
  }, []);

  return (
    <>
      <MicaIncidentIntakeModal
        visible={incidentIntakeVisible}
        submitting={reportandoIncidente}
        onClose={() => setIncidentIntakeVisible(false)}
        onSubmit={reportarIncidente}
      />
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
            keyExtractor={(item, index) =>
              item.id?.toString() ?? `fecha-${index}`
            }
            renderItem={renderItem}
            ListHeaderComponent={
              <View>
                {jobStatus ? (
                  <JobStatusBanner
                    status={jobStatus}
                    reporting={reportandoIncidente}
                    onReportIssue={elegirTipoIncidente}
                    busy={savingVisit || cancellingReservation}
                    onProposeVisit={abrirAgendaVisita}
                    onAcceptVisit={() => responderVisita(true)}
                    onRequestReschedule={() => responderVisita(false)}
                    onCancel={abrirCancelacionReserva}
                    onReview={() => {
                      setReviewTarget("provider");
                      setEstrellas(0);
                      setComentarioCalificacion("");
                      setModalVisible(true);
                    }}
                    onReviewClient={() => {
                      setReviewTarget("client");
                      setEstrellas(0);
                      setComentarioCalificacion("");
                      setModalVisible(true);
                    }}
                  />
                ) : null}
                {jobStatus?.status === "approved" &&
                jobStatus?.job_status === "confirmed" ? (
                  <ServiceSchedulePanel
                    chatId={chatId}
                    onChanged={cargarEstadoTrabajo}
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
            contentContainerStyle={{
              paddingVertical: 10,
              paddingHorizontal: 10,
            }}
            //onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            //onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {!loadingMsg && (
          <ChatInputBar
            serviceId={servicioId}
            canSendQuote={
              canSendQuote &&
              (!jobStatus?.payment_record_id ||
                jobStatus?.job_status === "cancelled") &&
              !Object.values(quoteStates).some((quote) =>
                ["accepted_payment_pending", "paid"].includes(quote.status),
              )
            }
            onSend={enviarMensaje}
            onSendAudio={enviarAudio}
            contentProtectionActive={!chatUnlocked}
          />
        )}

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalFondo}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitulo}>
                {reviewTarget === "client"
                  ? "Calificar al cliente"
                  : "Finalizar y calificar"}
              </Text>
              <Text style={styles.modalHint}>
                {reviewTarget === "client"
                  ? "Contá cómo fue la coordinación con el cliente. Una reseña aislada no genera sanciones automáticas."
                  : "Confirmá que el trabajo terminó. Tu opinión quedará vinculada a este servicio verificado."}
              </Text>
              {renderEstrellas()}
              <TextInput
                editable={!enviandoCalificacion}
                multiline
                maxLength={800}
                onChangeText={setComentarioCalificacion}
                placeholder={
                  reviewTarget === "client"
                    ? "Contá brevemente cómo fue la coordinación (opcional)"
                    : "Contá brevemente cómo fue el trabajo (opcional)"
                }
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
                    {reviewTarget === "client"
                      ? "Enviar calificación"
                      : "Confirmar trabajo terminado"}
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

        <Modal
          visible={visitModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => {
            if (!savingVisit) setVisitModalVisible(false);
          }}
        >
          <View style={styles.visitModalOverlay}>
            <View style={styles.visitModalCard}>
              <View style={styles.visitModalHeader}>
                <View style={styles.visitModalIcon}>
                  <Ionicons name="calendar-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visitModalTitle}>Proponer fecha de visita</Text>
                  <Text style={styles.visitModalHint}>El cliente deberá confirmar esta fecha dentro del chat.</Text>
                </View>
              </View>
              <Text style={styles.visitFieldLabel}>Fecha</Text>
              <TextInput
                editable={!savingVisit}
                keyboardType="numeric"
                onChangeText={setVisitDate}
                placeholder="DD/MM/AAAA"
                style={styles.visitInput}
                value={visitDate}
              />
              <Text style={styles.visitFieldLabel}>Hora</Text>
              <TextInput
                editable={!savingVisit}
                keyboardType="numeric"
                onChangeText={setVisitTime}
                placeholder="HH:MM"
                style={styles.visitInput}
                value={visitTime}
              />
              <Text style={styles.visitFieldLabel}>Nota opcional</Text>
              <TextInput
                editable={!savingVisit}
                maxLength={500}
                multiline
                onChangeText={setVisitNote}
                placeholder="Ej: necesito acceso al tablero eléctrico."
                style={[styles.visitInput, styles.visitNoteInput]}
                textAlignVertical="top"
                value={visitNote}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={savingVisit}
                onPress={proponerVisita}
                style={styles.visitSaveButton}
              >
                {savingVisit ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.visitSaveText}>Enviar fecha al cliente</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={savingVisit}
                onPress={() => setVisitModalVisible(false)}
                style={styles.visitCancelButton}
              >
                <Text style={styles.visitCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={cancellationModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => {
            if (!cancellingReservation) setCancellationModalVisible(false);
          }}
        >
          <View style={styles.cancellationModalOverlay}>
            <View style={styles.cancellationModalCard}>
              <View style={styles.cancellationModalHeader}>
                <View style={styles.cancellationModalIcon}>
                  <Ionicons name="receipt-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cancellationModalTitle}>
                    Cancelar reserva
                  </Text>
                  <Text style={styles.cancellationModalHint}>
                    {jobStatus?.is_provider
                      ? "Al cancelar como prestador se devuelve al cliente el cargo completo."
                      : "Si la visita todavía no ocurrió, se devuelve el cargo completo. Los casos posteriores pasan a revisión."}
                  </Text>
                </View>
              </View>

              <Text style={styles.cancellationFieldLabel}>Motivo</Text>
              <View style={styles.cancellationReasons}>
                {getCancellationReasons(Boolean(jobStatus?.is_provider)).map(
                  (reason) => (
                    <TouchableOpacity
                      activeOpacity={0.78}
                      disabled={cancellingReservation}
                      key={reason.value}
                      onPress={() => setCancellationReason(reason.value)}
                      style={[
                        styles.cancellationReasonButton,
                        cancellationReason === reason.value &&
                          styles.cancellationReasonButtonSelected,
                      ]}
                    >
                      <Ionicons
                        name={reason.icon}
                        size={16}
                        color={
                          cancellationReason === reason.value
                            ? "#fff"
                            : "#526d72"
                        }
                      />
                      <Text
                        style={[
                          styles.cancellationReasonText,
                          cancellationReason === reason.value &&
                            styles.cancellationReasonTextSelected,
                        ]}
                      >
                        {reason.label}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <Text style={styles.cancellationFieldLabel}>
                Detalle opcional
              </Text>
              <TextInput
                editable={!cancellingReservation}
                maxLength={800}
                multiline
                onChangeText={setCancellationDetail}
                placeholder="Contanos brevemente qué pasó."
                placeholderTextColor="#829296"
                style={styles.cancellationDetailInput}
                textAlignVertical="top"
                value={cancellationDetail}
              />

              <View style={styles.cancellationPolicyBox}>
                <Ionicons name="information-circle-outline" size={17} color="#8b5a18" />
                <Text style={styles.cancellationPolicyText}>
                  La acreditación de una devolución puede demorar según el medio
                  de pago. Recibirás un código de seguimiento inmediatamente.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={cancellingReservation || !cancellationReason}
                onPress={solicitarCancelacionReserva}
                style={[
                  styles.cancellationSubmitButton,
                  (cancellingReservation || !cancellationReason) &&
                    styles.cancellationSubmitButtonDisabled,
                ]}
              >
                {cancellingReservation ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.cancellationSubmitText}>
                    Solicitar cancelación
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                disabled={cancellingReservation}
                onPress={() => setCancellationModalVisible(false)}
                style={styles.cancellationCloseButton}
              >
                <Text style={styles.cancellationCloseText}>Volver</Text>
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

        <QuoteOperationalNoticeModal
          visible={Boolean(pendingPaymentQuote)}
          mode="accept"
          amount={pendingPaymentQuote?.amount ?? 0}
          busy={pagando}
          onClose={() => setPendingPaymentQuote(null)}
          onConfirm={async () => {
            if (!pendingPaymentQuote?.messageId || pagando) return;
            await pagarPresupuesto(pendingPaymentQuote.messageId);
            setPendingPaymentQuote(null);
          }}
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

function quoteStatusLabel(status) {
  const labels = {
    pending: "Pendiente",
    changes_requested: "Cambios pedidos",
    accepted_payment_pending: "Pago pendiente",
    paid: "Reserva confirmada",
    withdrawn: "Retirada",
    superseded: "Reemplazada",
    expired: "Vencida",
    cancelled: "Cancelada",
  };
  return labels[status] ?? "Propuesta anterior";
}

function getCancellationReasons(isProvider) {
  if (isProvider) {
    return [
      {
        value: "provider_cancelled",
        label: "No puedo realizar el trabajo",
        icon: "briefcase-outline",
      },
      {
        value: "scheduling_issue",
        label: "Problema de coordinación",
        icon: "calendar-outline",
      },
      { value: "other", label: "Otro motivo", icon: "ellipsis-horizontal" },
    ];
  }

  return [
    {
      value: "client_changed_mind",
      label: "Ya no necesito el servicio",
      icon: "close-circle-outline",
    },
    {
      value: "scheduling_issue",
      label: "Problema de coordinación",
      icon: "calendar-outline",
    },
    {
      value: "provider_no_show",
      label: "El prestador no se presentó",
      icon: "person-remove-outline",
    },
    { value: "other", label: "Otro motivo", icon: "ellipsis-horizontal" },
  ];
}

function JobStatusBanner({
  status,
  onReview,
  onReviewClient,
  onReportIssue,
  reporting,
  onProposeVisit,
  onAcceptVisit,
  onRequestReschedule,
  onCancel,
  busy,
}) {
  const completed = status.job_status === "completed";
  const disputed = status.job_status === "disputed";
  const incidentClosed = ["resolved", "dismissed"].includes(
    status.incident_status,
  );
  const cancelled =
    status.job_status === "cancelled" || status.status === "refunded";
  const cancellationStatus =
    status.cancellation_status ?? "not_requested";
  const cancellationRejected = cancellationStatus === "review_rejected";
  const cancellationVisible = cancellationStatus !== "not_requested";
  const cancellationActive =
    cancellationVisible && !cancellationRejected && !cancelled;
  const cancellationReview = [
    "review_required",
    "refund_failed",
  ].includes(cancellationStatus);
  const amount = Number(status.amount_total ?? 0);
  const feeAmount = Number(status.commission_amount ?? 0);
  const refundAmount = Number(status.refund_amount ?? feeAmount);
  const clientTotal = Number(status.client_total ?? amount + feeAmount);
  const visitDate = status.visit_scheduled_for
    ? new Date(status.visit_scheduled_for).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return (
    <View
      style={[
        jobStyles.container,
        completed && jobStyles.containerCompleted,
        disputed && jobStyles.containerDisputed,
        cancelled && jobStyles.containerCancelled,
        cancellationReview && jobStyles.containerReview,
      ]}
    >
      <View
        style={[
          jobStyles.icon,
          (completed || cancelled) && jobStyles.iconCompleted,
          cancellationReview && jobStyles.iconReview,
        ]}
      >
        <Ionicons
          name={
            completed
              ? "checkmark-done"
              : disputed
                ? "alert-circle"
                : cancelled
                  ? "return-down-back"
                  : cancellationVisible
                    ? "receipt-outline"
                    : "shield-checkmark"
          }
          size={19}
          color="#fff"
        />
      </View>
      <View style={jobStyles.copy}>
        <Text style={jobStyles.eyebrow}>
          {completed
            ? "TRABAJO VERIFICADO"
            : disputed
              ? incidentClosed
                ? "RECLAMO REVISADO"
                : "RECLAMO EN REVISIÓN"
              : cancelled
                ? "RESERVA CANCELADA"
                : cancellationRejected
                  ? "SOLICITUD REVISADA"
                  : cancellationActive
                    ? "CANCELACIÓN REGISTRADA"
                    : "SERVICIO CONFIRMADO"}
        </Text>
        <Text style={jobStyles.title}>
          {completed
            ? "Trabajo terminado dentro de la app"
            : disputed
              ? `Caso ${status.incident_case_number ?? "abierto"} ${incidentClosed ? "cerrado por soporte" : "derivado a soporte"}`
              : cancelled
                ? "El cargo de reserva fue devuelto"
                : cancellationStatus === "refund_pending"
                  ? "Estamos procesando la devolución"
                  : cancellationReview
                    ? "El caso requiere revisión"
                    : cancellationRejected
                      ? "La reserva continúa activa"
                      : "El presupuesto quedó confirmado"}
        </Text>
        <Text style={jobStyles.text}>
          {amount > 0 ? `Presupuesto de ${formatQuoteAmount(amount)}. ` : ""}
          {completed
            ? status.is_payer
              ? status.rating
                ? `Calificación registrada: ${status.rating}/5.`
                : "El cierre quedó registrado."
              : status.client_rating
                ? `Tu calificación al cliente: ${status.client_rating}/5.`
                : status.client_review_count > 0
                  ? `Reputación del cliente: ${Number(status.client_average_rating).toFixed(1)}/5 en ${status.client_review_count} trabajo${status.client_review_count === 1 ? "" : "s"}.`
                  : "El cierre quedó registrado. Podés calificar la coordinación con el cliente."
            : disputed
              ? incidentClosed
                ? "La revisión humana finalizó. El pago conserva su historial y no se reembolsa automáticamente."
                : "MICA reunió el contexto y el equipo operativo puede tomar el caso desde su bandeja."
              : cancelled
                ? "Cliente y prestador pueden volver a conversar y generar una nueva propuesta."
                : cancellationReview
                  ? "La reserva quedó pausada hasta resolver la solicitud."
                  : cancellationStatus === "refund_pending"
                    ? "La reserva quedó pausada mientras Mercado Pago procesa el reintegro."
                    : cancellationRejected
                      ? "La devolución no fue aprobada. Pueden continuar coordinando la visita."
                      : status.is_payer
                        ? "Cuando finalice, cerralo y calificá al prestador."
                        : "El cliente podrá cerrarlo y calificar al finalizar."}
        </Text>

        {!completed ? (
          <View style={jobStyles.paymentSummary}>
            <View style={jobStyles.summaryRow}>
              <Text style={jobStyles.summaryLabel}>Trabajo al finalizar</Text>
              <Text style={jobStyles.summaryValue}>
                {formatQuoteAmount(amount)}
              </Text>
            </View>
            <View style={jobStyles.summaryRow}>
              <Text style={jobStyles.summaryLabel}>
                {cancelled ? "Reserva devuelta" : "Reserva pagada"}
              </Text>
              <Text style={jobStyles.summaryValue}>
                {formatQuoteAmount(cancelled ? refundAmount : feeAmount)}
              </Text>
            </View>
            <View style={jobStyles.summaryRow}>
              <Text style={jobStyles.summaryTotalLabel}>
                Costo total acordado
              </Text>
              <Text style={jobStyles.summaryTotalValue}>
                {formatQuoteAmount(clientTotal)}
              </Text>
            </View>
          </View>
        ) : null}
        {status.can_review_client ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onReviewClient}
            style={jobStyles.reviewButton}
          >
            <Ionicons name="star-outline" size={16} color="#fff" />
            <Text style={jobStyles.reviewButtonText}>Calificar al cliente</Text>
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
              {reporting
                ? "Abriendo reclamo..."
                : "¿No se presentó o hubo un problema?"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {cancellationVisible ? (
          <View
            style={[
              jobStyles.cancellationBox,
              cancelled && jobStyles.cancellationBoxRefunded,
            ]}
          >
            <View style={jobStyles.cancellationHeading}>
              <Ionicons
                name={
                  cancelled
                    ? "checkmark-circle"
                    : cancellationRejected
                      ? "close-circle-outline"
                      : "time-outline"
                }
                size={16}
                color={
                  cancelled
                    ? "#12815e"
                    : cancellationRejected
                      ? "#8b5a44"
                      : "#9a6117"
                }
              />
              <Text style={jobStyles.cancellationTitle}>
                {cancelled
                  ? "Devolución confirmada"
                  : cancellationStatus === "refund_pending"
                    ? "Devolución en proceso"
                    : cancellationRejected
                      ? "Devolución no aprobada"
                      : "Revisión pendiente"}
              </Text>
            </View>
            {status.cancellation_request_code ? (
              <Text style={jobStyles.cancellationCode}>
                Código: {status.cancellation_request_code}
              </Text>
            ) : null}
            <Text style={jobStyles.cancellationText}>
              {cancelled
                ? "La acreditación final depende de los tiempos del medio de pago."
                : cancellationStatus === "refund_failed"
                  ? "Mercado Pago no completó el reintegro automático; el caso quedó guardado."
                  : cancellationStatus === "review_required"
                    ? "ServiciosYa debe validar lo ocurrido antes de devolver el cargo."
                    : cancellationRejected
                      ? status.cancellation_resolution_note ||
                        "La reserva volvió a quedar activa."
                    : "No hace falta iniciar otra solicitud."}
            </Text>
          </View>
        ) : null}

        {!completed &&
        !disputed &&
        !cancellationActive &&
        status.visit_status ? (
          <View style={jobStyles.visitBox}>
            <View style={jobStyles.visitHeading}>
              <Ionicons name="calendar-outline" size={16} color="#047a8f" />
              <Text style={jobStyles.visitTitle}>Visita del prestador</Text>
            </View>
            {status.visit_status === "scheduled" ? (
              <Text style={jobStyles.visitText}>
                Confirmada para {visitDate}.
              </Text>
            ) : status.visit_status === "proposed" ? (
              <>
                <Text style={jobStyles.visitText}>
                  {status.is_payer
                    ? `El prestador propuso ${visitDate}.`
                    : `Fecha enviada: ${visitDate}. Esperando confirmación del cliente.`}
                </Text>
                {status.visit_note ? (
                  <Text style={jobStyles.visitNote}>{status.visit_note}</Text>
                ) : null}
                {status.is_payer ? (
                  <View style={jobStyles.visitActions}>
                    <TouchableOpacity
                      disabled={busy}
                      onPress={onAcceptVisit}
                      style={jobStyles.visitPrimaryButton}
                    >
                      <Text style={jobStyles.visitPrimaryText}>
                        Confirmar fecha
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={busy}
                      onPress={onRequestReschedule}
                      style={jobStyles.visitSecondaryButton}
                    >
                      <Text style={jobStyles.visitSecondaryText}>
                        Pedir otra
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : status.is_provider ? (
              <>
                <Text style={jobStyles.visitText}>
                  {status.visit_status === "reschedule_requested"
                    ? "El cliente pidió otra fecha. Enviá una nueva propuesta."
                    : "Proponé una fecha y hora para realizar la visita."}
                </Text>
                <TouchableOpacity
                  disabled={busy}
                  onPress={onProposeVisit}
                  style={jobStyles.visitPrimaryButton}
                >
                  <Text style={jobStyles.visitPrimaryText}>
                    {status.visit_status === "reschedule_requested"
                      ? "Proponer otra fecha"
                      : "Proponer fecha"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={jobStyles.visitText}>
                Esperando que el prestador proponga una fecha.
              </Text>
            )}
          </View>
        ) : null}

        <View style={jobStyles.footerActions}>
          {status.can_review ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={busy}
              onPress={onReview}
              style={jobStyles.reviewButton}
            >
              <Ionicons name="star-outline" size={16} color="#fff" />
              <Text style={jobStyles.reviewButtonText}>
                Finalizar y calificar
              </Text>
            </TouchableOpacity>
          ) : null}
          {status.can_cancel ? (
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={busy}
              onPress={onCancel}
              style={jobStyles.cancelButton}
            >
              <Ionicons name="close-circle-outline" size={15} color="#9a4c22" />
              <Text style={jobStyles.cancelButtonText}>
                Cancelar reserva
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
  containerCancelled: {
    borderColor: "#bde4d5",
    backgroundColor: "#edf9f4",
  },
  containerReview: {
    borderColor: "#e5c994",
    backgroundColor: "#fff8eb",
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
  iconReview: {
    backgroundColor: "#b56b18",
  },
  copy: { flex: 1 },
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
  paymentSummary: {
    marginTop: 9,
    padding: 9,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.72)",
    gap: 5,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  summaryLabel: { color: "#60777c", fontSize: 9.5, fontWeight: "700" },
  summaryValue: { color: "#284d54", fontSize: 10, fontWeight: "900" },
  summaryTotalLabel: { color: "#173f46", fontSize: 10, fontWeight: "900" },
  summaryTotalValue: { color: "#047a8f", fontSize: 11, fontWeight: "900" },
  cancellationBox: {
    marginTop: 9,
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#e5c994",
    backgroundColor: "#fffaf0",
  },
  cancellationBoxRefunded: {
    borderColor: "#bde4d5",
    backgroundColor: "#f2fbf7",
  },
  cancellationHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
  cancellationTitle: { color: "#324f54", fontSize: 11, fontWeight: "900" },
  cancellationCode: {
    marginTop: 6,
    color: "#1e4148",
    fontSize: 10,
    fontWeight: "900",
  },
  cancellationText: {
    marginTop: 4,
    color: "#60777c",
    fontSize: 9.5,
    lineHeight: 14,
  },
  visitBox: {
    marginTop: 9,
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#b9dfe5",
    backgroundColor: "#fff",
  },
  visitHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
  visitTitle: { color: "#1e4148", fontSize: 11, fontWeight: "900" },
  visitText: { marginTop: 5, color: "#587277", fontSize: 10, lineHeight: 14 },
  visitNote: {
    marginTop: 4,
    color: "#315a61",
    fontSize: 9.5,
    fontStyle: "italic",
  },
  visitActions: { flexDirection: "row", gap: 7, marginTop: 8 },
  visitPrimaryButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#047a8f",
  },
  visitPrimaryText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  visitSecondaryButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#80c7ce",
    backgroundColor: "#fff",
  },
  visitSecondaryText: { color: "#047a8f", fontSize: 10, fontWeight: "900" },
  footerActions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
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
  reviewButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  cancelButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ddb69d",
    backgroundColor: "#fff8f3",
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
  cancelButtonText: { color: "#9a4c22", fontSize: 10.5, fontWeight: "900" },
});

function ChatRules() {
  const rules = [
    {
      icon: "🔢",
      text: "No compartas teléfonos ni datos de contacto externos. Coordiná todo dentro del chat seguro.",
    },
    {
      icon: "💬",
      text: "Podés conversar, pedir aclaraciones o solicitar cambios antes de aceptar. Mantené toda la coordinación dentro de este chat.",
    },
    {
      icon: "💰",
      text: 'El prestador envía el monto con "Crear presupuesto". Al aceptar, el cliente paga el 10% de confirmación dentro de la app.',
    },
    {
      icon: "🤝",
      text: "Tratá con respeto a todos los usuarios. El lenguaje ofensivo puede resultar en una suspensión.",
    },
    {
      icon: "🔒",
      text: "No compartas contraseñas, datos bancarios ni información personal sensible.",
    },
    {
      icon: "⚠️",
      text: "Los acuerdos fuera de la plataforma no tienen cobertura ni garantía de ServiciosYa.",
    },
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFA13C",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
    marginLeft: 10,
    elevation: 2,
  },
  textoBotonInfo: {
    color: "#fff",
    fontWeight: "bold",
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
    marginTop: 2,
  },
  quotePriceLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 12,
  },
  quotePricingMode: {
    color: "#53747c",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  quotePaymentBreakdown: {
    marginTop: 10,
    padding: 11,
    borderRadius: 8,
    backgroundColor: "#eefaf8",
    borderWidth: 1,
    borderColor: "#c1e9e2",
  },
  quotePaymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  quotePaymentLabel: { flex: 1, color: "#5d7479", fontSize: 11, fontWeight: "700" },
  quotePaymentValue: { color: "#1d4148", fontSize: 12, fontWeight: "900" },
  quotePaymentTotalRow: { marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: "#cde7e2" },
  quotePaymentTotalLabel: { color: "#173f46", fontSize: 12, fontWeight: "900" },
  quotePaymentTotalValue: { color: "#047a8f", fontSize: 15, fontWeight: "900" },
  quotePaymentHint: { marginTop: 7, color: "#698084", fontSize: 9.5, lineHeight: 13.5 },
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
  quoteActions: { marginTop: 4, gap: 7 },
  requestChangesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#8ed6d0",
  },
  requestChangesText: { color: "#047a8f", fontSize: 12, fontWeight: "800" },
  legacyQuoteHint: {
    marginTop: 8,
    padding: 9,
    borderRadius: 8,
    color: "#7a5c20",
    backgroundColor: "#fff7df",
    fontSize: 10,
    lineHeight: 14,
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
  visitModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(14,34,38,0.58)",
  },
  visitModalCard: {
    width: "100%",
    maxWidth: 420,
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  visitModalHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },
  visitModalIcon: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#047a8f" },
  visitModalTitle: { color: "#173f46", fontSize: 17, fontWeight: "900" },
  visitModalHint: { marginTop: 2, color: "#71868a", fontSize: 10.5, lineHeight: 14 },
  visitFieldLabel: { marginTop: 8, marginBottom: 5, color: "#38515d", fontSize: 11, fontWeight: "900" },
  visitInput: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#b9deda", backgroundColor: "#f8fcfb", color: "#25464c", fontSize: 14, fontWeight: "700" },
  visitNoteInput: { minHeight: 76, paddingTop: 11 },
  visitSaveButton: { minHeight: 46, marginTop: 15, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#047a8f" },
  visitSaveText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  visitCancelButton: { minHeight: 40, marginTop: 5, alignItems: "center", justifyContent: "center" },
  visitCancelText: { color: "#66777a", fontSize: 13, fontWeight: "800" },
  cancellationModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(14,34,38,0.62)",
  },
  cancellationModalCard: {
    width: "100%",
    maxWidth: 440,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  cancellationModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 12,
  },
  cancellationModalIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#b56b18",
  },
  cancellationModalTitle: {
    color: "#173f46",
    fontSize: 17,
    fontWeight: "900",
  },
  cancellationModalHint: {
    marginTop: 2,
    color: "#71868a",
    fontSize: 10.5,
    lineHeight: 14,
  },
  cancellationFieldLabel: {
    marginTop: 8,
    marginBottom: 6,
    color: "#38515d",
    fontSize: 11,
    fontWeight: "900",
  },
  cancellationReasons: { gap: 7 },
  cancellationReasonButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#cfdddf",
    backgroundColor: "#f8fbfb",
  },
  cancellationReasonButtonSelected: {
    borderColor: "#b56b18",
    backgroundColor: "#b56b18",
  },
  cancellationReasonText: {
    color: "#526d72",
    fontSize: 11.5,
    fontWeight: "800",
  },
  cancellationReasonTextSelected: { color: "#fff" },
  cancellationDetailInput: {
    minHeight: 78,
    paddingHorizontal: 12,
    paddingTop: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#cfdddf",
    backgroundColor: "#f8fbfb",
    color: "#25464c",
    fontSize: 13,
  },
  cancellationPolicyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 11,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ead3a7",
    backgroundColor: "#fff9ee",
  },
  cancellationPolicyText: {
    flex: 1,
    color: "#795b32",
    fontSize: 9.5,
    lineHeight: 14,
  },
  cancellationSubmitButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#b14f27",
  },
  cancellationSubmitButtonDisabled: { opacity: 0.5 },
  cancellationSubmitText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  cancellationCloseButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  cancellationCloseText: {
    color: "#66777a",
    fontSize: 13,
    fontWeight: "800",
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  fechaChipContainer: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginVertical: 8,
    backgroundColor: "#E0F7FA", // color base del chip
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3, // para Android
    borderWidth: 1,
    borderColor: "#B2EBF2", // borde sutil
  },
  fechaChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00796B",
    textAlign: "center",
  },
});
