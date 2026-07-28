import React, { useState } from "react";
import { Text, TouchableOpacity, StyleSheet, Image, View } from "react-native";
import { iconosCategoria } from "../../lib/utils/categorias";

const fallbackIcon = require("../../assets/serviciosya-logo-2026.png");

const capitalize = (s: string) => {
  const t = s.trim();
  return t.length === 0 ? t : t.charAt(0).toUpperCase() + t.slice(1);
};

interface CategoryIconProps {
  categoria: string;
  iconoUrl?: string | null;
}

export const CategoryIcon = ({ categoria, iconoUrl }: CategoryIconProps) => {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const remote = iconoUrl && !remoteFailed ? { uri: iconoUrl } : null;
  const localIcons = iconosCategoria as Record<string, number>;
  const source = remote ?? localIcons[categoria] ?? fallbackIcon;
  return (
    <View renderToHardwareTextureAndroid>
      <Image
        source={source}
        style={styles.iconImage}
        fadeDuration={0}
        onError={() => setRemoteFailed(true)}
      />
    </View>
  );
};

interface CategoryItemProps {
  categoria: string;
  count: number;
  onPress: () => void;
  disabled?: boolean;
  iconoUrl?: string | null;
}

export const CategoryItem = ({
  categoria,
  count,
  onPress,
  disabled,
  iconoUrl,
}: CategoryItemProps) => (
  <TouchableOpacity
    style={[styles.container, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
  >
    <View style={styles.iconContainer}>
      <CategoryIcon categoria={categoria} iconoUrl={iconoUrl} />
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.name} numberOfLines={3} ellipsizeMode="tail">
        {capitalize(categoria)}
      </Text>
      {count > 0
        ? <Text style={styles.count} numberOfLines={1}>{count} profesional{count !== 1 ? "es" : ""}</Text>
        : <Text style={styles.countEmpty} numberOfLines={2}>Aún no hay{"\n"}profesionales</Text>
      }
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    marginRight: 12,
    marginVertical: 8,
    width: 155,
    minHeight: 200,
    paddingBottom: 8,
    overflow: "hidden",
  },
  disabled: { opacity: 0.6 },
  iconContainer: {
    marginBottom: 8,
    width: 155,
    height: 100,
  },
  iconImage: {
    width: 155,
    height: 100,
    resizeMode: "cover",
    borderRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  textContainer: {
    width: "100%",
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  name: {
    fontSize: 12,
    textAlign: "center",
    color: "#333",
    fontWeight: "700",
    marginBottom: 2,
    width: "100%",
  },
  count: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
  },
  countEmpty: {
    fontSize: 10,
    color: "#aaa",
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
});
