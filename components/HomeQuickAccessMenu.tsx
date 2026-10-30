import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface QuickAccessAction {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
}

interface HomeQuickAccessMenuProps {
  onPublishRequest: () => void;
  onSearchWithMica: () => void;
  onOfferService?: () => void;
  offerServiceLabel?: string;
}

export default function HomeQuickAccessMenu({
  onPublishRequest,
  onSearchWithMica,
  onOfferService,
  offerServiceLabel = "Publicar un servicio",
}: HomeQuickAccessMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = useMemo<QuickAccessAction[]>(
    () => [
      {
        label: "Publicar necesidad",
        description: "Recibí propuestas de prestadores",
        icon: "megaphone-outline",
        accent: "#07899d",
        onPress: onPublishRequest,
      },
      {
        label: "Buscar servicio con MICA",
        description: "Contale qué necesitás y dónde",
        icon: "sparkles",
        accent: "#fe971a",
        onPress: onSearchWithMica,
      },
      ...(onOfferService
        ? [
            {
              label: offerServiceLabel,
              description: "Mostrá tu trabajo a nuevos clientes",
              icon: "briefcase-outline" as const,
              accent: "#315e67",
              onPress: onOfferService,
            },
          ]
        : []),
    ],
    [
      offerServiceLabel,
      onOfferService,
      onPublishRequest,
      onSearchWithMica,
    ],
  );

  const runAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <View style={styles.dock}>
      {isOpen ? (
        <View style={styles.panel} accessibilityLabel="Accesos rápidos">
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelEyebrow}>MICA</Text>
              <Text style={styles.panelTitle}>¿Qué querés hacer?</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cerrar accesos rápidos"
              onPress={() => setIsOpen(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color="#315e67" />
            </TouchableOpacity>
          </View>

          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={`${action.label}. ${action.description}`}
              activeOpacity={0.86}
              onPress={() => runAction(action.onPress)}
              style={styles.action}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: action.accent },
                ]}
              >
                <Ionicons name={action.icon} size={21} color="#fff" />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionDescription} numberOfLines={1}>
                  {action.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#5c7479" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.triggerRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Abrir accesos rápidos de MICA"
          accessibilityState={{ expanded: isOpen }}
          activeOpacity={0.88}
          onPress={() => setIsOpen((current) => !current)}
          style={styles.micaTrigger}
        >
          <View style={styles.micaCopy}>
            <Text style={styles.micaName}>MICA</Text>
            <Text style={styles.micaHint}>Empezá por acá</Text>
          </View>
          <View style={styles.plusButton}>
            <Ionicons name={isOpen ? "close" : "add"} size={30} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: "#f4f8f8",
  },
  panel: {
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#c7dadd",
    backgroundColor: "#fff",
    padding: 10,
    elevation: 7,
    shadowColor: "#06333a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  panelHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  panelEyebrow: {
    color: "#069eb3",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  panelTitle: {
    color: "#174f59",
    fontSize: 17,
    fontWeight: "900",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edfafa",
  },
  action: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 8,
    marginTop: 6,
    backgroundColor: "#f6fbfb",
    borderWidth: 1,
    borderColor: "#dcebed",
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1 },
  actionLabel: {
    color: "#174f59",
    fontSize: 14,
    fontWeight: "900",
  },
  actionDescription: {
    color: "#61787d",
    fontSize: 11,
    marginTop: 2,
  },
  triggerRow: { alignItems: "flex-end" },
  micaTrigger: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 30,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#9ed8df",
    paddingLeft: 16,
    paddingRight: 4,
    elevation: 6,
    shadowColor: "#06333a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
  },
  micaCopy: { alignItems: "flex-end", marginRight: 10 },
  micaName: { color: "#069eb3", fontSize: 15, fontWeight: "900" },
  micaHint: {
    color: "#52666a",
    fontSize: 11,
    fontWeight: "700",
  },
  plusButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#069eb3",
  },
});
