# Estado de implementación · llamada con Facundo

Última actualización: 14 de septiembre de 2026.

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
- Outbox de correo transaccional idempotente con Resend configurado para enviar
  desde `Servicios Ya <notificaciones@serviciosya.site>`; conserva los eventos
  ante fallos temporales del proveedor.
- Estado de correo y push visible en el panel operativo, incluyendo eventos en
  espera y fallos definitivos, sin exponer secretos.
- Procesadores automáticos de correo y urgencias autenticados con un secreto
  generado dentro de Supabase Vault; las llamadas públicas son rechazadas.
- Urgencia explícita separada del chat normal: respuesta aceptar/rechazar, recordatorio a los 10 minutos, vencimiento a los 20 y reasignación por rubro y zona.
- Registro auditable de urgencias incumplidas y política A activa: tres en treinta
  días, suspensión inicial de 7 días y reincidencias de 14 y 30 días dentro de
  una ventana de 90 días.
- Administración de la disciplina desde el panel de Agustín, con confirmación,
  métricas e historial de cada cambio. La base impide configurar un SLA mayor a
  20 minutos.
- Calificación bilateral sobre trabajos confirmados. Una reseña aislada no sanciona automáticamente.
- Resumen operativo antes de enviar y aceptar presupuestos, con versión y hora registradas al iniciar el pago.
- Enlaces legales sincronizados en producción con los documentos vigentes de
  la app y eliminación del descargo absoluto que figuraba en el registro del
  cliente.
- Términos y Política de Privacidad consolidados dentro de la app, con copia web
  complementaria, versión y aceptación electrónica auditables.
- Botones públicos de arrepentimiento y baja desde el primer acceso, código de
  gestión inmediato y cola visible en el panel operativo de Agustín.
- Documentos nuevos de identidad y matrícula en almacenamiento privado; la
  búsqueda no expone archivos ni enlaces. Se bloquearon nuevas cargas de
  antecedentes penales.
- Corrección desplegada de participantes canónicos del chat en mensajes,
  urgencias y confirmación de pagos.
- Android alineado en versión `96.0.0` / `versionCode 96` y perfil EAS para pista interna.
- Protección contra contraseñas filtradas activada en Supabase Auth.
- Base actualizada a PostgreSQL `17.6.1.166` estable: `pgjwt` retirada sin
  dependencias, RPC heredada corregida a `bigint` y retención de 30 días para
  el historial de `pg_cron`.
- Data API recuperada después de la actualización eliminando la referencia
  histórica a un esquema retirado e inexistente; REST y Auth volvieron a
  responder correctamente.

## Acciones manuales de Agustín

Expo/EAS, Google Play Console y el alta manual de Facundo quedan a cargo de
Agustín. El correo transaccional ya no requiere configuración adicional.

## Evidencia de cierre técnico

- `npm test`: 82 pruebas aprobadas.
- `npm run typecheck`: sin errores.
- Migraciones remotas alineadas hasta `20260914184911`.
- Funciones `operational-dashboard`, `create-payment-preference`,
  `process-transactional-notifications` y `process-urgent-work-alerts`
  desplegadas.
- Funciones `available-providers` versión 9 y `operational-dashboard` versión 8
  desplegadas para la protección documental y la nueva cola de consumidores.
- El linter de los esquemas propios ya no informa referencias inválidas. Los
  diagnósticos restantes al incluir `gis` pertenecen a funciones internas de
  PostGIS y no a código de la aplicación.
- El advisor conserva una advertencia informativa sobre
  `get_mica_app_requests_for_worker`: su uso de `SECURITY DEFINER` es deliberado
  porque las tablas base niegan acceso directo; la RPC valida `auth.uid()`, rol,
  rubro y ubicación antes de devolver pedidos compatibles.
- La beta interna contra producción tiene un procedimiento QA explícito con la
  categoría aislada `Tester QA`; no debe generar pedidos ni avisos para
  prestadores reales.
