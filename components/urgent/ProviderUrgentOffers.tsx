import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";

type UrgentOffer = {
  request_id: string;
  request_code: string;
  category: string;
  description: string;
  urgency_window: "now" | "today";
  city: string;
  province: string;
  expires_at: string;
};

export default function ProviderUrgentOffers() {
  const [offers, setOffers] = useState<UrgentOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("urgent-service", {
      body: { action: "provider-list" },
    });
    if (!error && !data?.error)
      setOffers((data?.requests ?? []) as UrgentOffer[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const respond = async (offer: UrgentOffer, interested: boolean) => {
    setRespondingId(offer.request_id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "urgent-service",
        {
          body: { action: "respond", requestId: offer.request_id, interested },
        },
      );
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setOffers((current) =>
        current.filter((item) => item.request_id !== offer.request_id),
      );
      if (interested)
        Alert.alert(
          "Respuesta enviada",
          "El cliente puede elegirte. Si lo hace, se abrirá el chat para conversar y presupuestar.",
        );
    } catch (error) {
      Alert.alert(
        "No se pudo responder",
        error instanceof Error ? error.message : "Intentá nuevamente.",
      );
      await load();
    } finally {
      setRespondingId(null);
    }
  };

  if (loading)
    return <ActivityIndicator color="#d97706" style={styles.loader} />;
  if (offers.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <MaterialIcons name="bolt" size={20} color="#b45309" />
        <View style={styles.copy}>
          <Text style={styles.title}>Pedidos urgentes cerca tuyo</Text>
          <Text style={styles.subtitle}>
            Solo aparecen mientras figurás conectado y disponible.
          </Text>
        </View>
      </View>
      {offers.map((offer) => {
        const responding = respondingId === offer.request_id;
        return (
          <View key={offer.request_id} style={styles.card}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{offer.request_code}</Text>
            </View>
            <Text style={styles.category}>{offer.category}</Text>
            <Text style={styles.description}>{offer.description}</Text>
            <Text style={styles.meta}>
              📍 {offer.city}, {offer.province} ·{" "}
              {offer.urgency_window === "now"
                ? "lo antes posible"
                : "durante el día"}
            </Text>
            {responding ? (
              <ActivityIndicator color="#d97706" style={styles.responding} />
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => void respond(offer, true)}
                  style={styles.acceptButton}
                >
                  <Text style={styles.acceptText}>Estoy disponible</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void respond(offer, false)}
                  style={styles.declineButton}
                >
                  <Text style={styles.declineText}>No puedo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: 12 },
  section: { marginBottom: 20 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  copy: { flex: 1 },
  title: { color: "#7c4300", fontSize: 16, fontWeight: "900" },
  subtitle: { color: "#806849", fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: "#fff7e8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1c071",
    padding: 15,
    marginBottom: 10,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#d97706",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  category: { color: "#4c3520", fontSize: 15, fontWeight: "900", marginTop: 9 },
  description: { color: "#5f4b38", fontSize: 13, lineHeight: 19, marginTop: 5 },
  meta: { color: "#7a654f", fontSize: 11, marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 13 },
  acceptButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#12815e",
  },
  acceptText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  declineButton: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d4b998",
  },
  declineText: { color: "#775a3b", fontSize: 12, fontWeight: "800" },
  responding: { marginTop: 13 },
});
