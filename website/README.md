# Archivos públicos de serviciosya.site

Estos archivos deben copiarse respetando sus rutas desde la raíz pública del
hosting. Los documentos de `.well-known` habilitan Android App Links y iOS
Universal Links; las dos páginas son la alternativa web cuando la app no está
instalada.

`Terminos-y-condiciones.php`, `politicas-de-privacidad.php`,
`includes/legal-document.php` y `legal-documents.json` forman la copia pública
de los documentos definidos en `lib/legal/documents.ts`. El JSON se regenera
con `npm run legal:export-public` y se valida con
`npm run legal:check-public`; no debe editarse manualmente.

No deben servirse con redirecciones y los JSON deben conservar contenido JSON.
Los archivos `.htaccess` incluidos mantienen el tipo MIME requerido y permiten
que los enlaces con código, como `/invite/ABC123`, abran la página alternativa.
