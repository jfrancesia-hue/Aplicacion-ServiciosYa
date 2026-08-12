# Estado de implementación · llamada con Facundo

Última actualización: 12 de agosto de 2026.

## Desplegado

- Tres canales del cliente: publicación manual, búsqueda por categorías y búsqueda guiada por MICA.
- Postulación del prestador como respuesta a una publicación, con presupuesto estructurado.
- Presupuestos por proyecto, hora o día y total de referencia para calcular la comisión.
- Comisión de conexión y confirmación del 10%; no se presenta como adelanto del trabajo.
- Conversación previa a la aceptación y bloqueo de teléfonos, emails, enlaces, redes y montos fuera del presupuesto.
- Transcripción obligatoria y control de audios antes del pago.
- Agenda posterior al pago: hasta tres opciones, selección por la otra parte y nuevas rondas para reprogramar.
- Panel global de trabajos y acciones pendientes.
- MICA como intake guiado de reclamos y derivación a la bandeja operativa de Agustín.
- Notificaciones in-app y push para pago, agenda, recordatorios, reprogramaciones y reclamos.
- Outbox de correo transaccional idempotente; conserva los eventos si el proveedor todavía no está configurado.
- Estado de correo y push visible en el panel operativo, incluyendo eventos en
  espera y fallos definitivos, sin exponer secretos.
- Procesadores automáticos de correo y urgencias autenticados con un secreto
  generado dentro de Supabase Vault; las llamadas públicas son rechazadas.
- Urgencia explícita separada del chat normal: respuesta aceptar/rechazar, recordatorio a los 10 minutos, vencimiento a los 20 y reasignación por rubro y zona.
- Registro auditable de urgencias incumplidas y política disciplinaria configurable.
- Administración de la disciplina desde el panel de Agustín, con confirmación,
  métricas e historial de cada cambio. La base impide configurar un SLA mayor a
  20 minutos.
- Calificación bilateral sobre trabajos confirmados. Una reseña aislada no sanciona automáticamente.
- Resumen operativo antes de enviar y aceptar presupuestos, con versión y hora registradas al iniciar el pago.
- Enlaces legales centralizados en el dominio vigente y eliminación del descargo
  absoluto que figuraba en el registro del cliente.
- Corrección desplegada de participantes canónicos del chat en mensajes,
  urgencias y confirmación de pagos.
- Android alineado en versión `95.0.0` / `versionCode 95` y perfil EAS para pista interna.

## Decisiones que requieren confirmación de Agustín

1. Disciplina de urgencias. La configuración propuesta es 3 incumplimientos en 30 días y suspensión de prioridad por 7 días. Está cargada pero `enforcement_enabled` permanece en `false` hasta aprobación. Agustín puede revisarla y activarla desde **Panel operativo > Urgencias y disciplina**, sin ejecutar SQL.
2. Texto legal definitivo. El modal actual es un resumen operativo prudente y aclara que no reemplaza términos y condiciones. Cualquier limitación de responsabilidad contractual debe provenir de revisión profesional.
   El documento público actual declara “TuEmpresa”, no identifica una jurisdicción concreta y fue actualizado el 19/06/2025; debe reemplazarse antes de promover la beta a producción.

## Accesos externos necesarios

1. Correo transaccional: una cuenta Resend, dominio/remitente verificado y los secretos `RESEND_API_KEY` y `TRANSACTIONAL_EMAIL_FROM` en Supabase.
2. Google Play: sesión Expo/EAS con acceso a `perezzz2003/appTrabajo` y credencial de service account de Play vinculada. Esta máquina no tiene sesión EAS ni keystore de carga local.
3. Tester: correo Google de Facundo para incorporarlo a la lista interna de Play Console.

## Comandos de cierre

Configurar el correo sin compartir la clave por chat:

```powershell
npx supabase secrets set RESEND_API_KEY="..." TRANSACTIONAL_EMAIL_FROM="Servicios Ya <avisos@dominio-verificado>"
```

Habilitar la política propuesta después de aprobarla desde **Panel operativo >
Urgencias y disciplina**. El panel muestra el impacto antes de guardar y registra
administrador, valores anteriores, valores nuevos y fecha.

Completar la beta:

```powershell
npx eas-cli login
npx eas-cli credentials --platform android
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile internal --latest
```

La guía ampliada está en `docs/GOOGLE_PLAY_INTERNAL_BETA.md`.

## Evidencia de cierre técnico

- `npm test`: 39 pruebas aprobadas.
- `npm run typecheck`: sin errores.
- Migraciones remotas alineadas hasta `20260812186000`.
- Funciones `operational-dashboard`, `create-payment-preference`,
  `process-transactional-notifications` y `process-urgent-work-alerts`
  desplegadas.
- El linter remoto ya no informa referencias inválidas en el flujo de chat o
  urgencias. Conserva advertencias heredadas de la extensión GIS y una RPC
  antigua no utilizada por la app (`incrementar_veces_contratado`).
