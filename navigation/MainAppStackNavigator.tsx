import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type React from "react";
import type { FC, PropsWithChildren } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotifications } from "../lib/hooks/useNotifications";
import ChatIndividual from "../screens/ChatIndividual";
import Configuracion from "../screens/Configuracion";
import CrearPerfil from "../screens/CrearPerfil";
import EditarServicio from "../screens/EditarServicio";
import Home from "../screens/Home";
import MisServicios from "../screens/MisServicios";
import NotificacionesScreen from "../screens/NotificacionesScreen";
import OfrecerServicio from "../screens/OfrecerServicio";
import Perfil from "../screens/Perfil";
import PerfilesPendientes from "../screens/PerfilesPendientes";
import ServiciosPorCategoria from "../screens/ServiciosPorCategoria";
import type { MainStackParamList } from "../types/navigation";

import RegistroCliente from "../screens/RegistroCliente";
import RegistroTrabajador from "../screens/RegistroTrabajador";
import SeleccionRol from "../screens/SeleccionRol";

import WorkerProfile from "../components/workers/WorkerProfile";
import { useInitializeHomeEvents } from "../lib/hooks/useInitializeHomeEvents";
import ChatListScreen from "../screens/ChatListScreen";
import ConsumerRightRequestScreen from "../screens/ConsumerRightRequestScreen";
import InicioRouter from "../screens/InicioRouter";
import LegalAcceptanceScreen from "../screens/LegalAcceptanceScreen";
import LegalDocumentScreen from "../screens/LegalDocumentScreen";
import MicaChat from "../screens/MicaChat";
import OperationalDashboard from "../screens/OperationalDashboard";
import PublicarNecesidad from "../screens/PublicarNecesidad";
import TrabajosPendientes from "../screens/TrabajosPendientes";

const withSafeArea = <P extends object>(Component: FC<P>) => {
  const WrappedComponent: FC<P> = (props: PropsWithChildren<P>) => (
    <SafeAreaView style={styles.screenContainer}>
      <Component {...props} />
    </SafeAreaView>
  );

  return WrappedComponent;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainStackNavigator() {
  useInitializeHomeEvents();
  useNotifications();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="InicioRouter"
    >
      <Stack.Screen name="InicioRouter" component={InicioRouter} />
      <Stack.Screen
        name="SeleccionRol"
        component={withSafeArea(SeleccionRol)}
      />
      <Stack.Screen
        name="RegistroCliente"
        component={withSafeArea(RegistroCliente)}
      />
      <Stack.Screen
        name="RegistroTrabajador"
        component={withSafeArea(RegistroTrabajador)}
      />

      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="CrearPerfil" component={withSafeArea(CrearPerfil)} />
      <Stack.Screen name="Perfil" component={withSafeArea(Perfil)} />
      <Stack.Screen name="OfrecerServicio" component={OfrecerServicio} />
      <Stack.Screen name="PublicarNecesidad" component={PublicarNecesidad} />
      <Stack.Screen name="TrabajosPendientes" component={TrabajosPendientes} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
      <Stack.Screen name="LegalAcceptance" component={LegalAcceptanceScreen} />
      <Stack.Screen
        name="ConsumerRightRequest"
        component={ConsumerRightRequestScreen}
      />
      <Stack.Screen
        name="Configuracion"
        component={withSafeArea(Configuracion)}
      />
      <Stack.Screen
        name="ServiciosPorCategoria"
        component={ServiciosPorCategoria}
      />
      <Stack.Screen name="ChatIA" component={withSafeArea(ChatListScreen)} />
      <Stack.Screen name="MicaChat" component={MicaChat} />
      <Stack.Screen
        name="ChatIndividual"
        component={withSafeArea(ChatIndividual)}
      />
      <Stack.Screen
        name="MisServicios"
        component={withSafeArea(MisServicios)}
      />
      <Stack.Screen name="EditarServicio" component={EditarServicio} />
      <Stack.Screen
        name="NotificacionesScreen"
        component={withSafeArea(NotificacionesScreen)}
      />
      <Stack.Screen
        name="PerfilesPendientes"
        component={withSafeArea(PerfilesPendientes)}
      />
      <Stack.Screen
        name="OperationalDashboard"
        component={OperationalDashboard}
      />
      <Stack.Screen name="WorkerProfile" component={WorkerProfile} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "white",
  },
});
