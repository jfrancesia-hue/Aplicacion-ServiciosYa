import { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import * as Application from "expo-application";
import Constants from "expo-constants";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BotonVolver from "../components/BotonVolver";
import InviteSheetView from "../components/InvitarSheet";
import { withModalProvider } from "../components/sheet/withModalProvider";
import BlockedUsersSection from "../components/trust/BlockedUsersSection";
import { useBottomSheetModal } from "../lib/hooks/useBottomSheetModal";
import { requestPushNotificationPermission } from "../lib/hooks/useNotifications";
import { useSuspenseProfile } from "../lib/hooks/useUser";
import { removeCredentials } from "../lib/storage";
import { supabase } from "../lib/supabase";
import type { MainStackParamList } from "../types/navigation";
import { hasProviderCapability } from "../lib/utils/user";

type Props = NativeStackScreenProps<MainStackParamList, "Configuracion">;

function Configuracion({ navigation }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const profile = useSuspenseProfile();
  const { rol } = profile;
  const isProvider = hasProviderCapability(profile);
  const { present, dismiss, modalProps } = useBottomSheetModal({
    snapPoints: ["90%"],
  });
  const appVersion = Constants.expoConfig?.version ?? "desconocida";
  const buildVersion =
    Application.nativeBuildVersion ??
    String(Constants.expoConfig?.android?.versionCode ?? "desconocida");

  const validarContrasena = (password: string) => {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      length: password.length >= minLength,
      upperCase: hasUpperCase,
      number: hasNumber,
      specialChar: hasSpecialChar,
    };
  };

  const verificarContraseñas = (password: string, confirmPassword: string) => {
    setPasswordMatch(
      password.length > 0 &&
        confirmPassword.length > 0 &&
        password === confirmPassword,
    );
  };

  const handlePasswordChange = (password: string) => {
    setPassword(password);
    const valid = validarContrasena(password);
    setPasswordValid(
      valid.length && valid.upperCase && valid.number && valid.specialChar,
    );
    verificarContraseñas(password, confirmPassword);
  };

  const handleConfirmPasswordChange = (confirmPassword: string) => {
    setConfirmPassword(confirmPassword);
    verificarContraseñas(password, confirmPassword);
  };

  const cambiarContrasena = async () => {
    if (!passwordValid) {
      Alert.alert("Error", "La contraseña no cumple con los requisitos.");
      return;
    }
    if (!passwordMatch) {
      Alert.alert("Error", "Las contraseñas no coinciden.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      Alert.alert("Error al cambiar la contraseña", error.message);
    } else {
      Alert.alert("Éxito", "Contraseña cambiada correctamente");
    }
  };

  const canSavePassword =
    passwordValid && passwordMatch && confirmPassword.length > 0;

  const invitarAmigo = () => {
    present();
  };

  const enableNotifications = async () => {
    setEnablingNotifications(true);
    try {
      await requestPushNotificationPermission();
      Alert.alert(
        "Notificaciones activadas",
        "Vas a recibir novedades de pedidos, presupuestos y mensajes.",
      );
    } catch (cause) {
      Alert.alert(
        "No pudimos activar las notificaciones",
        cause instanceof Error ? cause.message : "Intent\u00e1 nuevamente.",
      );
    } finally {
      setEnablingNotifications(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error al cerrar sesión", error.message);
    }
  };

  const eliminarCuenta = async () => {
    if (rol === "guest") {
      Alert.alert(
        "Acción no permitida",
        "Los usuarios invitados no pueden eliminar su cuenta.",
      );
      return;
    }

    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const { data: user, error: userError } =
              await supabase.auth.getUser();
            if (userError) {
              Alert.alert("Error", "No se pudo obtener el usuario.");
              return;
            }

            const { error: deleteError } = await supabase.rpc("delete_user", {
              uid: user.user.id,
            });

            if (deleteError) {
              Alert.alert("Error", "No se pudo eliminar la cuenta.");
              return;
            }

            await supabase.auth.signOut();
            await removeCredentials();
            navigation.reset({
              index: 0,
              routes: [{ name: "AuthStack", params: { screen: "Login" } }],
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#e8f8fb", "#f0f2f5"]} style={{ flex: 1 }}>
        <ScrollView style={styles.background}>
          <BotonVolver />
          <View style={styles.container}>
            <Text style={styles.title}>Configuración</Text>

            {/* Mostrar capacidades de la cuenta, no el rol tecnico legado. */}
            {rol && (
              <View style={styles.accountSummary}>
                <Text style={styles.accountSummaryTitle}>Tu cuenta</Text>
                <Text style={styles.accountSummaryText}>
                  {isProvider
                    ? "Podés solicitar trabajos y ofrecer servicios."
                    : "Podés buscar y publicar trabajos. Si querés, también podés activar tu perfil de prestador."}
                </Text>
              </View>
            )}

            {/* CAMBIAR CONTRASEÑA */}
            <View style={styles.section}>
              <Text style={styles.optionText}>Cambiar Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Nueva contraseña"
                secureTextEntry
                value={password}
                onChangeText={handlePasswordChange}
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.input}
                placeholder="Repetir nueva contraseña"
                secureTextEntry
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                placeholderTextColor="#999"
              />

              <View style={styles.requisitosContainer}>
                <Text
                  style={[
                    styles.requisito,
                    password.length >= 12 ? styles.valid : styles.invalid,
                  ]}
                >
                  {password.length >= 12 ? "✔" : "○"} Al menos 12 caracteres.
                </Text>
                <Text
                  style={[
                    styles.requisito,
                    /[A-Z]/.test(password) ? styles.valid : styles.invalid,
                  ]}
                >
                  {/[A-Z]/.test(password) ? "✔" : "○"} Una letra mayúscula.
                </Text>
                <Text
                  style={[
                    styles.requisito,
                    /\d/.test(password) ? styles.valid : styles.invalid,
                  ]}
                >
                  {/\d/.test(password) ? "✔" : "○"} Un número.
                </Text>
                <Text
                  style={[
                    styles.requisito,
                    /[!@#$%^&*(),.?":{}|<>]/.test(password)
                      ? styles.valid
                      : styles.invalid,
                  ]}
                >
                  {/[!@#$%^&*(),.?":{}|<>]/.test(password) ? "✔" : "○"} Un
                  carácter especial.
                </Text>
                <Text
                  style={[
                    styles.requisito,
                    passwordMatch ? styles.valid : styles.invalid,
                  ]}
                >
                  {passwordMatch ? "✔" : "○"} Las contraseñas coinciden.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.buttonOrange,
                  !canSavePassword && styles.buttonDisabled,
                ]}
                onPress={cambiarContrasena}
                disabled={!canSavePassword}
              >
                <Text style={styles.buttonText}>Guardar Contraseña</Text>
              </TouchableOpacity>
            </View>

            <View style={{ borderTopWidth: 1, borderColor: "#ccc" }}>
              {/* INVITAR */}
              {rol !== "guest" && (
                <View style={[styles.section, { marginTop: 10 }]}>
                  <Text style={styles.optionText}>Invitar a un Amigo</Text>
                  <TouchableOpacity
                    style={styles.buttonTurquoise}
                    onPress={invitarAmigo}
                  >
                    <Text style={styles.buttonText}>Invitar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {rol !== "guest" && (
                <View style={styles.section}>
                  <Text style={styles.optionText}>Notificaciones</Text>
                  <Text style={styles.optionDescription}>
                    {
                      "Android te pedir\u00e1 permiso solamente cuando toques este bot\u00f3n."
                    }
                  </Text>
                  <TouchableOpacity
                    style={styles.buttonTurquoise}
                    disabled={enablingNotifications}
                    onPress={() => void enableNotifications()}
                  >
                    <Text style={styles.buttonText}>
                      {enablingNotifications
                        ? "Activando..."
                        : "Activar notificaciones"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Soporte dentro de la app */}
              <View style={styles.section}>
                <Text style={styles.optionText}>¿Necesitás ayuda?</Text>
                <Text style={styles.optionDescription}>
                  Elegí qué querés resolver con MICA.
                </Text>
                <TouchableOpacity
                  style={styles.buttonTurquoise}
                  onPress={() =>
                    navigation.navigate("MicaChat", {
                      mode: "buscar-servicio",
                    })
                  }
                >
                  <Text style={styles.buttonText}>
                    Buscar o publicar un trabajo
                  </Text>
                </TouchableOpacity>
                {isProvider && (
                  <TouchableOpacity
                    style={styles.buttonProvider}
                    onPress={() =>
                      navigation.navigate("MicaChat", {
                        mode: "ofrecer-servicio",
                      })
                    }
                  >
                    <Text style={styles.buttonText}>
                      Gestionar mi oferta con MICA
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {rol !== "guest" && <BlockedUsersSection />}

              <View style={styles.section}>
                <Text style={styles.optionText}>Información legal</Text>
                <Text style={styles.optionDescription}>
                  Consultá los documentos vigentes guardados dentro de la app.
                </Text>
                <TouchableOpacity
                  style={styles.buttonTurquoise}
                  onPress={() =>
                    navigation.navigate("LegalDocument", { document: "terms" })
                  }
                >
                  <Text style={styles.buttonText}>Términos y condiciones</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonTurquoise, { marginTop: 10 }]}
                  onPress={() =>
                    navigation.navigate("LegalDocument", {
                      document: "privacy",
                    })
                  }
                >
                  <Text style={styles.buttonText}>Política de privacidad</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonTurquoise, { marginTop: 10 }]}
                  onPress={() =>
                    navigation.navigate("ConsumerRightRequest", {
                      requestType: "withdrawal",
                    })
                  }
                >
                  <Text style={styles.buttonText}>
                    Botón de arrepentimiento
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonTurquoise, { marginTop: 10 }]}
                  onPress={() =>
                    navigation.navigate("ConsumerRightRequest", {
                      requestType: "service_cancellation",
                    })
                  }
                >
                  <Text style={styles.buttonText}>
                    Botón de baja de servicio
                  </Text>
                </TouchableOpacity>
              </View>

              {rol === "admin" && (
                <View style={styles.section}>
                  <Text style={styles.optionText}>Operación y seguridad</Text>
                  <Text style={styles.optionDescription}>
                    Revisá prestadores, embudo, pagos, errores y reportes sin
                    exponer conversaciones privadas.
                  </Text>
                  <TouchableOpacity
                    style={styles.adminButton}
                    onPress={() => navigation.navigate("OperationalDashboard")}
                  >
                    <Text style={styles.buttonText}>Abrir panel operativo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.adminButton, { marginTop: 10 }]}
                    onPress={() => navigation.navigate("PerfilesPendientes")}
                  >
                    <Text style={styles.buttonText}>
                      Revisar verificaciones de identidad
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* CERRAR SESIÓN */}
              <View style={styles.section}>
                <Text style={styles.optionText}>Cerrar Sesión</Text>
                <TouchableOpacity
                  style={styles.buttonOrange}
                  onPress={handleLogout}
                >
                  <Text style={styles.buttonText}>Cerrar Sesión</Text>
                </TouchableOpacity>
              </View>

              {/* ELIMINAR CUENTA */}
              <View style={styles.section}>
                <Text style={styles.optionText}>Eliminar Cuenta</Text>
                <TouchableOpacity
                  style={[styles.buttonOrange, { backgroundColor: "#D9534F" }]}
                  onPress={eliminarCuenta}
                >
                  <Text style={styles.buttonText}>Eliminar Cuenta</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.versionText}>
                Servicios Ya v{appVersion} · build {buildVersion}
              </Text>
            </View>
          </View>
          <BottomSheetModal {...modalProps}>
            <InviteSheetView />
          </BottomSheetModal>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

export default withModalProvider(Configuracion);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8f8fb",
  },
  background: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    margin: 18,
    marginTop: 32,
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 24,
    shadowColor: "#069eb3",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 30,
    color: "#047a8f",
    letterSpacing: 1,
  },
  section: {
    marginBottom: 34,
  },
  accountSummary: {
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cfe7eb",
    backgroundColor: "#f0fafa",
    padding: 16,
  },
  accountSummaryTitle: {
    color: "#047a8f",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 5,
  },
  accountSummaryText: {
    color: "#52666a",
    fontSize: 13,
    lineHeight: 19,
  },
  optionText: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
    color: "#202B3A",
    marginTop: 4,
  },
  optionDescription: {
    color: "#667b80",
    fontSize: 13,
    lineHeight: 19,
    marginTop: -4,
    marginBottom: 12,
  },
  adminButton: {
    backgroundColor: "#063b45",
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#063b45",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
  },
  input: {
    backgroundColor: "#f5feff",
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#222",
    marginBottom: 13,
    borderWidth: 1.3,
    borderColor: "#a8dfe8",
  },
  buttonTurquoise: {
    backgroundColor: "#069eb3",
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#069eb3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
  },
  buttonOrange: {
    backgroundColor: "#047a8f",
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#047a8f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
  },
  buttonDisabled: {
    opacity: 0.45,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonProvider: {
    backgroundColor: "#e98212",
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#b96810",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 17,
  },
  requisitosContainer: {
    marginBottom: 16,
  },
  requisito: {
    fontSize: 14,
    marginVertical: 2,
  },
  valid: {
    color: "#069eb3",
    fontWeight: "700",
  },
  invalid: {
    color: "#A1A1A1",
  },
  icon: {
    marginRight: 6,
  },
  versionText: {
    marginBottom: 12,
    color: "#71868a",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
