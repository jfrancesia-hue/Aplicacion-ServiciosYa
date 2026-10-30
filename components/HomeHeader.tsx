import { Ionicons } from "@expo/vector-icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { Suspense } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMainNavigation } from "../lib/hooks/useNavigation";
import { perfilQueryOptions } from "../lib/queryOptions";
import { useIsGuest } from "../store/authStore";
import { useNotificationStore } from "../store/notificationStore";
import OptionsButton from "./home/OptionsButton";
import LocationChip from "./location/LocationChip";

interface HomeHeaderProps {
  onSearch: (query: string) => void;
  onPublishPress: () => void;
  onRequestsPress?: () => void;
  publishLabel: string;
}

function HomeHeader({
  onSearch,
  onPublishPress,
  onRequestsPress,
  publishLabel,
}: HomeHeaderProps) {
  const navigation = useMainNavigation();
  const notificationsCount = useNotificationStore((state) => state.unreadCount);
  const isGuest = useIsGuest();
  const [busqueda, setBusqueda] = useState("");

  const handleGuestProfileClick = React.useCallback(() => {
    Alert.alert("Acceso restringido", "Registrate para acceder a tu perfil.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Registrarme",
        onPress: () =>
          navigation.navigate("AuthStack", { screen: "LoginSelect" }),
      },
    ]);
  }, [navigation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(busqueda.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [busqueda, onSearch]);

  return (
    <LinearGradient colors={["#069eb3", "#047a8f"]} style={styles.header}>
      <View style={styles.container}>
        <View style={styles.headerTop}>
          <View style={styles.logoAndTextContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={require("../assets/logo2.png")}
                style={styles.headerLogo}
              />
            </View>
            <View style={styles.saludoContainer}>
              <Text style={styles.brandName}>Servicios Ya</Text>
              <Text style={styles.subtitulo}>¿Qué necesitás hoy?</Text>
            </View>
          </View>

          <View style={styles.iconsContainer}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Ver notificaciones"
              onPress={() => navigation.navigate("NotificacionesScreen")}
              style={styles.iconButton}
            >
              <Ionicons name="notifications-outline" size={26} color="#fff" />
              {notificationsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationsCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {isGuest ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Iniciar sesión o registrarme"
                onPress={handleGuestProfileClick}
                style={styles.iconButton}
              >
                <Ionicons name="person-circle-outline" size={36} color="#fff" />
              </TouchableOpacity>
            ) : (
              <Suspense
                fallback={
                  <View style={styles.iconButton}>
                    <Ionicons
                      name="person-circle-outline"
                      size={36}
                      color="#fff"
                    />
                  </View>
                }
              >
                <ProfileAvatar />
              </Suspense>
            )}
          </View>
        </View>

        <View style={[styles.filtroContainer, styles.locationContainer]}>
          <LocationChip />
        </View>

        <View style={styles.searchBarContainer}>
          <View style={styles.buscadorContainer}>
            <Ionicons
              name="search"
              size={22}
              color="#333"
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Buscar categoría..."
              placeholderTextColor="#333"
              style={styles.buscador}
              value={busqueda}
              onChangeText={setBusqueda}
            />
          </View>
          <OptionsButton />
        </View>

        {!isGuest && (
          <View style={styles.requestActions}>
            {onRequestsPress ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Ver mis búsquedas"
                activeOpacity={0.85}
                onPress={onRequestsPress}
                style={styles.requestsButton}
              >
                <Ionicons name="documents-outline" size={19} color="#fff" />
                <Text style={styles.requestsButtonText}>Mis búsquedas</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={publishLabel}
              activeOpacity={0.85}
              onPress={onPublishPress}
              style={styles.publishButton}
            >
              <View style={styles.publishButtonCopy}>
                <Ionicons name="megaphone-outline" size={20} color="#fff" />
                <Text style={styles.publishButtonText}>{publishLabel}</Text>
              </View>
              <View style={styles.publishButtonIcon}>
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </LinearGradient>
  );
}

export default HomeHeader;

function ProfileAvatar() {
  const navigation = useMainNavigation();
  const { data: perfil } = useSuspenseQuery(perfilQueryOptions);

  const handlePress = React.useCallback(() => {
    if (!perfil?.perfil_completo) {
      Alert.alert(
        "Perfil incompleto",
        "Completá tu perfil antes de continuar.",
        [{ text: "OK" }],
      );
      return;
    }
    navigation.navigate("Perfil");
  }, [perfil?.perfil_completo, navigation]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Abrir mi perfil"
      onPress={handlePress}
      style={styles.iconButton}
    >
      {perfil?.foto_perfil ? (
        <Image source={{ uri: perfil.foto_perfil }} style={styles2.avatar} />
      ) : (
        <Ionicons name="person-circle-outline" size={36} color="#fff" />
      )}
    </TouchableOpacity>
  );
}

const styles2 = StyleSheet.create({
  iconButton: {
    marginLeft: 12,
    minWidth: 44,
    minHeight: 44,
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
});

const styles = StyleSheet.create({
  header: {
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  container: {
    marginHorizontal: 15,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoAndTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#050505",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerLogo: {
    width: 47,
    height: 47,
    resizeMode: "contain",
  },
  saludoContainer: {
    flex: 1,
  },
  brandName: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  serviciosYa: {
    color: "#f0f0f0",
    fontSize: 18,
    fontWeight: "600",
  },
  subtitulo: {
    color: "#d1faff",
    fontSize: 14,
    marginTop: 2,
    fontWeight: "400",
  },
  iconsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  buscadorContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buscador: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: "#333",
    paddingVertical: 0,
  },
  searchIcon: {
    marginLeft: 4,
    color: "#555",
  },
  filtroContainer: {
    flexDirection: "row",
    gap: 8,
  },
  locationContainer: {
    marginVertical: 10,
  },
  filtroColumn: {
    flex: 1,
  },
  iconButton: {
    marginLeft: 12,
    padding: 6,
    position: "relative",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  badge: {
    backgroundColor: "#ff5b5b",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
    marginLeft: 3,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  publishButton: {
    flex: 1.2,
    minHeight: 50,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 25,
    backgroundColor: "rgba(0, 0, 0, 0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requestsButton: {
    flex: 0.8,
    minHeight: 50,
    borderRadius: 25,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  requestsButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  publishButtonCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  publishButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  publishButtonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});
