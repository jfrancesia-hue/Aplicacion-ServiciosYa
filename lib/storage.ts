import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Constants for secure storage
const STORAGE_KEYS = {
  CREDENTIALS: 'supabase_credentials',
  LAST_USER: 'last_user_id'
};

/**
 * Removes stored credentials
 */
export async function removeCredentials() {
  // Limpieza de instalaciones antiguas que llegaron a guardar email/clave.
  // Las versiones actuales persisten sólo la sesión renovable de Supabase.
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.CREDENTIALS);
  }
}

async function getlastUserId(): Promise<string | null> {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.LAST_USER);
  return value
}

async function setLastUserId(id: string) {
  await AsyncStorage.setItem(STORAGE_KEYS.LAST_USER, id);  
}

export const lastUserId = {
  get: getlastUserId,
  set: setLastUserId
}
