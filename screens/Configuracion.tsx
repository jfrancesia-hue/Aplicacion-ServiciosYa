import { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useEffect } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BotonVolver from "../components/BotonVolver";
import InviteSheetView from "../components/InvitarSheet";
import { withModalProvider } from "../components/sheet/withModalProvider";
import BlockedUsersSection from "../components/trust/BlockedUsersSection";
import { useBottomSheetModal } from "../lib/hooks/useBottomSheetModal";
import { useSuspenseProfile } from "../lib/hooks/useUser";
import { useUserSettings } from "../lib/hooks/useUserSettings";
import { removeCredentials } from "../lib/storage";
import { supabase } from "../lib/supabase";
import type { MainStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<MainStackParamList, "Configuracion">;

function Configuracion({ navigation }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordValid, setPasswordValid] = useState(true);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const { rol } = useSuspenseProfile();
  const { present, dismiss, modalProps } = useBottomSheetModal({
    snapPoints: ["90%"],
  });

  const { settings } = useUserSettings();

  const validarContrasena = (password: string) => {
    const minLength = 8;
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
    setPasswordMatch(password === confirmPassword);
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

  const invitarAmigo = () => {
    present();
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
            (navigation as any).reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          },
        },
      ],
    );
  };

  return (
    <>
      <BotonVolver />
      <LinearGradient colors={["#e8f8fb", "#f0f2f5"]} style={{ flex: 1 }}>
        <ScrollView style={styles.background}>
          <View style={styles.container}>
            <Text style={styles.title}>Configuración</Text>

            {/* Mostrar el rol */}
            {rol && (
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{ fontWeight: "700", fontSize: 16, color: "#555" }}
                >
                  Rol: <Text style={{ color: "#19D4C6" }}>{rol}</Text>
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
                    password.length >= 8 ? styles.valid : styles.invalid,
                  ]}
                >
                  {password.length >= 8 ? "✔" : "○"} Al menos 8 caracteres.
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
                style={styles.buttonOrange}
                onPress={cambiarContrasena}
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

              {/* Soporte dentro de la app */}
              <View style={styles.section}>
                <Text style={styles.optionText}>¿Necesitás ayuda?</Text>
                <TouchableOpacity
                  style={styles.buttonTurquoise}
                  onPress={() =>
                    navigation.navigate("MicaChat", {
                      mode:
                        rol === "worker"
                          ? "ofrecer-servicio"
                          : "buscar-servicio",
                    })
                  }
                >
                  <Text style={styles.buttonText}>Abrir MICA</Text>
                </TouchableOpacity>
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
            </View>
          </View>
          <BottomSheetModal {...modalProps}>
            <InviteSheetView />
          </BottomSheetModal>
        </ScrollView>
      </LinearGradient>
    </>
  );
}

export default withModalProvider(Configuracion);

const styles = StyleSheet.create({
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
});
