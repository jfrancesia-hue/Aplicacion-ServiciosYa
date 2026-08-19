import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ConsumerRightRequestScreen from "../screens/ConsumerRightRequestScreen";
import LegalDocumentScreen from "../screens/LegalDocumentScreen";
import Login from "../screens/Login";
import LoginSelect from "../screens/LoginSeleccion";
import NuevaContrasena from "../screens/NuevaContrasena";
import RecuperarContrasena from "../screens/RecuperarContrasena";
import Register from "../screens/Register";
import VerificacionPendiente from "../screens/VerificacionPendiente";
import type { AuthStackParamList } from "../types/navigation";

function withSafeArea<P extends object>(
  Component: React.ComponentType<P>,
) {
  return (props: P) => (
    <SafeAreaView style={styles.screenContainer}>
      <Component {...props} />
    </SafeAreaView>
  );
}

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="LoginSelect"
    >
      <Stack.Screen name="LoginSelect" component={withSafeArea(LoginSelect)} />
      <Stack.Screen name="Login" component={withSafeArea(Login)} />
      <Stack.Screen name="Register" component={withSafeArea(Register)} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
      <Stack.Screen
        name="ConsumerRightRequest"
        component={ConsumerRightRequestScreen}
      />
      <Stack.Screen
        name="VerificacionPendiente"
        component={withSafeArea(VerificacionPendiente)}
      />
      {/* RECUPERAR CONTRASEÑA */}
      <Stack.Screen
        name="Recuperar contraseña"
        component={RecuperarContrasena}
      />

      <Stack.Screen name="Nueva contraseña" component={NuevaContrasena} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "white",
  },
});
