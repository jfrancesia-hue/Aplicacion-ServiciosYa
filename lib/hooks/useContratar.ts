import { useFocusEffect } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Servicio } from "../../types/servicios";
import { supabase } from "../supabase";
import { sendStandardWorkPush } from "../utils/urgentWorkNotification";
import { isGuest } from "../utils/user";
import vexo from "../vexo";
import { useSuspenseProfile } from "./useUser";

export const CONTRATAR_ERRORS = {
  GUEST_USER: "Los usuarios invitados no pueden contratar servicios.",
  NO_CREDITS: "No tenés créditos disponibles.",
  ALREADY_HIRED: "Este servicio ya fue contratado.",
  DECREMENT_CREDIT_FAILED: "Error al descontar crédito.",
  PUSH_NOTIFICATION_FAILED: "Error enviando notificación push (non-critical):",
};

export interface UseContratarProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook personalizado para manejar la lógica de contratación de un servicio.
 *
 * Este hook encapsula la mutación para contratar un servicio, realizando las siguientes acciones:
 * 1. Verifica que el usuario no sea 'guest' y tenga créditos suficientes.
 * 2. Comprueba que el servicio no haya sido contratado previamente por el mismo usuario.
 * 3. Crea un registro en `servicios_contratados`.
 * 4. Crea una notificación en la base de datos para el proveedor del servicio.
 * 5. Descuenta un crédito del usuario contratante.
 * 6. Envía una notificación push al proveedor del servicio (si tiene un token de expo).
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

      const { data: contratado } = await supabase // verificar si el servicio ya fue contratado
        .from("servicios_contratados")
        .select("id")
        .eq("servicio_id", servicio.id)
        .eq("contratante_id", user.id)
        .single();
      if (contratado) {
        throw new Error(CONTRATAR_ERRORS.ALREADY_HIRED);
      }

      if (!servicio.user_id) {
        throw new Error("Este servicio no tiene prestador asociado.");
      }

      const contratanteId = user.id;
      const mensaje = `Un usuario ha solicitado tu servicio: ${servicio.titulo}`;

      // 1. Insertar en servicios_contratados
      await supabase
        .from("servicios_contratados")
        .insert([
          {
            servicio_id: servicio.id,
            contratante_id: contratanteId,
            contratado_id: servicio.user_id,
          },
        ])
        .throwOnError();

      // 2. Insertar en notificaciones
      await supabase
        .from("notificaciones")
        .insert({
          receptor_id: servicio.user_id,
          emisor_id: contratanteId,
          mensaje,
          servicio_id: `${servicio.id}`,
        })
        .throwOnError();

      vexo.contratar(servicio.id);

      try {
        const { data: recipient } = await supabase
          .from("usuarios")
          .select("expo_token")
          .eq("id", servicio.user_id)
          .maybeSingle();
        await sendStandardWorkPush({
          to: recipient?.expo_token,
          title: "Nueva solicitud de servicio",
          body: `Un cliente solicitó tu servicio: ${servicio.titulo}.`,
          data: { screen: "MisServicios", params: { screen: "Solicitudes" } },
        });
      } catch (pushError) {
        console.log(CONTRATAR_ERRORS.PUSH_NOTIFICATION_FAILED, pushError);
      }
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
