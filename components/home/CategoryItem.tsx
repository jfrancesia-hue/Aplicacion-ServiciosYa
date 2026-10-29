import React, { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { iconosCategoria } from "../../lib/utils/categorias";

const fallbackIcon = require("../../assets/serviciosya-logo-2026.png");

const capitalize = (value: string) => {
  const text = value.trim();
  return text.length === 0
    ? text
    : text.charAt(0).toUpperCase() + text.slice(1);
};

interface CategoryIconProps {
  categoria: string;
  iconoUrl?: string | null;
  width?: number;
  height?: number;
}

export const CategoryIcon = ({
  categoria,
  iconoUrl,
  width = 155,
  height = 100,
}: CategoryIconProps) => {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const remote = iconoUrl && !remoteFailed ? { uri: iconoUrl } : null;
  const localIcons = iconosCategoria as Record<string, number>;
  const source = remote ?? localIcons[categoria] ?? fallbackIcon;

  return (
    <View renderToHardwareTextureAndroid>
      <Image
        source={source}
        style={[styles.iconImage, { width, height }]}
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
  width?: number;
}

export const CategoryItem = ({
  categoria,
  count,
  onPress,
  disabled,
  iconoUrl,
  width = 155,
}: CategoryItemProps) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={`${capitalize(categoria)}. ${
      count > 0
        ? `${count} profesional${count !== 1 ? "es" : ""}`
        : "Aún no hay profesionales"
    }`}
    accessibilityState={{ disabled: Boolean(disabled) }}
    style={[styles.container, { width }, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
  >
    <View style={[styles.iconContainer, { width }]}>
      <CategoryIcon categoria={categoria} iconoUrl={iconoUrl} width={width} />
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.name} numberOfLines={3} ellipsizeMode="tail">
        {capitalize(categoria)}
      </Text>
      {count > 0 ? (
        <Text style={styles.count} numberOfLines={1}>
          {count} profesional{count !== 1 ? "es" : ""}
        </Text>
      ) : (
        <Text style={styles.countEmpty} numberOfLines={2}>
          Aún no hay{"\n"}profesionales
        </Text>
      )}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dcebed",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    minHeight: 188,
    paddingBottom: 8,
    overflow: "hidden",
  },
  disabled: { opacity: 0.6 },
  iconContainer: {
    marginBottom: 8,
    height: 100,
  },
  iconImage: {
    resizeMode: "cover",
    borderRadius: 16,
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
    fontSize: 13,
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
    color: "#777",
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
});
