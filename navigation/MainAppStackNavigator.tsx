import type React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import Home from "../screens/Home";
import ChatIA from "../screens/ChatIA";
import ChatIndividual from "../screens/ChatIndividual";
import Configuracion from "../screens/Configuracion";
import CrearPerfil from "../screens/CrearPerfil";
import DniPendiente from "../screens/DniPendiente";
import EditarServicio from "../screens/EditarServicio";
import Maps from "../screens/Maps";
import MisServicios from "../screens/MisServicios";
import NotificacionesScreen from "../screens/NotificacionesScreen";
import OfrecerServicio from "../screens/OfrecerServicio";
import PasarelaPago from "../screens/PasarelaPago";
import Perfil from "../screens/Perfil";
import PerfilesPendientes from "../screens/PerfilesPendientes";
import PerfilPendienteDetalle from "../screens/PerfilPendienteDetalle";
import ServiciosPorCategoria from "../screens/ServiciosPorCategoria";
import VerificacionPendiente from "../screens/VerificacionPendiente";
import pagoInicial from "../screens/pagoInicial";
import { useGPSLocation } from "../lib/hooks/useGPSLocation";
import type { MainStackParamList } from "../types/navigation";
import type { FC, PropsWithChildren } from "react";
import OnlineWorkers from "../screens/OnlineWorkers";
import { useNotifications } from "../lib/hooks/useNotifications";

import SeleccionRol from "../screens/SeleccionRol";
import RegistroCliente from "../screens/RegistroCliente";
import RegistroTrabajador from "../screens/RegistroTrabajador";
import PasarelaPagoWorker from '../screens/PasarelaPagoWorker';

import InicioRouter from '../screens/InicioRouter';
import WorkerProfile from "../components/workers/WorkerProfile";
import { useInitializeHomeEvents } from "../lib/hooks/useInitializeHomeEvents";
import ChatListScreen from "../screens/ChatListScreen";
import MicaChat from "../screens/MicaChat";
import OperationalDashboard from "../screens/OperationalDashboard";

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
  useGPSLocation();
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="InicioRouter"
    >
      <Stack.Screen name="InicioRouter" component={InicioRouter} />
      <Stack.Screen name="SeleccionRol" component={withSafeArea(SeleccionRol)} />
      <Stack.Screen name="RegistroCliente" component={withSafeArea(RegistroCliente)} />
      <Stack.Screen name="RegistroTrabajador" component={withSafeArea(RegistroTrabajador)} />

      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="CrearPerfil" component={withSafeArea(CrearPerfil)} />
      <Stack.Screen name="Perfil" component={withSafeArea(Perfil)} />
      <Stack.Screen name="OfrecerServicio" component={OfrecerServicio} />
      <Stack.Screen
        name="pagoInicial"
        component={pagoInicial}
      />
      <Stack.Screen
        name="Configuracion"
        component={withSafeArea(Configuracion)}
      />
      <Stack.Screen
        name="ServiciosPorCategoria"
        component={ServiciosPorCategoria}
      />
      <Stack.Screen
        name="PasarelaPago"
        component={withSafeArea(PasarelaPago)}
      />
      <Stack.Screen
        name="PasarelaPagoWorker"
        component={PasarelaPagoWorker}
        options={{ headerShown: false }}
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
        name="DniPendiente"
        component={withSafeArea(DniPendiente)}
      />
      <Stack.Screen
        name="PerfilesPendientes"
        component={withSafeArea(PerfilesPendientes)}
      />
      <Stack.Screen
        name="PerfilPendienteDetalle"
        component={withSafeArea(PerfilPendienteDetalle)}
      />
      <Stack.Screen
        name="OperationalDashboard"
        component={OperationalDashboard}
      />
      <Stack.Screen name="Maps" component={Maps} />
      <Stack.Group screenOptions={{ presentation: "modal" }}>
        <Stack.Screen name="OnlineWorkers" component={OnlineWorkers} />
      </Stack.Group>
      <Stack.Screen
        name="WorkerProfile"
        component={WorkerProfile}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "white",
  },
});
