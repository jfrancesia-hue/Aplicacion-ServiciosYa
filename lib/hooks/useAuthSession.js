
// useAuthSession.js
import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../supabase';
import { getCredentials } from '../storage';
import { useUserSettings } from './useUserSettings';

// Constantes para almacenamiento seguro
const STORAGE_KEYS = {
    SESSION: 'supabase_session',
    LAST_LOGIN: 'last_login_method',
    CREDENTIALS: 'supabase_credentials',
    BIOMETRIC_AUTH: 'last_biometric_auth',
};

// Configuración
const CONFIG = {
    BIOMETRIC_COOLDOWN: 10 * 1000, // 10 segundos
    SESSION_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutos en ms
    MIN_REFRESH_DELAY: 1000, // 1 segundo mínimo
};

// Tipos JSDoc
/**
 * @typedef {'email' | 'phone' | 'biometric' | 'none'} LoginMethod
 * @typedef {'idle' | 'authenticating' | 'authenticated' | 'error'} AuthState
 * @typedef {import('@supabase/supabase-js').Session} Session
 * @typedef {import('@supabase/supabase-js').AuthError} AuthError
 * @typedef {import('expo-local-authentication').AuthenticationType} BiometricType
 */

/**
 * @typedef {Object} AuthCredentials
 * @property {string} email - Email del usuario
 * @property {string} password - Contraseña del usuario
 */

/**
 * @typedef {Object} BiometricCheckResult
 * @property {boolean} available - Si la biometría está disponible
 * @property {BiometricType | null} type - Tipo de biometría disponible
 * @property {string} [error] - Mensaje de error si no está disponible
 */

/**
 * @typedef {Object} AuthHookOptions
 * @property {function(Error): void} [onError] - Callback para errores generales
 * @property {function(Session): void} [onAuthSuccess] - Callback para autenticación exitosa
 * @property {function(Error): void} [onAuthError] - Callback para errores de autenticación
 * @property {function(Session): void} [onBiometricSuccess] - Callback para éxito biométrico
 */

/**
 * @typedef {Object} AuthHookReturn
 * @property {Session | null} session - Sesión actual del usuario
 * @property {AuthState} authState - Estado actual de autenticación
 * @property {LoginMethod} loginMethod - Último método de login utilizado
 * @property {BiometricType | null} biometricType - Tipo de biometría disponible
 * @property {string | null} error - Último error ocurrido
 * @property {function(string, string): Promise<boolean>} emailLogin - Función para login con email
 * @property {function(): Promise<Session | null>} biometricLogin - Función para login biométrico
 * @property {function(LoginMethod): Promise<void>} rememberLoginMethod - Recordar método de login
 * @property {function(): Promise<void>} logout - Función para cerrar sesión
 * @property {function(): Promise<void>} clearError - Función para limpiar errores
 * @property {function(): Promise<BiometricCheckResult>} checkBiometrics - Verificar capacidades biométricas
 * @property {boolean} isAuthenticated - Si el usuario está autenticado
 * @property {boolean} isBiometricAvailable - Si la biometría está disponible
 * @property {boolean} isLoading - Si está en proceso de autenticación
 * @property {boolean} hasStoredCredentials - Si hay credenciales guardadas
 */

/**
 * Hook personalizado para manejar la autenticación con Supabase
 * Incluye soporte para autenticación biométrica y manejo seguro de sesiones
 * 
 * @param {AuthHookOptions} [options={}] - Opciones de configuración del hook
 * @returns {AuthHookReturn} Objeto con estado y funciones de autenticación
 * 
 * @example
 * ```javascript
 * const {
 *   session,
 *   authState,
 *   error,
 *   emailLogin,
 *   biometricLogin,
 *   logout,
 *   isAuthenticated,
 *   isBiometricAvailable
 * } = useAuthSession({
 *   onAuthSuccess: (session) => console.log('Usuario autenticado', session.user),
 *   onError: (error) => console.error('Error de autenticación', error),
 * });
 * ```
 */
