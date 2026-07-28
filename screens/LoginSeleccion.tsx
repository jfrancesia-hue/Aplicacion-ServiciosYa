import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ImageBackground, Image, Animated, Easing,
  ToastAndroid, Linking
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import fondo from '../assets/fondo.png';
import logo from '../assets/serviciosya-logo-2026.png';
// import useAuthSession from '../lib/hooks/useAuthSession';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../types/navigation';

import AppleSignInButton from "../components/AppleSignInButton"; 
import vexo from '../lib/vexo';
import { useGoogleAuth } from './useGoogleAuth';

WebBrowser.maybeCompleteAuthSession();

type LoginSelectProps = NativeStackScreenProps<AuthStackParamList, "LoginSelect">;

const LoginButton = ({
  icon,
  label,
  onPress,
  style = {},
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  onPress: () => void;
  style?: object;
}) => (
  <TouchableOpacity
    style={[styles.loginButton, style]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    activeOpacity={0.85}
  >
    <MaterialIcons name={icon} size={22} color="#faae4bff" style={styles.loginButtonIcon} />
    <Text style={styles.loginButtonText}>{label}</Text>
  </TouchableOpacity>
);

const ErrorBox = ({ message }: { message: string }) => (
  <View style={styles.errorBox}>
    <Text style={styles.errorText}>{message}</Text>
  </View>
);

export default function LoginSelect({ navigation }: LoginSelectProps) {
  const [errorMessage, setErrorMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const { signInWithGoogle } = useGoogleAuth();

  // const { biometricLogin } = useAuthSession({
  //   onAuthSuccess: () => navigation.replace('Home'),
  //   onError: (error) => ToastAndroid.show(error.message, ToastAndroid.SHORT)
  // });

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
  }, []);

  const handleEmailLogin = () => {
    vexo.login("email");
    navigation.navigate('Login')
  };

  // const handleHuellaLogin = async () => {
  //   try {
  //     await biometricLogin();
  //   } catch (e) {
  //     setErrorMessage('No se pudo iniciar sesión con huella.');
  //   }
  // };
  
  const handleLoginGoogle = async (errorResponse: string | null, response: any) => {
    if (errorResponse) {
      setErrorMessage(errorResponse);
      return;
    }

    // Iniciar sesión con el token de Google
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken,
    });
    if (error) {
      setErrorMessage('Error al iniciar sesión con Google.');
    }

    // Verificar si el usuario existe en la tabla "usuarios"
    const userId = data.user?.id;
    const userEmail = data.user?.email;

    if (!userId || !userEmail) {
      setErrorMessage('No se pudo obtener información del usuario.');
      return;
    }

    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', userId)
        .single();

      console.log('existingUser ', existingUser);

      // Si no se encuentra, insertarlo
      if (existingUser == null) {
        console.log('registrar usuario ');
        const { error: insertError } = await supabase
          .from('usuarios')
          .insert([{ id: userId, email: userEmail }]);

        if (insertError) {
          console.error('Error insertando nuevo usuario:', insertError);
          setErrorMessage('Error al guardar información del usuario.');
          return;
        }
      }

      vexo.login("google");

      // Continúa el flujo normal
      console.log('Inicio de sesión exitoso con Google');

    } catch (err) {
      console.error('Error verificando/insertando usuario:', err);
      setErrorMessage('Error al procesar el usuario.');
    }
  };

  const handleGuestLogin = async () => {
    vexo.login("guest");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'guest@example.com',
      password: 'guestpassword',
    });

    if (error) {
      console.log('Error al loguear invitado:', error.message);
      return;
    }

    (navigation as any).reset({
      index: 0,
      routes: [{ name: 'InicioRouter' }],
    });
  };

  const openURL = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Error al abrir el enlace:", err));
  };





  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.logoLightWrapper}>
          <Image source={logo} style={styles.logo} />
        </View>



        <Text style={styles.appTitle}>TOORI SERVICIOS YA</Text>
        <Text style={styles.title}>
          Seleccione su <Text style={styles.bold}>método de inicio de sesión</Text> preferido
        </Text>


        {errorMessage !== '' && <ErrorBox message={errorMessage} />}

        <View style={[styles.buttonsWrapper, { gap: 12, marginBottom: 8, marginTop: 10 }]}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleEmailLogin}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name="email"
              size={22}
              style={styles.loginButtonIcon}
            />
            <Text style={styles.loginButtonText}>
              Inicia con tu <Text style={styles.orange}>correo</Text>
            </Text>
          </TouchableOpacity>

          {/* HUELLA DIGITAL - DESHABILITADO TEMPORALMENTE
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleHuellaLogin}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="fingerprint"
              size={24}
              style={styles.fingerprintIcon}
            />
            <Text style={styles.loginButtonText}>
              Inicia con tu <Text style={styles.orange}>huella</Text>
            </Text>
          </TouchableOpacity>
          */}
 
        <TouchableOpacity
          style={styles.loginButton}
          activeOpacity={0.85}
          onPress={() => signInWithGoogle(handleLoginGoogle)}
        >
          <Image
            source={require('../assets/google.png')}
            style={styles.googleIcon}
          />
          <Text style={styles.loginButtonText}>
            Iniciar con Google
          </Text>
        </TouchableOpacity> 


          <AppleSignInButton />
          <LoginButton
            icon="person-outline"
            label="Entrar como invitado"
            onPress={handleGuestLogin}
            style={{ backgroundColor: '#F1F1F1', display: 'none' }}

          />

        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Register', {})}>
          <Text style={styles.registerText}>¿No tienes cuenta? Regístrate</Text>
        </TouchableOpacity>


        <Text style={[styles.text, { marginTop: 25 }]}>
          Al usar esta aplicación, aceptas nuestros{' '}
          <Text
            style={styles.link}
            onPress={() => openURL('https://inicio.serviciosya.info/Terminos-y-condiciones.html')}
          >
            Términos y Condiciones
          </Text>{' '}
          y nuestra{' '}
          <Text
            style={styles.link}
            onPress={() => openURL('https://inicio.serviciosya.info/politicas-de-privacidad.html')}
          >
            Política de Privacidad
          </Text>.
        </Text>

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
  fingerprintIcon: {
    marginRight: 12,
    color: '#047a8f',
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#047a8f',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    marginBottom: 26,
  },
  bold: {
    fontWeight: '800',
    color: '#047a8f',
  },
  buttonsWrapper: {
    width: '100%',
    gap: 14,
    marginTop: 10,
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 999,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#069eb3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(6,158,179,0.15)',
  },
  loginButtonIcon: {
    marginRight: 12,
    color: '#069eb3',
  },
  loginButtonText: {
    color: '#111111',
    fontWeight: '600',
    fontSize: 16,
  },
  text: {
    marginTop: 25,
    fontSize: 13,
    textAlign: 'center',
    color: '#4A4A4A',
    lineHeight: 18,
  },
  link: {
    color: '#047a8f',
    fontWeight: '900',
  },
  errorBox: {
    backgroundColor: '#FFEDEC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    borderColor: '#FF7A5C',
    borderWidth: 1,
  },
  errorText: {
    color: '#D84315',
    textAlign: 'center',
    fontWeight: '700',
  },
  registerText: {
    marginTop: 18,
    fontSize: 15,
    fontWeight: '900',
    color: '#069eb3',
  },
  registerLink: {
    color: '#047a8f',
    fontWeight: '700',
  },
});
