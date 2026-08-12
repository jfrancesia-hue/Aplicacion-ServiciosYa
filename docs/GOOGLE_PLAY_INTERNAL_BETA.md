# Beta interna Android · versión 95

La configuración del repositorio ya apunta a `com.alex_6775.appTrabajo`, versión
`95.0.0` y `versionCode 95`. El perfil `production` genera el AAB y el perfil de
submit `internal` lo publica en la pista de pruebas internas de Google Play.

## Accesos que debe aportar el propietario

1. Iniciar sesión en Expo con una cuenta que tenga acceso al proyecto
   `perezzz2003/appTrabajo`: `npx eas-cli login`.
2. Verificar que EAS tenga la credencial de Android y la service account de
   Google Play vinculadas: `npx eas-cli credentials --platform android`.
3. Confirmar el correo Google de Facundo para agregarlo a la lista o grupo de
   testers internos en Play Console.

## Publicación

```powershell
npm test
npm run typecheck
npx expo-doctor
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android --profile internal --latest
```

Después, en Play Console > Pruebas > Prueba interna, agregar el correo de
Facundo, guardar los cambios y compartirle el enlace de participación. No se
debe promover esta compilación a producción hasta completar el recorrido de
publicación, presupuesto, comisión, agenda, cierre, reclamo y urgencia.
