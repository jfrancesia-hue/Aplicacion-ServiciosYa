import { useFocusEffect } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Servicio } from "../../types/servicios";
import { supabase } from "../supabase";
import { isGuest } from "../utils/user";
import vexo from "../vexo";
import { useSuspenseProfile } from "./useUser";

export const CONTRATAR_ERRORS = {
  GUEST_USER: "Los usuarios invitados no pueden contratar servicios.",
  ALREADY_HIRED: "Este servicio ya fue contratado.",
};

export interface UseContratarProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook personalizado para manejar la lógica de contratación de un servicio.
 *
 * Este hook encapsula la mutación para contratar un servicio, realizando las siguientes acciones:
 * Verifica la sesión y delega la contratación atómica al RPC protegido.
 *
 * Maneja los callbacks `onSuccess` y `onError` y expone el estado de la mutación y los créditos del usuario.
 *
 * @param {UseContratarProps} [props] - Opciones para el hook, incluyendo callbacks de éxito y error.
 * @returns Un objeto con los créditos del usuario y las propiedades de la mutación de `react-query`.
 */
export default function useContratar({
  onSuccess,
  onError,
}: UseContratarProps = {}) {
  const user = useSuspenseProfile();
  // Cada vez que este activa el screen donde es utilizado este hook, se va actualizar el perfil del usuario
  useFocusEffect(
    useCallback(() => {
      if (!isGuest(user.rol)) {
        user.refetch();
      }
    }, [user.refetch]),
  );

  const contratarMutation = useMutation({
    mutationFn: async (servicio: Servicio) => {
      if (user.rol === "guest") {
        throw new Error(CONTRATAR_ERRORS.GUEST_USER);
      }

      if (!servicio.user_id) {
        throw new Error("Este servicio no tiene prestador asociado.");
      }

      const { error } = await supabase.rpc("hire_service", {
        p_service_id: servicio.id,
      });
      if (error) {
        if (error.message.includes("SERVICE_ALREADY_HIRED")) {
          throw new Error(CONTRATAR_ERRORS.ALREADY_HIRED);
        }
        throw error;
      }

      vexo.contratar(servicio.id);
    },
    onSuccess: async () => {
      onSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  return contratarMutation;
}
