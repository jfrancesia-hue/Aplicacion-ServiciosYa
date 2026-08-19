// components/BtnLoginGoogle.js
import React from 'react';
import {
  GoogleSignin,
  statusCodes,
  type SignInResponse,
} from "@react-native-google-signin/google-signin";
import Ionicons from '@expo/vector-icons/Ionicons';
import SocialButton from './SocialButton';

GoogleSignin.configure({
  webClientId: '453761258131-3djvd01vqfglrcgcokqih78jhrjmo6oc.apps.googleusercontent.com',
  iosClientId: '453761258131-6anu4ghpi4jv1df72490vo69vj23qq22.apps.googleusercontent.com'
});

type BtnLoginGoogleProps = {
  onLogin: (
    error: string | null,
    response: SignInResponse | null,
  ) => void | Promise<void>;
};

export default function BtnLoginGoogle({ onLogin }: BtnLoginGoogleProps) {
  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices()
      const userInfo = await GoogleSignin.signIn()
      if (userInfo.data?.idToken) {
          onLogin(null, userInfo);
      } else {
        onLogin('no ID token present!',null)
      }  
    } catch (error: unknown) {
      console.log('BtnLoginGoogle error', error);
      const errorCode =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
        onLogin('user cancelled the login flow',null)
      } else if (errorCode === statusCodes.IN_PROGRESS) {
        onLogin('operation (e.g. sign in) is in progress already',null)
      } else if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        onLogin('play services not available or outdated',null)
      } else {
        onLogin('Error al iniciar sesión con Google.',null)
      }        
    }
  };

  return (
    <SocialButton
      onPress={signIn}
      icon={<Ionicons name="logo-google" size={24} color="#fff" />}
      text="Iniciar con Google"
      backgroundColor="#EA4335"
      textColor="#fff"
      style={{ justifyContent: 'center' }}
      />
  );
}
