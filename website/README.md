# Archivos públicos de serviciosya.site

Estos archivos deben copiarse respetando sus rutas desde la raíz pública del
hosting. Los documentos de `.well-known` habilitan Android App Links y iOS
Universal Links; las dos páginas son la alternativa web cuando la app no está
instalada.

No deben servirse con redirecciones y los JSON deben conservar contenido JSON.
Los archivos `.htaccess` incluidos mantienen el tipo MIME requerido y permiten
que los enlaces con código, como `/invite/ABC123`, abran la página alternativa.
