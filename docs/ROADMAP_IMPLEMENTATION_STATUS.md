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
- Enlaces legales existentes conservados como copia web y eliminación del
  descargo absoluto que figuraba en el registro del cliente.
- Términos y Política de Privacidad consolidados dentro de la app, con copia web
  complementaria, versión y aceptación electrónica auditables.
- Botones públicos de arrepentimiento y baja desde el primer acceso, código de
  gestión inmediato y cola visible en el panel operativo de Agustín.
- Documentos nuevos de identidad y matrícula en almacenamiento privado; la
  búsqueda no expone archivos ni enlaces. Se bloquearon nuevas cargas de
  antecedentes penales.
- Corrección desplegada de participantes canónicos del chat en mensajes,
  urgencias y confirmación de pagos.
- Android alineado en versión `95.0.0` / `versionCode 95` y perfil EAS para pista interna.

## Decisiones que requieren confirmación de Agustín

1. Disciplina de urgencias. La configuración propuesta es 3 incumplimientos en 30 días y suspensión de prioridad por 7 días. Está cargada pero `enforcement_enabled` permanece en `false` hasta aprobación. Agustín puede revisarla y activarla desde **Panel operativo > Urgencias y disciplina**, sin ejecutar SQL.

## Accesos externos necesarios

1. Correo transaccional: una cuenta Resend, dominio/remitente verificado y los secretos `RESEND_API_KEY` y `TRANSACTIONAL_EMAIL_FROM` en Supabase.

Expo/EAS, Google Play Console y el alta manual de Facundo quedan a cargo de
Agustín y fuera de esta ejecución.

## Comandos de cierre

Configurar el correo sin compartir la clave por chat:

```powershell
npx supabase secrets set RESEND_API_KEY="..." TRANSACTIONAL_EMAIL_FROM="Servicios Ya <avisos@dominio-verificado>"
```

Habilitar la política propuesta después de aprobarla desde **Panel operativo >
Urgencias y disciplina**. El panel muestra el impacto antes de guardar y registra
administrador, valores anteriores, valores nuevos y fecha.

## Evidencia de cierre técnico

- `npm test`: 41 pruebas aprobadas.
- `npm run typecheck`: sin errores.
- Migraciones remotas alineadas hasta `20260812190000`.
- Funciones `operational-dashboard`, `create-payment-preference`,
  `process-transactional-notifications` y `process-urgent-work-alerts`
  desplegadas.
- Funciones `available-providers` versión 9 y `operational-dashboard` versión 7
  desplegadas para la protección documental y la nueva cola de consumidores.
- El linter remoto ya no informa referencias inválidas en el flujo de chat o
  urgencias. Conserva advertencias heredadas de la extensión GIS y una RPC
  antigua no utilizada por la app (`incrementar_veces_contratado`).
