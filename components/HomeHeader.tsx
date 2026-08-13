import React, { useEffect, useState } from "react";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Text,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { Suspense } from "react";
import LocationChip from "./location/LocationChip";
import { Ionicons } from "@expo/vector-icons";
import { useMainNavigation } from "../lib/hooks/useNavigation";
import OptionsButton from "./home/OptionsButton";
import WorkerState from "./home/WorkerState";
import OnlineFilterCheckBox from "./home/OnlineFilterCheckBox";
import ProgressChip from "./home/ProgressChip";
import { useIsGuest } from "../store/authStore";
import { useNotificationStore } from "../store/notificationStore";
import { useSuspenseQuery } from "@tanstack/react-query";
import { perfilQueryOptions } from "../lib/queryOptions";
import { LinearGradient } from "expo-linear-gradient";

interface HomeHeaderProps {
  onSearch: (query: string) => void;
  onShowCountsOnlyChange: (value: boolean) => void;
}

function HomeHeader({ onSearch, onShowCountsOnlyChange }: HomeHeaderProps) {
  const navigation = useMainNavigation();
  const notificationsCount = useNotificationStore((state) => state.unreadCount);
  const isGuest = useIsGuest();
  const [busqueda, setBusqueda] = useState("");

  const handleGuestProfileClick = React.useCallback(() => {
    Alert.alert(
      "Acceso restringido",
      "Debes registrarte para acceder a tu perfil.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Registrarme",
          onPress: () => navigation.navigate("AuthStack", { screen: "LoginSelect" }),
        },
      ]
    );
  }, [navigation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(busqueda.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [busqueda, onSearch]);

  return (
    <LinearGradient
      colors={["#069eb3", "#047a8f"]}
      style={styles.header}
    >
      <View style={styles.container}>
        <View style={styles.headerTop}>
          <View style={styles.logoAndTextContainer}>
            <Image
              source={require("../assets/serviciosya-logo-2026.png")}
              style={styles.headerLogo}
            />
            <View style={styles.saludoContainer}>
              <Text style={styles.brandName}>Servicios Ya</Text>
              <Text style={styles.subtitulo}>¿Qué necesitás hoy?</Text>
            </View>
          </View>

          <View style={styles.iconsContainer}>
            <TouchableOpacity
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
                onPress={handleGuestProfileClick}
                style={styles.iconButton}
              >
                <Ionicons name="person-circle-outline" size={36} color="#fff" />
              </TouchableOpacity>
            ) : (
              <Suspense
                fallback={
                  <View style={styles.iconButton}>
                    <Ionicons name="person-circle-outline" size={36} color="#fff" />
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
            <Ionicons name="search" size={22} color="#333" style={styles.searchIcon} />
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
          <GuestContent onShowCountsOnlyChange={onShowCountsOnlyChange} />
        )}
      </View>
    </LinearGradient>
  );
}

const GuestContent = React.memo(
  ({ onShowCountsOnlyChange }: { onShowCountsOnlyChange: (value: boolean) => void }) => {
    const [soloConServicios, setSoloConServicios] = useState(false);

    useEffect(() => {
      onShowCountsOnlyChange(soloConServicios);
    }, [soloConServicios, onShowCountsOnlyChange]);

    return (
      <>
        {/* Botones "Servicios Online" y "Actualizar Disponibilidad" ocultos */}
        {/* <View style={styles.filtroContainer}>
          <OnlineFilterCheckBox style={styles.filtroColumn} />
          <WorkerState style={styles.filtroColumn} />
        </View> */}
        <ProgressChip label="Mis Logros" />
      </>
    );
  }
);

export default HomeHeader;


function ProfileAvatar() {
  const navigation = useMainNavigation();
  const { data: perfil } = useSuspenseQuery(perfilQueryOptions);

  const handlePress = React.useCallback(() => {
    if (!perfil?.perfil_completo) {
      Alert.alert("Perfil incompleto", "Completa tu perfil antes de continuar.", [
        { text: "OK" },
      ]);
      return;
    }
    navigation.navigate("Perfil");
  }, [perfil?.perfil_completo, navigation]);

  return (
    <TouchableOpacity onPress={handlePress} style={styles.iconButton}>
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
    padding: 6,
    position: "relative",
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
  headerLogo: {
    width: 50,
    height: 50,
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
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ff5b5b",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
});
