import type React from "react";
import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Image,
  Animated,
  Easing,
} from "react-native";
import { supabase } from "../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import fondo from "../assets/fondo.png";
import logo from "../assets/serviciosya-logo-2026.png";
import Icon from "react-native-vector-icons/MaterialIcons";
import BotonVolver from "../components/BotonVolver";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../types/navigation";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { useReferrer } from "../lib/hooks/useReferrer";
import { ensureUserProfile } from "../lib/utils/ensureUserProfile";

WebBrowser.maybeCompleteAuthSession();

// Constantes
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mensajes de error
const ERROR_MESSAGES = {
  INVALID_FORMAT: "Ingresá un correo electrónico válido.",
  INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
  GENERAL_ERROR: "Ocurrió un error. Intente nuevamente.",
} as const;

// Funciones de utilidad
const validateEmail = (email: string): boolean => EMAIL_REGEX.test(email);

// Componentes
interface ErrorBoxProps {
  message: string;
}

const ErrorBox: React.FC<ErrorBoxProps> = ({ message }) => (
  <View style={styles.errorBox}>
    <Text style={styles.errorText}>{message}</Text>
  </View>
);

interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChangeText,
  showPassword,
  onTogglePassword,
}) => (
  <View style={styles.passwordContainer}>
    <TextInput
      placeholder="Contraseña"
      placeholderTextColor="#999"
      secureTextEntry={!showPassword}
      onChangeText={onChangeText}
      value={value}
      style={styles.passwordInput}
    />
    <TouchableOpacity
      style={styles.eyeButton}
      onPress={onTogglePassword}
      hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
    >
      <Icon
        name={showPassword ? "visibility-off" : "visibility"}
        size={25}
        color="#bbb"
      />
    </TouchableOpacity>
  </View>
);

// Componente principal
type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function Login({ navigation }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setReferrer } = useReferrer();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Efecto de animación
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleLogin = async () => {
    if (isLoading) return;

    setErrorMessage("");
    setIsLoading(true);

    try {
      const emailToAuth = identifier.trim().toLowerCase();
      if (!validateEmail(emailToAuth)) {
        setErrorMessage(ERROR_MESSAGES.INVALID_FORMAT);
        return;
      }

      // Intentar iniciar sesión
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password,
      });

      if (error) {
        switch (error.code) {
          case "email_not_confirmed":
            navigation.replace("VerificacionPendiente", { email: emailToAuth });
            return;
          case "invalid_credentials":
            setErrorMessage(ERROR_MESSAGES.INVALID_CREDENTIALS);
            return;
          default:
            setErrorMessage(ERROR_MESSAGES.GENERAL_ERROR);
            return;
        }
      }

      // Guardar credenciales y correo si el inicio de sesión es exitoso
      if (data?.user) {
        await ensureUserProfile(data.user);
        await setReferrer(data.user.id);

        // Forzar que Supabase guarde la sesión
        if (data.session) {
          await supabase.auth.setSession(data.session);
        }

        // App cambia automáticamente al stack principal cuando Supabase
        // publica la nueva sesión. Forzar un replace desde el stack de acceso
        // apunta a una ruta inexistente y deja un warning/error de navegación.
      }

    } catch (error) {
      console.error("Error de inicio de sesión:", error);
      setErrorMessage(ERROR_MESSAGES.GENERAL_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = identifier.trim() !== "" && password.trim() !== "";

  return (
    <ImageBackground
      source={fondo}
      style={styles.background}
      resizeMode="cover"
    >
      <BotonVolver />
      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <KeyboardAwareScrollView style={{width:'100%'}}>
          <View style={styles.logoLightWrapper}>
          <Image source={logo} style={styles.logo} />
          </View>
          <Text style={styles.title}>Iniciar Sesión</Text>

          {errorMessage !== "" && <ErrorBox message={errorMessage} />}

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Correo electrónico"
              placeholderTextColor="#999"
              onChangeText={setIdentifier}
              value={identifier}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading}
            />

            <PasswordInput
              value={password}
              onChangeText={setPassword}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />
            <TouchableOpacity
              onPress={() => navigation.navigate("Recuperar contraseña")}
              style={{ alignSelf: "flex-end", marginTop: -10, marginBottom: 10 }}
            >
              <Text style={{ color: "#19D4C6", fontSize: 13 }}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              (!isFormValid || isLoading) && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={!isFormValid || isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? "Ingresando..." : "Ingresar"}
            </Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#d6f0f5',
  },
  container: {
    width: '88%',
    paddingVertical: 36,
    paddingHorizontal: 22,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(6, 158, 179, 0.2)',
    shadowColor: '#069eb3',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 15,
    alignItems: 'center',
  },
  orange: {
    color: '#069eb3',
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: 12,
    resizeMode: 'contain',
  },
  logoLightWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#069eb3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#047a8f",
    marginBottom: 28,
    textAlign: "center",
    letterSpacing: 1,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#a8dfe8',
    paddingVertical: 10,
    marginBottom: 20,
    fontSize: 16,
    color: "#333",
  },
  helpTextContainer: {
    backgroundColor: "#e8f7fa",
    padding: 8,
    borderRadius: 8,
    marginTop: -15,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: "#069eb3",
  },
  helpText: {
    color: "#047a8f",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "left",
  },
  passwordContainer: {
    position: "relative",
    justifyContent: "center",
    marginBottom: 20,
  },
  passwordInput: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#a8dfe8',
    paddingVertical: 10,
    fontSize: 16,
    color: "#333",
    paddingRight: 38,
  },
  eyeButton: {
    position: "absolute",
    right: 0,
    top: 6,
    height: 32,
    width: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButton: {
    backgroundColor: "#069eb3",
    paddingVertical: 15,
    borderRadius: 30,
    marginBottom: 20,
    alignItems: "center",
    width: "100%",
    elevation: 5,
    shadowColor: '#069eb3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loginButtonDisabled: {
    backgroundColor: "#ccc",
    elevation: 2,
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: "#FBE9E7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FF7043",
    width: "100%",
    shadowColor: "#FF7043",
    shadowOpacity: 0.13,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  errorText: {
    color: "#FF7043",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 15,
  },
});
