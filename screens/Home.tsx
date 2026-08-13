import React, {
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  View,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { withModalProvider } from "../components/sheet/withModalProvider";
import { AuthContext } from "../lib/context/AppContext";

// Custom Hooks
import { useUserSettings } from "../lib/hooks/useUserSettings";
import { useOnboarding } from "../lib/hooks/useOnboarding";
import { useHomeData } from "../lib/hooks/useHomeData";

// Refactored Components
import BottomNavBar from "../components/home/BottomNavBar";
import CategoryList from "../components/home/CategoryList";
import { ProfileIncompleteWarning } from "../components/home/ProfileIncompleteWarning";
import { DniPendingWarning } from "../components/home/DniPendingWarning";
import HomeHeader from "../components/HomeHeader";
import ChatBotModal from "../components/ChatBotModal";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../types/navigation";
import FloatingActionButtonMenu from "../components/FloatingActionButtonMenu";
import SideQuickAccessMenu from "../components/SideQuickAccessMenu";
import { withDropDownProvider } from "../components/forms/withDropDownProvider";
import { getUserID, useIsGuest } from "../store/authStore";
import { HomeEventRenderer } from "../components/home/HomeEventRenderer";
import { useHomeEventsStore } from "../store/homeEventsStore";
import usePrefetchData from "../lib/hooks/usePrefetchData";
import WorkerHomeView from "../components/home/WorkerHomeView";
import type { MicaChatMode } from "../types/navigation";
import vexo from "../lib/vexo";

type Props = NativeStackScreenProps<MainStackParamList, "Home">;

function Home({ navigation }: Props) {
  usePrefetchData();
  const [authUser, setAuthUser] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [showCountsOnly, setShowCountsOnly] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const onboardingShown = useRef(false);
  const isGuest = useIsGuest()
  // Custom Hooks
  const { startOnboarding } = useOnboarding();
  const { settings, updateSettings } = useUserSettings();
  const {
    askDniVerification,
    askProfileCompletion,
    rol,
  } = useHomeData();
  const isWorker = rol === "worker";
  const isFocused = useIsFocused();
  const { setHomeVisible, setHomeDataReady } = useHomeEventsStore();

  // Notifications & Messages
  const { unreadMessagesCount } = useContext(AuthContext);

  useFocusEffect(
    useCallback(() => {
      if (!onboardingShown.current && settings && !settings.onBoardingComplete) {
        onboardingShown.current = true;
        startOnboarding((results) =>
          updateSettings({
            useBiometric: results.useBiometric,
            onBoardingComplete: true,
          }),
        );
      }
    }, [settings]),
  );

  const handleCategoryPress = (categoria: string) => {
    if (isGuest) {
      return;
    }

    vexo.marketplace("category_opened", { categoria });

    // Registrar evento
    fetch("https://insightpulse.store/api/registrar_evento.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_evento: "categoria_visitada",
        datos: { usuario_id: getUserID(), categoria }
      })
    }).catch(() => {});

    navigation.navigate("ServiciosPorCategoria", { categoria });
  };

  const handleMicaModePress = (mode: MicaChatMode) => {
    navigation.navigate("MicaChat", { mode });
  };


  useEffect(() => {
    const registrarActividad = async () => {
      try {
        const response = await fetch("https://insightpulse.store/api/registrar_evento.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo_evento: "actividad",
            datos: {
              usuario_id: getUserID()
            }
          })
        });
      } catch (error) {
        console.error("Error al registrar actividad:", error);
      }
    };

    registrarActividad();
  }, []);

  useEffect(() => {
    setHomeVisible(isFocused);
    if (!isFocused) {
      setHomeDataReady(false);
    }
  }, [isFocused, setHomeVisible, setHomeDataReady]);

  const isUserRestricted = askDniVerification || askProfileCompletion;

  return (
    <SafeAreaView style={styles.safeArea}>
        <HomeEventRenderer />
        <View style={styles.container}>
          <HomeHeader
            onSearch={setBusqueda}
            onShowCountsOnlyChange={(value) => setShowCountsOnly(value)}
          />

          {authUser && askProfileCompletion && (
            <ProfileIncompleteWarning
              onPress={() => navigation.navigate("CrearPerfil")}
            />
          )}

          {authUser && askDniVerification && <DniPendingWarning />}

          {isWorker ? (
            <WorkerHomeView navigation={navigation} onCategoryPress={handleCategoryPress} busqueda={busqueda} />
          ) : (
            <CategoryList
              busqueda={busqueda}
              onCategoryPress={handleCategoryPress}
              isUserRestricted={isUserRestricted}
            />
          )}

          {!isWorker && (
            <FloatingActionButtonMenu
              onHelpPress={() => setVideoVisible(true)}
              onChatPress={() => setChatVisible(true)}
            />
          )}

          <SideQuickAccessMenu
            onPublicarNecesidadPress={
              !isWorker ? () => navigation.navigate("PublicarNecesidad") : undefined
            }
            onBuscarServicioPress={() => handleMicaModePress("buscar-servicio")}
            onOfrecerServicioPress={() => handleMicaModePress("ofrecer-servicio")}
          />
          <ChatBotModal
            visible={chatVisible}
            onClose={() => setChatVisible(false)}
          />
        </View>

      <BottomNavBar unreadMessagesCount={unreadMessagesCount} />
    </SafeAreaView>
  );
}

export default withDropDownProvider(
  withModalProvider(Home),
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f2f5" },
  container: { flex: 1, backgroundColor: "#f0f2f5" },
});
