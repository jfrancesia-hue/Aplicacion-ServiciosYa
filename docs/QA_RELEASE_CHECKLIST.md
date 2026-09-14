# Control previo a una prueba interna

Antes de generar un AAB se ejecuta `npm run qa:release`. La prueba interna no
se publica si falla TypeScript, la suite de regresión, el contrato con
ServiciosYa, la sincronización legal, Expo Doctor o la exportación Android.

Además, el recorrido funcional se prueba con cuentas QA y datos descartables:

1. Inicio de sesión como cliente, cierre de sesión e inicio como prestador (y
   viceversa), comprobando que no se hereden perfil, rol ni datos privados.
2. Ubicación automática y manual en una provincia fuera de Córdoba; búsqueda
   por categoría limitada a esa provincia.
3. Pedido guiado por MICA hasta recibir presupuestos, sin preguntas repetidas.
4. Publicación manual y aparición del pedido en Ofertas de un prestador de la
   misma categoría y provincia.
5. Envío de presupuesto con modalidad, total y aviso operativo; conversación
   previa, bloqueo de teléfono/enlace/precio libre y envío de mensaje permitido.
6. Elección del presupuesto, comisión exacta del 10%, modal operativo y creación
   de preferencia de Mercado Pago sin completar una compra QA.
7. Apertura de trabajos, agenda, notificaciones, perfil y configuración sin
   pantallas vacías ni errores de navegación.

Los usuarios, mensajes, publicaciones, presupuestos y pagos pendientes creados
durante QA se eliminan al finalizar el recorrido.
