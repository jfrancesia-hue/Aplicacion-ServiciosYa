# Prueba interna Android

Esta guía prepara ServiciosYa para validar publicaciones, chat y el pago de la
reserva del 10% antes de una publicación en producción.

## 1. Entorno de datos de la prueba

El perfil EAS `internal` genera un Android App Bundle para Google Play Internal
Testing. Actualmente está autorizado de forma explícita a usar el proyecto
Supabase de producción mediante `EXPO_PUBLIC_INTERNAL_USES_PRODUCTION=true`.
Por eso las pruebas deben hacerse sólo con cuentas identificadas de QA y sin
notificaciones masivas.

Si más adelante se crea un Supabase de staging, aplicar allí las migraciones y
funciones del repositorio, cargar en el environment `preview` de EAS la URL y
la clave publicable reales de ese proyecto, y cambiar
`EXPO_PUBLIC_INTERNAL_USES_PRODUCTION` a `false`.

Mientras se use producción, no editar ni borrar publicaciones de usuarios
reales.

## 2. Configurar Resend en el backend

La API key de Resend nunca se incluye en Expo ni en el APK/AAB. Primero hay que
verificar `serviciosya.site` en Resend con los registros DNS que indique el
proveedor. Luego se cargan en Supabase los secretos reales enumerados en
`.env.example`. No se copian secretos al repositorio ni a variables
`EXPO_PUBLIC_*`.

Configurar en Resend el webhook:

```text
https://dhhhftzdfpqthzvkrqoz.supabase.co/functions/v1/provider-email-webhook
```

## 3. Verificaciones antes del build

```powershell
npm test
npm run typecheck
npm run check:serviciosya-contract
npm run check:internal-release-env
```

La última comprobación debe ejecutarse con las variables del entorno interno
cargadas. EAS también la ejecuta automáticamente antes de instalar
dependencias.

## 4. Generar y enviar la build interna

```powershell
npm run build:android:internal
npm run submit:android:internal
```

Al enviar, seleccionar la build 97 recién generada. El perfil de envío usa el
track `internal`; no seleccionar el perfil `production`.

Agregar los correos de testers desde Google Play Console, sin versionarlos en
el repositorio.

## 5. Casos de prueba obligatorios

### Publicaciones

1. Cliente A crea una publicación identificada como QA.
2. Confirmar que se guarda una sola vez y conserva categoría, zona y detalle.
3. Prestador B compatible la ve una sola vez.
4. Cliente A no ve su propia publicación como oferta.
5. Prestador B responde y la respuesta no se duplica al refrescar.

### Chat y comentarios

1. Cliente y prestador intercambian mensajes desde cuentas distintas.
2. Verificar orden, persistencia y recarga de mensajes.
3. Proponer un presupuesto, pedir cambios y enviar una nueva versión.
4. Confirmar que teléfonos, enlaces y montos fuera del presupuesto siguen
   protegidos.

### Reserva del 10%

1. Crear un presupuesto con un monto fácil de comprobar.
2. Confirmar que el cliente ve precio del trabajo, reserva del 10% y total.
3. Usar únicamente usuarios y medios de pago de prueba de Mercado Pago.
4. Verificar que el webhook marque el pago aprobado una sola vez.
5. Confirmar que la agenda se habilita sólo después del pago.
6. Probar cancelación y reintegro sin duplicar operaciones.

### Higiene de datos

- Usar cuentas exclusivas de QA y descripciones con prefijo
  `[QA-INTERNAL-AAAA-MM-DD]`.
- Registrar los IDs creados durante la sesión.
- Limpiar exclusivamente los registros QA del proyecto activo al finalizar.
- No probar notificaciones masivas ni correos a prestadores reales.

## Criterio de salida

La build puede avanzar fuera del track interno únicamente cuando publicaciones,
chat, presupuesto, pago del 10%, agenda y cancelación pasen sin duplicados y
Resend esté autenticado con el dominio de ServiciosYa.
