import { useIsFocused } from "@react-navigation/native";
import React, {
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { withModalProvider } from "../components/sheet/withModalProvider";
import { AuthContext } from "../lib/context/AppContext";

import { useHomeData } from "../lib/hooks/useHomeData";

import HomeHeader from "../components/HomeHeader";
// Refactored Components
import BottomNavBar from "../components/home/BottomNavBar";
import CategoryList from "../components/home/CategoryList";
import { DniPendingWarning } from "../components/home/DniPendingWarning";
import { ProfileIncompleteWarning } from "../components/home/ProfileIncompleteWarning";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import FloatingActionButtonMenu from "../components/FloatingActionButtonMenu";
import SideQuickAccessMenu from "../components/SideQuickAccessMenu";
import { withDropDownProvider } from "../components/forms/withDropDownProvider";
import { HomeEventRenderer } from "../components/home/HomeEventRenderer";
import WorkerHomeView from "../components/home/WorkerHomeView";
import usePrefetchData from "../lib/hooks/usePrefetchData";
import vexo from "../lib/vexo";
import { useIsGuest } from "../store/authStore";
import { useHomeEventsStore } from "../store/homeEventsStore";
import type { MainStackParamList } from "../types/navigation";
import type { MicaChatMode } from "../types/navigation";

type Props = NativeStackScreenProps<MainStackParamList, "Home">;

function Home({ navigation, route }: Props) {
  usePrefetchData();
  const [busqueda, setBusqueda] = useState("");
  const isGuest = useIsGuest();
  const {
    askDniVerification,
    askProfileCompletion,
    askProviderProfileCompletion,
    providerProfileScore,
    providerMissingFields,
    rol,
    profileLoading,
    profileIsError,
    profileError,
    refetchProfile,
  } = useHomeData();
  const isWorker = rol === "worker";
  const isFocused = useIsFocused();
  const { setHomeVisible, setHomeDataReady } = useHomeEventsStore();

  // Notifications & Messages
  const { unreadMessagesCount } = useContext(AuthContext);

  const handleCategoryPress = (categoria: string) => {
    if (isGuest) {
      return;
    }

    vexo.marketplace("category_opened", { categoria });

    navigation.navigate("ServiciosPorCategoria", { categoria });
  };

  const handleMicaModePress = (mode: MicaChatMode) => {
    navigation.navigate("MicaChat", { mode });
  };

  useEffect(() => {
    setHomeVisible(isFocused);
    if (!isFocused) {
      setHomeDataReady(false);
    }
  }, [isFocused, setHomeVisible, setHomeDataReady]);

  const isUserRestricted = askDniVerification || askProfileCompletion;

  if (!isGuest && profileLoading) {
    return (
      <View style={styles.profileState}>
        <ActivityIndicator size="large" color="#069eb3" />
        <Text style={styles.profileStateText}>Cargando tu perfil…</Text>
      </View>
    );
  }

  if (!isGuest && profileIsError) {
    return (
      <View style={styles.profileState}>
        <Text style={styles.profileStateTitle}>No pudimos cargar tu perfil</Text>
        <Text style={styles.profileStateText}>
          {profileError instanceof Error
            ? profileError.message
            : "Revisá tu conexión e intentá nuevamente."}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => void refetchProfile()}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <HomeEventRenderer />
      <View style={styles.container}>
        <HomeHeader
          onSearch={setBusqueda}
          publishLabel={isWorker ? "Publicar servicio" : "Publicar trabajo"}
          onRequestsPress={
            !isWorker
              ? () =>
                  navigation.navigate("PublicarNecesidad", {
                    view: "history",
                  })
              : undefined
          }
          onPublishPress={() =>
            isWorker
              ? navigation.navigate("OfrecerServicio")
              : navigation.navigate("PublicarNecesidad", { view: "new" })
          }
        />

        {!isGuest &&
          (isWorker ? askProviderProfileCompletion : askProfileCompletion) && (
            <ProfileIncompleteWarning
              isProvider={isWorker}
              score={providerProfileScore}
              missingFields={providerMissingFields}
              onPress={() =>
                navigation.navigate(isWorker ? "Perfil" : "CrearPerfil")
              }
            />
          )}

        {!isGuest && askDniVerification && <DniPendingWarning />}

        {isWorker ? (
          <WorkerHomeView
            navigation={navigation}
            onCategoryPress={handleCategoryPress}
            busqueda={busqueda}
            initialTab={route.params?.workerTab}
          />
        ) : (
          <CategoryList
            busqueda={busqueda}
            onCategoryPress={handleCategoryPress}
            isUserRestricted={isUserRestricted}
          />
        )}

        {!isWorker && (
          <FloatingActionButtonMenu
            onHelpPress={() => navigation.navigate("Configuracion")}
            onChatPress={() => handleMicaModePress("buscar-servicio")}
          />
        )}

        <SideQuickAccessMenu
          onPublicarNecesidadPress={
            !isWorker
              ? () => navigation.navigate("PublicarNecesidad", { view: "new" })
              : undefined
          }
          onBuscarServicioPress={
            !isWorker ? () => handleMicaModePress("buscar-servicio") : undefined
          }
          onOfrecerServicioPress={
            isWorker ? () => navigation.navigate("OfrecerServicio") : undefined
          }
        />
      </View>

      <BottomNavBar
        unreadMessagesCount={unreadMessagesCount}
        isWorker={isWorker}
      />
    </SafeAreaView>
  );
}

export default withDropDownProvider(withModalProvider(Home));

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f2f5" },
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  profileState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f0fafa",
  },
  profileStateTitle: { color: "#174f59", fontSize: 20, fontWeight: "800" },
  profileStateText: {
    color: "#52666a",
    fontSize: 15,
    marginTop: 12,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: "#069eb3",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
