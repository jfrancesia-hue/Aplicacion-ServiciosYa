import { customEvent } from "vexo-analytics";

export type paymentType = "registro_unico" | "plan"
export type loginType = "email" | "google" | "apple" | "huella" | "guest"
export type MarketplaceFunnelStep =
    | "location_ready"
    | "category_opened"
    | "providers_loaded"
    | "provider_profile_viewed"
    | "safe_chat_opened"
    | "availability_updated"
    | "basic_provider_registered"
    | "audio_sent"
    | "audio_transcribed"
    | "mica_intervention";


function contratar(id: number) {
    customEvent('contratar', { id });
}

function accept(id: string) {
    customEvent('aceptar_trabajo', { id });
}

function pago(type: paymentType, monto: number, currency = 'ARS') {
    customEvent('pago', {
        tipo: type,
        monto,
        currency
    });
}

function login(type: loginType) {
    customEvent('login', {
        tipo: type
    });
}

function servicio(nombre: string) {
    customEvent('servicio', {
        nombre
    });
}

function marketplace(
    step: MarketplaceFunnelStep,
    data: Record<string, string | number | boolean | null | undefined> = {},
) {
    const safeData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined && value !== null),
    ) as Record<string, string | number | boolean>;

    customEvent(`marketplace_${step}`, safeData);
}

export default {
    accept,
    pago,
    contratar,
    login,
    servicio,
    marketplace,
}
