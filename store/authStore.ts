import type {
  AuthChangeEvent,
  Session,
  Subscription,
  User,
} from "@supabase/supabase-js";
// 1. Import Vexo
import { identifyDevice } from "vexo-analytics";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "../lib/storagev2";
import { supabase } from "../lib/supabase";
import { ensureUserProfile } from "../lib/utils/ensureUserProfile";
import { useHomeEventsStore } from "./homeEventsStore";
import { useNotificationStore } from "./notificationStore";

function identifyDeviceSafe(identifier: string | null) {
  try {
    identifyDevice(identifier);
  } catch (error) {
    console.warn("Vexo identifyDevice failed; auth continues", error);
  }
}

async function ensureUserProfileSafe(user: User | null) {
  if (!user) return;
  try {
    await ensureUserProfile(user);
  } catch (error) {
    console.warn("No se pudo asegurar el perfil público del usuario", error);
  }
}

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuth: boolean;
  isGuest: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  cleanup: () => void;
}

let authSubscription: Subscription | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      isAuth: false,
      isGuest: false,
      isLoading: true,
      isInitialized: false,

      setSession: (session) => {
        const user = session?.user ?? null;
        const isGuest = user?.user_metadata?.email === "guest@example.com";
        void ensureUserProfileSafe(user);

        // 2. Identify with Email
        if (user?.email) {
          // If it's the shared guest account, you might want to keep them anonymous
          // so they don't all get merged into one user profile.
          if (user.email === "guest@example.com") {
            identifyDeviceSafe(null);
          } else {
            identifyDeviceSafe(user.email);
          }
        } else {
          identifyDeviceSafe(null);
        }

        set({
          session,
          user,
          isAuth: !!session,
          isGuest,
          isLoading: false,
        });
      },

      initialize: async () => {
        if (get().isInitialized) {
          return;
        }

        // FIX 1: registrar el listener ANTES de cualquier await que pueda fallar.
        // Antes vivía dentro del try{} al final — si getSession() lanzaba (red,
        // timeout), el catch saltaba sin registrarlo y la app quedaba sorda a los
        // cambios de auth (login no redirigía hasta reiniciar).
        if (!authSubscription) {
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, session: Session | null) => {
              if (!session) {
                handleLogout();
              }

              const user = session?.user ?? null;
              const isGuest =
                user?.user_metadata?.email === "guest@example.com";
              void ensureUserProfileSafe(user);

              if (user?.email) {
                if (user.email === "guest@example.com") {
                  identifyDeviceSafe(null);
                } else {
                  identifyDeviceSafe(user.email);
                }
              } else {
                identifyDeviceSafe(null);
              }

              set({
                session,
                user,
                isAuth: !!session,
                isGuest,
                isLoading: false,
              });
            },
          );

          authSubscription = subscription;
        }

        // Use cached session immediately if available
        const cachedSession = get().session;
        if (cachedSession?.user?.email) {
          if (cachedSession.user.email === "guest@example.com") {
            identifyDeviceSafe(null);
          } else {
            identifyDeviceSafe(cachedSession.user.email);
          }
          set({ isInitialized: true, isLoading: false });
        }

        try {
          // FIX 2: timeout defensivo. Si getSession() cuelga (red flaky), no
          // bloqueamos el bootstrap indefinidamente — la app queda en negro
          // porque App.tsx renderiza null mientras isInitialized sea false.
          const TIMEOUT_MS = 5000;
          const sessionResult = await Promise.race([
            supabase.auth
              .getSession()
              .then((r) => ({ kind: "ok" as const, ...r })),
            new Promise<{ kind: "timeout" }>((resolve) =>
              setTimeout(() => resolve({ kind: "timeout" }), TIMEOUT_MS),
            ),
          ]);

          if (sessionResult.kind === "timeout") {
            // Sin respuesta a tiempo: mantenemos la cache (si había) y
            // dejamos que el listener corrija después si el token caducó.
            set({ isInitialized: true, isLoading: false });
            return;
          }

          const {
            data: { session },
            error,
          } = sessionResult;

          if (error) {
            handleLogout();
            identifyDeviceSafe(null);
            set({
              session: null,
              user: null,
              isAuth: false,
              isGuest: false,
              isLoading: false,
              isInitialized: true,
            });
            return;
          }

          const user = session?.user ?? null;
          const isGuest = user?.user_metadata?.email === "guest@example.com";
          void ensureUserProfileSafe(user);

          if (user?.email) {
            if (user.email === "guest@example.com") {
              identifyDeviceSafe(null);
            } else {
              identifyDeviceSafe(user.email);
            }
          } else {
            identifyDeviceSafe(null);
          }

          set({
            session,
            user,
            isAuth: !!session,
            isGuest,
            isLoading: false,
            isInitialized: true,
          });
        } catch (error) {
          // FIX 3: no desloguear por errores de red. Antes se reseteaba
          // session/isAuth/... a null/false, dejando al usuario afuera
          // incluso teniendo cache válida. Ahora solo destrabamos el render.
          set({ isInitialized: true, isLoading: false });
        }
      },

      signOut: async () => {
        try {
          set({ isLoading: true });
          // 6. Reset identity before signing out
          identifyDeviceSafe(null);

          const { error } = await supabase.auth.signOut();
          if (error) throw error;

          handleLogout();

          set({
            session: null,
            user: null,
            isAuth: false,
            isGuest: false,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      cleanup: () => {
        if (authSubscription) {
          authSubscription.unsubscribe();
          authSubscription = null;
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        session: state.session,
        user: state.user,
        isAuth: state.isAuth,
        isGuest: state.isGuest,
      }),
    },
  ),
);

export const useIsAuth = () => useAuthStore((state) => state.isAuth);
export const useIsGuest = () => useAuthStore((state) => state.isGuest);
export const useIsLoading = () => useAuthStore((state) => state.isLoading);
export const useSession = () => useAuthStore((state) => state.session);

export const useAuthUser = () => {
  const user = useAuthStore((state) => state.user);
  const isAuth = useIsAuth();

  if (!isAuth || !user) {
    throw new Error(
      "useAuthenticatedUser must be used within authenticated context",
    );
  }
  return user;
};

export const getUserID = () => {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("User not found");
  return user.id;
};

const handleLogout = () => {
  useHomeEventsStore.getState().resetAllEvents();
  useNotificationStore.getState().resetUnread();
};
