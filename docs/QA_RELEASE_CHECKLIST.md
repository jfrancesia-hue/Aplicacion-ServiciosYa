# Control previo a una prueba interna

Antes de generar un AAB se ejecuta `npm run qa:release`. La prueba interna no
se publica si falla TypeScript, la suite de regresión, el contrato con
ServiciosYa, la sincronización legal, Expo Doctor o la exportación Android.

Además, el recorrido funcional se prueba con cuentas QA y datos descartables:

1. Inicio de sesión como cliente, cierre de sesión e inicio como prestador (y
   viceversa), comprobando que no se hereden perfil, rol ni datos privados.
2. Sin permiso de ubicación: MICA explica por qué lo necesita, permite pedir el
   permiso GPS o ingresar manualmente ciudad y dirección dentro de Argentina. Una ubicación
   por IP o solamente el centro de una ciudad nunca habilita la publicación.
3. Con permiso GPS: se muestra la ciudad/provincia detectada y se puede
   corregirla. En la alternativa manual, comprobar que una dirección inválida
   no se acepte y que la válida se geocodifique antes de continuar.
4. Pedido guiado por MICA sin preguntas repetidas. No debe aceptar solamente un
   barrio ambiguo: siempre debe quedar ciudad y provincia confirmadas.
5. Cerrar y volver a abrir la app: la búsqueda activa, sus datos y su
   conversación deben restaurarse; no debe empezar otro chat debajo del pedido.
6. Acceso visible a “Mis búsquedas”, con historial, estado, ubicación y opción
   de retomar cada publicación. Un pedido cancelado/finalizado se ve cerrado y
   no admite nuevos presupuestos ni selección.
7. Publicación manual con GPS y con selección manual; aparición del pedido en
   Ofertas de un prestador de la misma categoría y provincia, priorizando la
   misma ciudad sin ocultar localidades cercanas de la provincia.
8. Envío de presupuesto con modalidad, total y aviso operativo; conversación
   previa, bloqueo de teléfono/enlace/precio libre y envío de mensaje permitido.
9. Elección del presupuesto, comisión exacta del 10%, modal operativo y creación
   de preferencia de Mercado Pago sin completar una compra QA.
10. Notificación de presupuesto con la app abierta, en segundo plano y cerrada:
    cada toque debe abrir una sola vez el pedido/chat correcto.
11. Apertura de trabajos, agenda, notificaciones, perfil y configuración sin
    pantallas vacías, datos de otra cuenta ni errores de navegación.
12. Cambiar el radio entre 1, 5, 10 y 50 km y comprobar que cambien los
    resultados. Dentro del mismo estado de disponibilidad, los prestadores se
    ordenan por distancia y la app muestra una distancia aproximada, nunca sus
    coordenadas exactas.
13. Confirmar que Android no pida ubicación ni notificaciones al abrir la app:
    cada permiso debe aparecer sólo después de tocar su acción explícita.
14. Cambiar de cliente a prestador y volver: los contadores de mensajes y
    notificaciones deben reiniciarse y no repetirse por suscripciones viejas.
15. Con un prestador marcado “Disponible ahora”, comprobar que el orden por
    distancia responda a su ubicación confirmada actual y no a una publicación
    histórica.

## Comprobaciones de infraestructura antes del AAB

- Las migraciones `release_gate_security_hardening`,
  `exact_request_location_matching`, `release_gate_reconciliation` y
  `trigger_role_hardening` y `confirm_legacy_request_location` deben figurar
  aplicadas en el proyecto Supabase
  `soluciones-ya` (`dhhhftzdfpqthzvkrqoz`).
- `available-providers` debe estar activa en la versión 19 o posterior, con
  filtro por radio, prioridad por ubicación online y sin devolver coordenadas.
- Antes de desplegar `mica-chat`, confirmar que Supabase tenga
  `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` reales.
- Antes de desplegar `mercadopago-webhook`, confirmar que Supabase tenga
  `MERCADOPAGO_WEBHOOK_SECRET` y `MERCADOPAGO_ACCESS_TOKEN` reales; luego probar
  una notificación firmada de Mercado Pago.
- Antes de habilitar audios, probar grabación, reproducción y permisos en un
  Android físico. La versión actual bloquea audios antes del pago si no existe
  una transcripción segura.
- Revisar en el panel de Supabase MFA de administradores, límites de Auth y
  copias de seguridad/PITR. Revisar también que el monitoreo de errores tenga
  una credencial real configurada.

Los usuarios, mensajes, publicaciones, presupuestos y pagos pendientes creados
durante QA se eliminan al finalizar el recorrido.
