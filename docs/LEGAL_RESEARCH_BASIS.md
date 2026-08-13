# Base normativa de los documentos legales de Servicios Ya

Versión integrada: `legal-2026-08-12-v2`.

Los textos vigentes dentro de la aplicación se encuentran en
`lib/legal/documents.ts`. Esta nota registra las fuentes y decisiones de
redacción; no agrega condiciones distintas a las que ve el usuario.

## Normativa consultada

- [Ley 24.240 de Defensa del Consumidor, texto actualizado](https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion): información clara, trato digno, oferta, rescisión por el mismo medio, revocación, cláusulas abusivas y responsabilidad legal no renunciable.
- [Código Civil y Comercial de la Nación, texto actualizado](https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975/actualizacion): contratos por adhesión, contratos electrónicos y de consumo, derecho de revocación, interpretación favorable al consumidor y jurisdicción.
- [Ley 25.326 de Protección de los Datos Personales, texto actualizado](https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion): calidad, consentimiento, información, seguridad, confidencialidad, cesión, transferencias y derechos de los titulares.
- [Ley 25.506 de Firma Digital, texto actualizado](https://www.argentina.gob.ar/normativa/nacional/ley-25506-70749/actualizacion): eficacia del documento y de la firma electrónica, y conservación de registros digitales.
- [Disposición 954/2025](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-954-2025-417152/texto): botones de arrepentimiento y baja visibles en el primer acceso, código de gestión dentro de veinticuatro horas y canales de atención.
- [Disposición 3/2026](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-3-2026-423007/texto): permite pasos razonables destinados exclusivamente a verificar identidad y seguridad en las solicitudes de arrepentimiento y baja.
- [Derechos sobre datos personales, AAIP](https://www.argentina.gob.ar/aaip/datospersonales/derechos): plazos de diez días corridos para acceso y cinco días hábiles para rectificación, actualización o supresión.
- [Transferencias internacionales, AAIP](https://www.argentina.gob.ar/transferencias-internacionales): países adecuados y garantías necesarias cuando intervienen proveedores en otros países.
- [Registro Nacional de Bases de Datos Personales, AAIP](https://www.argentina.gob.ar/aaip/datospersonales/tramites): inscripción y actualización del responsable de bases privadas.

## Criterios aplicados

1. La comisión se define como el precio del servicio digital de conexión y
   confirmación. No se presenta como adelanto, seña ni pago del trabajo.
2. La intermediación se describe con precisión, sin una exención absoluta de
   responsabilidad ni renuncia de derechos del consumidor.
3. Los presupuestos por hora y día siempre incluyen un total de referencia para
   calcular el 10% y distinguir estimaciones de topes.
4. MICA y las transcripciones se describen como asistencia automatizada falible;
   los puntos esenciales requieren confirmación escrita y las decisiones
   relevantes admiten intervención humana.
5. El derecho de revocación no se declara renunciado. La posible excepción por
   servicio efectivamente utilizado se analiza según la operación concreta.
6. Las solicitudes públicas generan inmediatamente un código, aunque la persona
   no tenga una sesión iniciada, y llegan al panel operativo.
7. Los antecedentes penales no se intentan legitimar mediante consentimiento:
   se detuvieron nuevas cargas porque el artículo 7.4 de la Ley 25.326 reserva su
   tratamiento a autoridades públicas competentes.
8. Los nuevos documentos de identidad y credenciales profesionales se almacenan
   en un bucket privado; la búsqueda pública sólo recibe un indicador, nunca el
   archivo o su enlace.
9. La aceptación registra usuario, conjunto documental, versiones, fuente,
   fecha y hora. Los usuarios existentes deben aceptar la nueva versión antes de
   continuar.