export default function useAuthSession(options = {}) {
    const {
        onError,
        onAuthSuccess,
        onAuthError,
        onBiometricSuccess,
    } = options;
    const { settings } = useUserSettings();

    // Estados principales
    /** @type {[Session | null, function]} */
    const [session, setSession] = useState(null);

    /** @type {[AuthState, function]} */
    const [authState, setAuthState] = useState('idle');

    /** @type {[LoginMethod, function]} */
    const [loginMethod, setLoginMethod] = useState('none');

    /** @type {[string | null, function]} */
    const [error, setError] = useState(null);

    /** @type {[BiometricType | null, function]} */
    const [biometricType, setBiometricType] = useState(null);

    /** @type {[boolean, function]} */
    const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

    /**
     * Limpia el estado de error
     */
    const clearError = useCallback(async () => {
        setError(null);
        if (authState === 'error') {
            setAuthState('idle');
        }
    }, [authState]);

    /**
     * Maneja errores de forma centralizada
     * @param {Error | AuthError | string} err - Error a manejar
     * @param {string} fallbackMessage - Mensaje por defecto si no hay mensaje en el error
     * @param {boolean} [setErrorState=true] - Si debe cambiar el estado a 'error'
     */
    const handleError = useCallback((err, fallbackMessage, setErrorState = true) => {
        const errorMessage = typeof err === 'string' ? err : (err?.message || fallbackMessage);

        setError(errorMessage);
        if (setErrorState) {
            setAuthState('error');
        }

        // Notificar callbacks apropiados
        if (onError) {
            try {
                onError(typeof err === 'string' ? new Error(err) : err);
            } catch (callbackError) {
                console.warn('[useAuthSession] Error en callback onError:', callbackError);
            }
        }
    }, [onError]);

    /**
     * Guarda credenciales de forma segura
     * @param {string} email - Email del usuario
     * @param {string} password - Contraseña del usuario
     * @returns {Promise<boolean>} true si se guardaron correctamente
     */
    const saveCredentials = useCallback(async (email, password) => {
        try {
            if (!email || !password) {
                throw new Error('Email y contraseña son requeridos');
            }

            const credentials = JSON.stringify({ email, password });
            await SecureStore.setItemAsync(STORAGE_KEYS.CREDENTIALS, credentials);
            setHasStoredCredentials(true);
            return true;
        } catch (err) {
            handleError(err, 'Error al guardar credenciales', false);
            return false;
        }
    }, [handleError]);


    /**
     * Elimina credenciales guardadas
     * @returns {Promise<boolean>} true si se eliminaron correctamente
     */
    const clearCredentials = useCallback(async () => {
        try {
            await SecureStore.deleteItemAsync(STORAGE_KEYS.CREDENTIALS);
            setHasStoredCredentials(false);
            return true;
        } catch (err) {
            handleError(err, 'Error al eliminar credenciales', false);
            return false;
        }
    }, [handleError]);

    /**
     * Verifica las capacidades biométricas del dispositivo
     * @returns {Promise<BiometricCheckResult>} Resultado de la verificación
     */
    const checkBiometrics = useCallback(async () => {
        try {
            // Verificar si el hardware soporta biometría
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            if (!hasHardware) {
                setBiometricType(null);
                return {
                    available: false,
                    type: null,
                    error: 'El dispositivo no tiene hardware biométrico'
                };
            }

            // Verificar si hay biometría registrada
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (!isEnrolled) {
                setBiometricType(null);
                return {
                    available: false,
                    type: null,
                    error: 'No hay biometría registrada en el dispositivo'
                };
            }

            // Obtener tipos soportados
            const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
            if (!supportedTypes || supportedTypes.length === 0) {
                setBiometricType(null);
                return {
                    available: false,
                    type: null,
                    error: 'No hay tipos de autenticación biométrica disponibles'
                };
            }

            const primaryType = supportedTypes[0];
            setBiometricType(primaryType);

            return {
                available: true,
                type: primaryType
            };
        } catch (err) {
            setBiometricType(null);
            handleError(err, 'Error al verificar capacidades biométricas', false);
            return {
                available: false,
                type: null,
                error: err.message || 'Error desconocido al verificar biometría'
            };
        }
    }, [handleError]);

    /**
     * Guarda la sesión de forma segura
     * @param {Session} sessionData - Datos de sesión de Supabase
     * @returns {Promise<boolean>} true si se guardó correctamente
     */
    const saveSession = useCallback(async (sessionData) => {
        try {
            if (!sessionData) {
                throw new Error('Datos de sesión inválidos');
            }

            await SecureStore.setItemAsync(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
            setSession(sessionData);
            setAuthState('authenticated');

            // Notificar éxito
            if (onAuthSuccess) {
                try {
                    onAuthSuccess(sessionData);
                } catch (callbackError) {
                    console.error('[useAuthSession] Error en callback onAuthSuccess:', callbackError);
                }
            }

            return true;
        } catch (err) {
            handleError(err, 'Error al guardar la sesión');
            return false;
        }
    }, [handleError, onAuthSuccess]);


    /**
     * Recuerda el último método de inicio de sesión
     * @param {LoginMethod} method - Método de login a recordar
     */
    const rememberLoginMethod = useCallback(async (method) => {
        try {
            await SecureStore.setItemAsync(STORAGE_KEYS.LAST_LOGIN, method);
            setLoginMethod(method);
        } catch (err) {
            handleError(err, 'Error al guardar el método de inicio de sesión', false);
        }
    }, [handleError]);

    /**
     * Realiza el inicio de sesión biométrico
     * @returns {Promise<Session | null>} Sesión si el login fue exitoso, null si falló
     */
    const biometricLogin = useCallback(async () => {
        setAuthState('authenticating');
        setError(null);

        try {
            if(!settings?.useBiometric) {
                throw new Error("No has activado el uso biométrico");
            } 
            // Verificar disponibilidad biométrica
            const biometricCheck = await checkBiometrics();
            if (!biometricCheck.available) {
                throw new Error(biometricCheck.error || 'La biometría no está disponible');
            }

            // Obtener credenciales guardadas
            const credentials = await getCredentials();
            console.log(credentials);
            if (!credentials) {
                throw new Error('No hay credenciales guardadas. Inicia sesión primero con tu email y contraseña.');
            }

            // Realizar autenticación biométrica
            const authResult = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Autentícate para acceder a tu cuenta',
                subtitleMessage: 'Usa tu huella dactilar o Face ID',
                fallbackLabel: 'Usar código',
                cancelLabel: 'Cancelar',
                disableDeviceFallback: false,
            });

            if (!authResult.success) {
                if (authResult.error === 'UserCancel') {
                    throw new Error('Autenticación cancelada por el usuario');
                }if (authResult.error === 'UserFallback') {
                    throw new Error('El usuario eligió usar el código de respaldo');
                }
                    throw new Error(authResult.error || 'La autenticación biométrica falló');
            }

            // Realizar login con credenciales guardadas
            const { data, error: loginError } = await supabase.auth.signInWithPassword(credentials);

            if (loginError) {
                throw loginError;
            }

            if (!data?.session || !data?.user) {
                throw new Error('No se pudo iniciar sesión con las credenciales guardadas');
            }

            if (!data.user.email_confirmed_at) {
                throw new Error('Tu correo electrónico no ha sido confirmado');
            }

            await rememberLoginMethod('biometric');

            // Notificar éxito biométrico
            if (onBiometricSuccess) {
                try {
                    onBiometricSuccess(data.session);
                } catch (callbackError) {
                    console.error('[useAuthSession] Error en callback onBiometricSuccess:', callbackError);
                }
            }

            return data.session;
        } catch (err) {
            let errorMessage = 'Error en la autenticación biométrica';

            if (err.message?.includes('cancelada')) {
                errorMessage = 'Autenticación cancelada';
            } else if (err.message?.includes('credenciales guardadas')) {
                errorMessage = 'Credenciales no válidas. Inicia sesión con email nuevamente.';
            } else if (err.message) {
                errorMessage = err.message;
            }

            handleError(err, errorMessage);

            if (onAuthError) {
                try {
                    onAuthError(err);
                } catch (callbackError) {
                    console.error('[useAuthSession] Error en callback onAuthError:', callbackError);
                }
            }

            return null;
        }
    }, [checkBiometrics, saveSession, rememberLoginMethod, handleError, onBiometricSuccess, onAuthError, settings]);

    /**
     * Cierra la sesión del usuario
     * @returns {Promise<boolean>} true si el logout fue exitoso
     */
    const logout = useCallback(async () => {
        try {
            // Cerrar sesión en Supabase
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) {
                console.warn('[useAuthSession] Error al cerrar sesión en Supabase:', signOutError.message);
            }
        } catch (err) {
            console.warn('[useAuthSession] Excepción al cerrar sesión en Supabase:', err);
        }

        // Limpiar estado local
        setAuthState('idle');
        setSession(null);
        setLoginMethod('none');
        setError(null);

        // Limpiar almacenamiento seguro
        const cleanupTasks = [
            SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION),
            SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_LOGIN),
            SecureStore.deleteItemAsync(STORAGE_KEYS.BIOMETRIC_AUTH),
            clearCredentials(),
        ];

        try {
            await Promise.allSettled(cleanupTasks);
            return true;
        } catch (err) {
            console.warn('[useAuthSession] Error durante la limpieza del logout:', err);
            return false;
        }
    }, [clearCredentials]);

    /**
     * Inicializa el estado de autenticación al montar el componente
     */
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Verificar biometría disponible
                await checkBiometrics();
            } catch (err) {
                console.error('[useAuthSession] Error durante inicialización:', err);
                setAuthState('error');
                setError('Error al inicializar la autenticación');
            }
        };

        initializeAuth();
    }, [checkBiometrics]);


    // Retornar API del hook
    return {
        // Estado
        session,
        authState,
        loginMethod,
        biometricType,
        error,
        hasStoredCredentials,

        // Funciones principales
        biometricLogin,
        logout,
        clearError,

        // Funciones auxiliares
        rememberLoginMethod,
        checkBiometrics,

        // Estados derivados
        isAuthenticated: authState === 'authenticated',
        isBiometricAvailable: biometricType !== null,
        isLoading: authState === 'authenticating',
    };
}