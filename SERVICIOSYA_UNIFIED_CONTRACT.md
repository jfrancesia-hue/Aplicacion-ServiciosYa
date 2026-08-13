# SERVICIOSYA_UNIFIED_CONTRACT.md — Web + App + Mica

Objetivo: que ServiciosYa no funcione como web por un lado y app por otro. La
fuente operativa común es el flujo Web/Mica sobre Supabase.

## Fuente de verdad operativa

- Prestadores operativos: `sy_perfiles` con `rol = prestador`.
- Pedidos reales de clientes/Mica: `nuevaOferta`.
- Presupuestos/respuestas de prestadores: `presupuestos`.
- Tracking operativo/outreach: endpoints y helpers del repo web en `webhook/`.

La app puede seguir usando tablas propias para experiencia móvil (`usuarios`, `servicios`, `servicios_contratados`, etc.), pero cuando algo tenga impacto operativo real debe sincronizarse con Web/Mica.

## Roles por canal

### Web

- Landing/comercial.
- Registro y perfil web.
- Panel/admin operativo.
- MICA/chat interno.
- Outreach a prestadores.
- Estado de pedidos, presupuestos, pagos y escalamiento humano.

### App

- Experiencia diaria del cliente/prestador.
- Publicar/editar servicios del prestador.
- Ver pedidos reales generados por Mica.
- Responder presupuestos o marcar no disponible.
- Notificaciones, chat, perfil, ubicación y pagos móviles.

### Mica

- Atiende pedidos desde la app y la web.
- Crea/actualiza `nuevaOferta`.
- Busca prestadores.
- Consulta presupuestos reales mediante la Edge Function autenticada
  `mica-order`.
- Al elegir un prestador, crea o reutiliza el chat interno y publica el
  presupuesto estructurado junto con un resumen visible para ambas partes.
- Puede intervenir a pedido dentro del chat para resumir acuerdos, interpretar
  transcripciones y proponer el siguiente paso.
- Debe quedar sincronizada con las respuestas que entren desde la app.

## Puente app ↔ web

Endpoints existentes en el repo web:

- `POST /api/app/sync-prestador.php`
- `POST /api/app/pedidos-disponibles.php`
- `POST /api/app/responder-pedido.php`
- `GET /api/app/estado-pedido.php?ofertaId=...&appUserId=...`

La app usa `lib/serviciosYaBridge.ts` para estos endpoints.

El hostname técnico continúa siendo `https://tooriserviciosya.com` por
compatibilidad de infraestructura. Esa URL es la única excepción donde puede
permanecer el nombre comercial retirado; módulos, variables y textos se nombran
ServiciosYa.

Variables requeridas para build/app:

```env
EXPO_PUBLIC_SERVICIOSYA_APP_API_BASE_URL=https://tooriserviciosya.com/api/app
# Fallback MVP opcional; la app intenta usar primero la sesión Supabase del usuario.
EXPO_PUBLIC_SERVICIOSYA_APP_SYNC_TOKEN=<mismo token compartido del webhook/.env>
```

> Seguridad actual: backend acepta JWT de Supabase Auth y valida que `appUserId` coincida. El token compartido queda como fallback operativo/MVP.

## Flujo unificado actual recomendado

1. Prestador se registra/completa perfil en app o web.
2. Si publica un servicio en app, la app intenta sincronizarlo a `sy_perfiles` vía `sync-prestador.php`.
3. Cliente pide servicio por MICA, el chat interno o la web.
4. Mica crea `nuevaOferta`.
5. Prestador ve pedidos compatibles en app → `pedidos-disponibles.php`.
6. Prestador responde presupuesto/NO desde app mediante `mica-order`; el
   endpoint `responder-pedido.php` queda como compatibilidad del flujo web.
7. Cliente recibe propuestas reales en MICA y elige cuál revisar mediante
   `mica-order`; esta elección todavía no acepta ni cobra el presupuesto.
8. MICA abre el chat interno y deja el presupuesto estructurado. Cliente y
   prestador pueden conversar o pedir cambios dentro del chat protegido.
9. El cliente acepta desde el presupuesto y paga la comisión vigente del 10%.
   Recién con el pago aprobado se confirma el trabajo y se libera el contacto.
10. Al terminar, el cliente confirma el resultado y califica. Si el prestador
    no se presenta o el trabajo no se realiza, MICA abre un reclamo y lo escala
    a la bandeja operativa del administrador sin reembolsar automáticamente.
11. El panel operativo muestra pagos, trabajos, moderación y reclamos reales.

## Regla de desarrollo

Antes de publicar Android/iOS/Web:

- Verificar que la rama/base sea la misma para web/app o que los cambios estén integrados.
- No publicar desde `main` si las mejoras están en `hotfix/optimizacion`.
- Probar al menos:
  - app abre standalone,
  - `Mis servicios` muestra estado puente,
  - web endpoints `api/app/*` pasan `php -l`,
  - un pedido de prueba puede ser listado/respondido sin enviar comunicaciones externas reales.

## Pendientes técnicos importantes

- Sustituir token compartido por JWT/Supabase Auth.
- Mantener la nomenclatura visual y técnica unificada como ServiciosYa.
- Crear migraciones/versionado formal del esquema operativo.
- Definir la política de resolución y reembolso de reclamos; hasta entonces los
  pagos quedan en estado `disputed` para revisión humana.
- Definir si `servicios` de app queda como catálogo del prestador o si se reemplaza progresivamente por `sy_perfiles.oficios`.
