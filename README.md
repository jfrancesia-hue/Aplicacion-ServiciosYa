# ServiciosYa App

App móvil Expo/React Native para clientes y prestadores.

## Arquitectura operativa

Ver [`SERVICIOSYA_UNIFIED_CONTRACT.md`](./SERVICIOSYA_UNIFIED_CONTRACT.md).
Para preparar una entrega limitada a testers, seguir
[`INTERNAL_TEST_RELEASE.md`](./INTERNAL_TEST_RELEASE.md).

ServiciosYa usa Supabase como fuente de verdad para perfiles, pedidos,
presupuestos, pagos, agenda, reclamos y notificaciones. MICA opera mediante
Edge Functions autenticadas y los flujos protegidos de la app.

- `lib/serviceRequests.ts`
- `lib/micaOrder.ts`
- `lib/serviciosYaApi.ts`
- `lib/serviciosYaBridge.ts`
- `components/serviciosYa/PedidosMicaSection.tsx`

El puente con la web se conserva bajo nombres ServiciosYa. Por compatibilidad,
su hostname sigue siendo `https://tooriserviciosya.com`; esa URL es la única
excepción donde permanece el nombre comercial retirado.

## Validación

```powershell
npm run check:serviciosya-contract
npm run check:internal-release-env
npm run typecheck
npm test
npx expo-doctor
```

## Build actual

- Rama base funcional: `main`.
- Versión de app: `96.0.0`.
- Android `versionCode`: `96`.
- Nombre visible: `Servicios Ya`.
