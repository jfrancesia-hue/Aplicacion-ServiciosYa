# Control previo a una prueba interna

Antes de generar un AAB se ejecuta `npm run qa:release`. La prueba interna no
se publica si falla TypeScript, la suite de regresión, el contrato con
ServiciosYa, la sincronización legal, Expo Doctor o la exportación Android.

Además, el recorrido funcional se prueba con cuentas QA y datos descartables:

1. Inicio de sesión como cliente, cierre de sesión e inicio como prestador (y
   viceversa), comprobando que no se hereden perfil, rol ni datos privados.
2. Sin permiso de ubicación: MICA explica por qué lo necesita, permite pedir el
   permiso GPS o seleccionar manualmente ciudad y provincia. Una ubicación por
   IP no habilita la publicación sin confirmación del cliente.
3. Con permiso GPS: se muestra la ciudad/provincia detectada y se puede
   corregirla. Probar también barrio o zona de referencia sin domicilio exacto.
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

Los usuarios, mensajes, publicaciones, presupuestos y pagos pendientes creados
durante QA se eliminan al finalizar el recorrido.
