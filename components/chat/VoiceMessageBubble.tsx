import { Ionicons } from "@expo/vector-icons";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import {
  formatAudioDuration,
  type AudioMessagePayload,
} from "../../lib/utils/audioMessage";

interface VoiceMessageBubbleProps {
  chatId: string;
  message: AudioMessagePayload;
  isOwn: boolean;
  onEditTranscript?: () => void;
}

const WAVE_BARS = [
  { id: "wave-a", height: 0.36 },
  { id: "wave-b", height: 0.72 },
  { id: "wave-c", height: 0.5 },
  { id: "wave-d", height: 0.92 },
  { id: "wave-e", height: 0.62 },
  { id: "wave-f", height: 0.82 },
  { id: "wave-g", height: 0.44 },
  { id: "wave-h", height: 0.7 },
  { id: "wave-i", height: 0.38 },
  { id: "wave-j", height: 0.58 },
];

export default function VoiceMessageBubble({
  chatId,
  message,
  isOwn,
  onEditTranscript,
}: VoiceMessageBubbleProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(message.durationMs);
  const [showTranscript, setShowTranscript] = useState(
    Boolean(message.transcript),
  );

  useEffect(
    () => () => {
      soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    },
    [],
  );

  const handlePlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis);
    if (status.durationMillis) setDurationMs(status.durationMillis);

    if (status.didJustFinish) {
      setPositionMs(0);
      setIsPlaying(false);
    }
  };

  const getSignedUrl = async () => {
    const { data, error } = await supabase.functions.invoke<{
      signedUrl?: string;
      error?: string;
    }>("chat-audio", {
      body: {
        action: "signed-url",
        chatId,
        path: message.path,
      },
    });

    if (error || !data?.signedUrl) {
      throw new Error(
        data?.error || error?.message || "No se pudo abrir el audio.",
      );
    }

    return data.signedUrl;
  };

  const togglePlayback = async () => {
    if (loading) return;

    try {
      setLoading(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      if (!soundRef.current) {
        const signedUrl = await getSignedUrl();
        const { sound } = await Audio.Sound.createAsync(
          { uri: signedUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 200 },
          handlePlaybackStatus,
        );
        soundRef.current = sound;
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;

      if (
        status.didJustFinish ||
        status.positionMillis >= (status.durationMillis ?? 0)
      ) {
        await soundRef.current.replayAsync();
      } else if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      Alert.alert(
        "No se pudo reproducir",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  const progress = durationMs > 0 ? Math.min(positionMs / durationMs, 1) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.playerRow}>
        <TouchableOpacity
          accessibilityLabel={isPlaying ? "Pausar audio" : "Reproducir audio"}
          activeOpacity={0.78}
          onPress={togglePlayback}
          style={[
            styles.playButton,
            isOwn ? styles.playButtonOwn : styles.playButtonOther,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        <View style={styles.playerBody}>
          <View style={styles.waveRow}>
            {WAVE_BARS.map((bar, index) => (
              <View
                key={bar.id}
                style={[
                  styles.waveBar,
                  {
                    height: 8 + bar.height * 18,
                    opacity: index / 10 <= progress ? 1 : 0.42,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>
              {formatAudioDuration(isPlaying ? positionMs : durationMs)}
            </Text>
            <View style={styles.voiceBadge}>
              <Ionicons name="mic" size={11} color="#047a8f" />
              <Text style={styles.voiceBadgeText}>Audio</Text>
            </View>
          </View>
        </View>
      </View>

      {message.transcript ? (
        <View style={styles.transcriptArea}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setShowTranscript((current) => !current)}
            style={styles.transcriptToggle}
          >
            <Ionicons name="document-text-outline" size={15} color="#075f6f" />
            <Text style={styles.transcriptToggleText}>
              {showTranscript ? "Ocultar transcripción" : "Leer transcripción"}
            </Text>
            <Ionicons
              name={showTranscript ? "chevron-up" : "chevron-down"}
              size={15}
              color="#075f6f"
            />
          </TouchableOpacity>
          {showTranscript ? (
            <>
              <Text style={styles.transcriptText}>{message.transcript}</Text>
              <Text style={styles.transcriptHint}>
                Transcripción automática; puede contener errores.
              </Text>
              {onEditTranscript ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={onEditTranscript}
                  style={styles.editTranscriptButton}
                >
                  <Ionicons name="create-outline" size={14} color="#fff" />
                  <Text style={styles.editTranscriptText}>
                    Corregir transcripción
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}
        </View>
      ) : (
        <View>
          <Text style={styles.noTranscriptText}>
            Podés escuchar este audio desde el chat.
          </Text>
          {onEditTranscript ? (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onEditTranscript}
              style={styles.editTranscriptButton}
            >
              <Ionicons name="create-outline" size={14} color="#fff" />
              <Text style={styles.editTranscriptText}>
                Agregar transcripción
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 232,
    maxWidth: 310,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonOwn: {
    backgroundColor: "#087989",
  },
  playButtonOther: {
    backgroundColor: "#c46600",
  },
  playerBody: {
    flex: 1,
  },
  waveRow: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 11,
    fontWeight: "700",
  },
  voiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  voiceBadgeText: {
    color: "#075f6f",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  transcriptArea: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.35)",
  },
  transcriptToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  transcriptToggleText: {
    color: "#075f6f",
    fontSize: 11,
    fontWeight: "800",
  },
  transcriptText: {
    marginTop: 8,
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  transcriptHint: {
    marginTop: 5,
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    lineHeight: 14,
  },
  editTranscriptButton: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 3,
  },
  editTranscriptText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  noTranscriptText: {
    marginTop: 8,
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    lineHeight: 15,
  },
});
