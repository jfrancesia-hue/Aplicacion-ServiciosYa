import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import React, {
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { withModalProvider } from "../components/sheet/withModalProvider";
import { AuthContext } from "../lib/context/AppContext";

import { useHomeData } from "../lib/hooks/useHomeData";
import { useOnboarding } from "../lib/hooks/useOnboarding";
// Custom Hooks
import { useUserSettings } from "../lib/hooks/useUserSettings";

import ChatBotModal from "../components/ChatBotModal";
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
import { getUserID, useIsGuest } from "../store/authStore";
import { useHomeEventsStore } from "../store/homeEventsStore";
import type { MainStackParamList } from "../types/navigation";
import type { MicaChatMode } from "../types/navigation";

type Props = NativeStackScreenProps<MainStackParamList, "Home">;

function Home({ navigation, route }: Props) {
  usePrefetchData();
  const [busqueda, setBusqueda] = useState("");
  const [chatVisible, setChatVisible] = useState(false);
  const onboardingShown = useRef(false);
  const isGuest = useIsGuest();
  // Custom Hooks
  const { startOnboarding } = useOnboarding();
  const { settings, updateSettings } = useUserSettings();
  const {
    askDniVerification,
    askProfileCompletion,
    askProviderProfileCompletion,
    providerProfileScore,
    providerMissingFields,
    rol,
  } = useHomeData();
  const isWorker = rol === "worker";
  const isFocused = useIsFocused();
  const { setHomeVisible, setHomeDataReady } = useHomeEventsStore();

  // Notifications & Messages
  const { unreadMessagesCount } = useContext(AuthContext);

  useFocusEffect(
    useCallback(() => {
      if (
        !onboardingShown.current &&
        settings &&
        !settings.onBoardingComplete
      ) {
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
        datos: { usuario_id: getUserID(), categoria },
      }),
    }).catch(() => {});

    navigation.navigate("ServiciosPorCategoria", { categoria });
  };

  const handleMicaModePress = (mode: MicaChatMode) => {
    navigation.navigate("MicaChat", { mode });
  };

  useEffect(() => {
    const registrarActividad = async () => {
      try {
        const response = await fetch(
          "https://insightpulse.store/api/registrar_evento.php",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo_evento: "actividad",
              datos: {
                usuario_id: getUserID(),
              },
            }),
          },
        );
      } catch {
        // La telemetría heredada no debe afectar ni ensuciar el recorrido
        // principal cuando el servicio externo no responde.
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
            onChatPress={() => setChatVisible(true)}
          />
        )}

        <SideQuickAccessMenu
          onPublicarNecesidadPress={
            !isWorker
              ? () => navigation.navigate("PublicarNecesidad", { view: "new" })
              : undefined
          }
          onBuscarServicioPress={() => handleMicaModePress("buscar-servicio")}
          onOfrecerServicioPress={() => navigation.navigate("OfrecerServicio")}
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

export default withDropDownProvider(withModalProvider(Home));

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f2f5" },
  container: { flex: 1, backgroundColor: "#f0f2f5" },
});
