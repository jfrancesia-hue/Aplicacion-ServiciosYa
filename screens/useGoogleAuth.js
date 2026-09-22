import { useEffect } from 'react';
import Constants from 'expo-constants'; // Necesario para detectar el entorno

// 1. Definimos las variables inicialmente como null
let GoogleSignin = null;
let statusCodes = null;

// 2. Verificamos si estamos corriendo en Expo Go
const isRunningInExpoGo = () => {
  return Constants.appOwnership === 'expo';
};

// 3. Cargamos la librería SOLO si NO es Expo Go (Development Build o producción)
if (!isRunningInExpoGo()) {
  try {
    const googleModule = require('@react-native-google-signin/google-signin');
    GoogleSignin = googleModule.GoogleSignin;
    statusCodes = googleModule.statusCodes;
  } catch (err) {
    console.warn("Error cargando Google Signin nativo:", err);
  }
}

export const useGoogleAuth = () => {

  useEffect(() => {
    // 4. Solo configuramos si la librería se cargó correctamente
    if (GoogleSignin) {
      try {
        GoogleSignin.configure({
          webClientId: '453761258131-3djvd01vqfglrcgcokqih78jhrjmo6oc.apps.googleusercontent.com',
          iosClientId: '453761258131-6anu4ghpi4jv1df72490vo69vj23qq22.apps.googleusercontent.com'
        });
      } catch (e) {
        console.error("Error configurando Google:", e);
      }
    }
  }, []);

  const signInWithGoogle = async (onLoginCallback) => {
    // 5. BLOQUE DE SEGURIDAD: Si estamos en Expo Go, mostramos alerta y salimos
    if (!GoogleSignin) {
      alert("Google Sign-In no funciona en 'Expo Go'. Necesitas una 'Development Build' para probar esto.");
      onLoginCallback('Funcionalidad no disponible en Expo Go', null);
      return;
    }

    // 6. Flujo normal (solo se ejecuta en build nativo)
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      if (userInfo.data?.idToken) {
        onLoginCallback(null, userInfo);
      } else {
        onLoginCallback('no ID token present!', null);
      }
    } catch (error) {
      console.error('Google Sign-In Error', error);
      
      let errorMessage = 'Error al iniciar sesión con Google.';
      
      // Verificamos statusCodes con seguridad (por si es null)
      if (statusCodes) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          errorMessage = 'user cancelled the login flow';
        } else if (error.code === statusCodes.IN_PROGRESS) {
          errorMessage = 'operation is in progress already';
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          errorMessage = 'play services not available or outdated';
        }
      }

      onLoginCallback(errorMessage, null);
    }
  };

  return {
    signInWithGoogle,
  };
};
