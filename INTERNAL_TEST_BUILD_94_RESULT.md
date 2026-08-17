# ServiciosYa — Build interna Android 94

Fecha: 2026-08-17

## Resultado
Build EAS finalizada correctamente.

- Build ID: `1cec6bc9-8b6d-4000-a98b-a252aaaab8ed`
- Perfil: `internal`
- App version: `94.0.0`
- Android versionCode: `94`
- Estado: `FINISHED`
- Completada: `2026-08-17T21:17:51.967Z`

## Links
- Build EAS: https://expo.dev/accounts/perezzz2003/projects/appTrabajo/builds/1cec6bc9-8b6d-4000-a98b-a252aaaab8ed
- AAB: https://expo.dev/artifacts/eas/oFEWCksMmjzZOF_V4aVXWTlk3crJjtML6KNXBFcdc-s.aab

## Validaciones previas
- Tests: 62/62 OK
- TypeScript: OK
- Contrato ServiciosYa: OK
- Build internal autorizada contra Supabase producción mediante `EXPO_PUBLIC_INTERNAL_USES_PRODUCTION=true`.

## Importante
No se ejecutó submit a Google Play desde Anie. La build quedó generada en Expo/EAS para que Jorge la suba a prueba interna.

## Cambios locales pendientes
- `app.json`: version/versionCode 94
- `eas.json`: internal permite producción explícitamente
- `scripts/check_internal_release_env.js`: guard acepta `EXPO_PUBLIC_INTERNAL_USES_PRODUCTION=true`
- `tests/internal-release.test.mjs`: test actualizado a producción 93 → build 94
