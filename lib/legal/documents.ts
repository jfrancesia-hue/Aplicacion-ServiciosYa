export type LegalDocumentKind = "terms" | "privacy";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  kind: LegalDocumentKind;
  title: string;
  version: string;
  effectiveDate: string;
  summary: string;
  sections: LegalSection[];
};

const contact =
  "serviciosya.desarrollador@gmail.com o el canal de soporte y reclamos disponible dentro de la aplicación";

export const TERMS_DOCUMENT: LegalDocument = {
  kind: "terms",
  title: "Términos y Condiciones de Servicios Ya",
  version: "terms-2026-08-12-v2",
  effectiveDate: "12 de agosto de 2026",
  summary:
    "Regulan el acceso a Servicios Ya, la conexión entre clientes y prestadores, los presupuestos, la comisión del 10%, la coordinación del trabajo y el sistema de reclamos.",
  sections: [
    {
      title: "1. Identificación, aceptación y alcance",
      paragraphs: [
        `Servicios Ya es una plataforma digital de intermediación que permite que personas que necesitan un servicio —los clientes— encuentren y contacten a personas que lo ofrecen —los prestadores—. En estos Términos, “Servicios Ya”, “la Plataforma” o “nosotros” designa al operador del servicio identificado comercialmente como Servicios Ya. El canal electrónico vigente de contacto es ${contact}.`,
        "Al crear una cuenta, completar un perfil, publicar una necesidad, postularse, enviar o aceptar un presupuesto, pagar una comisión o utilizar cualquier función de la Plataforma, la persona declara haber leído y aceptado estos Términos y la Política de Privacidad. La aceptación se registra electrónicamente con la versión del documento, fecha, hora, usuario y contexto de aceptación.",
        "Estos Términos complementan los avisos particulares mostrados antes de enviar o aceptar un presupuesto y las condiciones informadas en cada operación. Si una condición particular negociada y registrada dentro del chat contradice una regla general sobre el alcance, precio, materiales, fecha o modalidad del trabajo, prevalece esa condición particular entre cliente y prestador. Ninguna disposición limita derechos irrenunciables reconocidos por la normativa aplicable.",
      ],
    },
    {
      title: "2. Personas habilitadas y cuentas",
      paragraphs: [
        "La Plataforma está destinada exclusivamente a personas de dieciocho años o más con capacidad para contratar. Quien actúe por una organización declara contar con facultades suficientes para obligarla.",
        "Cada persona debe proporcionar información cierta, actualizada y propia; proteger sus credenciales; y avisar de inmediato ante un acceso no autorizado. No se permite suplantar identidades, crear cuentas para terceros sin autorización, mantener cuentas destinadas a eludir suspensiones ni usar datos falsos para obtener una verificación.",
        "Servicios Ya puede solicitar verificaciones razonables de identidad, mayoría de edad, domicilio, matrícula o habilitación profesional cuando sean pertinentes. Una marca de “identidad verificada”, “documentación presentada” o similar sólo informa el control concreto indicado por la Plataforma: no certifica capacidad técnica, solvencia, ausencia de antecedentes ni calidad futura del trabajo.",
      ],
    },
    {
      title: "3. Formas de conexión",
      paragraphs: [
        "El cliente puede iniciar una búsqueda de tres maneras: publicar manualmente una necesidad para recibir postulaciones; buscar prestadores directamente por categoría y ubicación; o pedir a MICA que lo guíe para describir y publicar el pedido. La postulación de un prestador es una respuesta a una publicación y no constituye un canal independiente.",
        "Una publicación debe describir de buena fe el trabajo, categoría, zona, urgencia, restricciones y cualquier condición relevante. No puede incluir datos de contacto externos, contenido ilícito, discriminatorio, engañoso o ajeno a la contratación. El cliente puede cerrar o retirar una publicación mientras no exista una operación confirmada, sin afectar acuerdos ya aceptados.",
        "El prestador decide libremente si postularse y debe informar de manera clara su experiencia, disponibilidad y condiciones. La publicación, postulación o apertura de un chat no obliga a contratar. El vínculo operativo se confirma cuando el cliente acepta un presupuesto y el sistema verifica el pago de la comisión de conexión.",
      ],
    },
    {
      title: "4. Presupuestos y conversación previa",
      paragraphs: [
        "Los presupuestos se envían mediante el botón específico de presupuesto. Antes de aceptar, el cliente puede conversar, pedir aclaraciones o solicitar cambios dentro del chat. Un mensaje común que mencione un precio no sustituye un presupuesto estructurado y puede ser bloqueado para proteger la operación.",
        "El prestador puede presupuestar por proyecto, por hora o por día. Por proyecto debe indicar un importe cerrado o claramente delimitado. Por hora debe informar la tarifa, las horas estimadas y si el total de referencia es una estimación o un tope. Por día debe informar la tarifa, los días estimados y si el total de referencia es una estimación o un tope. En todos los casos debe existir un total de referencia sobre el cual se calcula la comisión.",
        "El presupuesto debe describir, según corresponda, alcance, tareas incluidas y excluidas, materiales, plazo estimado, garantía ofrecida, vigencia y observaciones. Salvo que se indique expresamente lo contrario, los materiales no se consideran incluidos. Los cambios posteriores deben quedar registrados y ser aceptados por ambas partes.",
        "En modalidades por hora o día, el total de referencia sirve para la comisión y para comparar propuestas. El precio final del trabajo puede variar sólo cuando exista una causa informada y un nuevo acuerdo entre cliente y prestador. Una diferencia posterior no modifica automáticamente la comisión ya pagada ni habilita a una parte a imponer unilateralmente un precio.",
      ],
    },
    {
      title: "5. Comisión de conexión del 10%",
      paragraphs: [
        "Cuando el cliente acepta un presupuesto, Servicios Ya cobra al cliente una comisión de conexión y confirmación equivalente al diez por ciento (10%) del total de referencia aceptado. El importe exacto se muestra antes de continuar al pago. La comisión es el precio del servicio digital de conexión, confirmación, desbloqueo del contacto, agenda y soporte operativo de la Plataforma.",
        "La comisión no es una seña ni un adelanto del trabajo del prestador. Servicios Ya no cobra ni custodia el saldo del servicio. El cliente y el prestador acuerdan directamente la forma y oportunidad de pago del trabajo, los materiales, viáticos, impuestos y diferencias finales. El cobro de la comisión no prueba que el trabajo ya fue ejecutado o pagado.",
        "El pago se procesa mediante Mercado Pago u otro proveedor informado en pantalla. Servicios Ya recibe el estado, identificadores y datos operativos necesarios para conciliar la transacción, pero no almacena los datos completos de la tarjeta. Una operación sólo se considera aprobada cuando el sistema de pago y la Plataforma la registran como tal.",
      ],
    },
    {
      title: "6. Chat protegido y prevención de elusión",
      paragraphs: [
        "Antes de la aprobación de la comisión, el chat bloquea o limita teléfonos, correos, enlaces, usuarios de redes sociales y otros datos destinados a trasladar la conversación fuera de la Plataforma. También exige que los importes se comuniquen mediante el botón de presupuesto. Estas medidas se aplican tanto a texto como a transcripciones de audio.",
        "No se permite fragmentar, codificar, alterar o esconder datos con la finalidad de eludir esos controles o evitar la comisión. La Plataforma puede rechazar el mensaje, advertir al usuario, limitar funciones o revisar patrones reiterados. Los filtros automáticos pueden producir falsos positivos; el usuario puede reformular el mensaje o utilizar el canal de soporte.",
        "Después de la aprobación, las partes pueden intercambiar datos necesarios para ejecutar el trabajo. Aun así, se recomienda conservar dentro de la app el alcance, cambios, fechas, confirmaciones y reclamos, porque los acuerdos externos pueden ser difíciles de verificar y quedan fuera de las herramientas operativas de Servicios Ya.",
      ],
    },
    {
      title: "7. Audios, transcripciones y MICA",
      paragraphs: [
        "El chat permite enviar audios. Antes del pago, el audio debe contar con una transcripción para aplicar los controles de contacto y precios. La transcripción puede ser automática y contener errores; el emisor puede corregirla. Los datos esenciales —precio, alcance, materiales, fecha, horario y dirección— sólo se consideran confirmados cuando quedan expresamente aceptados por escrito en la Plataforma.",
        "MICA es un asistente automatizado que ayuda a buscar servicios, ordenar conversaciones, resumir acuerdos y recopilar información inicial de reclamos. MICA no es una persona, no reemplaza asesoramiento profesional, no fija precios, no aprueba pagos, no decide definitivamente un reclamo y puede equivocarse. Los estados de pago, agenda, trabajo y reclamo son únicamente los registrados por el sistema.",
        "Cuando MICA interviene en un reclamo, puede hacer preguntas y generar un resumen para el equipo operativo. Las decisiones que afecten una suspensión relevante, un reclamo controvertido o una devolución admiten revisión humana.",
      ],
    },
    {
      title: "8. Agenda, confirmación y reprogramaciones",
      paragraphs: [
        "Luego de aprobarse la comisión, el prestador puede proponer hasta tres fechas y horarios concretos. El cliente elige una opción y la confirmación queda registrada. Las notificaciones y correos son recordatorios de cortesía: cada parte debe revisar la app y cumplir la fecha confirmada aunque una notificación no llegue por problemas del dispositivo, conectividad o proveedor externo.",
        "Para reprogramar, la parte interesada debe informar el motivo y proponer hasta tres nuevas opciones. La reprogramación sólo queda confirmada cuando la otra parte selecciona o acepta una opción dentro de la Plataforma. Mientras no exista aceptación, continúa vigente el último horario confirmado, salvo imposibilidad o acuerdo escrito en contrario.",
        "Las partes deben avisar con la mayor anticipación posible cualquier demora, imposibilidad o cambio. Reprogramaciones abusivas, reiteradas o destinadas a impedir el reclamo pueden afectar la reputación o dar lugar a medidas sobre la cuenta.",
      ],
    },
    {
      title: "9. Urgencias",
      paragraphs: [
        "Una solicitud marcada como urgente exige una respuesta explícita del prestador dentro del plazo mostrado, que nunca será superior a veinte minutos. Leer una notificación o abrir la app no cuenta como respuesta. El prestador puede aceptar o rechazar; rechazar dentro del plazo permite una reasignación rápida y no se considera un incumplimiento de respuesta.",
        "Si el plazo vence sin respuesta explícita, la Plataforma puede ofrecer el pedido a otro prestador y registrar una urgencia incumplida. Tres incumplimientos dentro de treinta días suspenden la prioridad por siete días. Si el prestador vuelve a alcanzar tres incumplimientos dentro de los noventa días posteriores a una sanción, la suspensión es de catorce días; las nuevas reincidencias dentro de esa ventana suspenden la prioridad por treinta días. Cada sanción consume un nuevo grupo de incumplimientos, queda auditada y puede solicitarse su revisión humana por soporte.",
        "La prioridad de urgencia mejora la distribución del pedido, pero no constituye un servicio de emergencias ni garantiza que exista un prestador disponible. Ante riesgos para la vida, salud, seguridad, incendios, fugas de gas u otras emergencias, el usuario debe contactar a los servicios públicos competentes.",
      ],
    },
    {
      title: "10. Ejecución del trabajo y obligaciones del prestador",
      paragraphs: [
        "El prestador actúa por cuenta propia e independiente. Debe contar con capacidad, herramientas, matrícula, permisos, seguros y habilitaciones exigibles para el servicio ofrecido; cumplir las reglas de seguridad y normas técnicas; emitir los comprobantes que correspondan; y asumir sus obligaciones fiscales, previsionales, laborales y frente a auxiliares que incorpore.",
        "El prestador debe presentarse en el lugar y horario acordados, respetar el alcance y precio aceptados, advertir riesgos antes de comenzar, pedir autorización para cambios y tratar con cuidado a las personas y bienes. No puede delegar un trabajo personal en un tercero no informado ni afirmar una verificación, título o experiencia que no posee.",
        "No existe relación laboral, sociedad, representación, franquicia, mandato general ni exclusividad entre Servicios Ya y el prestador. La Plataforma no dirige la técnica ni el modo material de ejecución. Esta caracterización no excluye responsabilidades que la ley atribuya imperativamente a Servicios Ya por sus propios servicios o por la relación de consumo.",
      ],
    },
    {
      title: "11. Obligaciones del cliente",
      paragraphs: [
        "El cliente debe describir la necesidad de forma suficiente, informar riesgos conocidos, facilitar un acceso seguro, contar con autorización sobre el inmueble o bien, mantener alejadas a personas o animales cuando sea necesario y pagar al prestador lo acordado por el trabajo efectivamente realizado.",
        "El cliente debe comprobar que el prestador y su matrícula sean adecuados cuando la actividad esté regulada, seguir advertencias de seguridad y no solicitar tareas ilícitas, peligrosas o distintas de las presupuestadas sin un nuevo acuerdo. Servicios Ya puede facilitar indicadores de perfil, pero la decisión final de contratación corresponde al cliente.",
      ],
    },
    {
      title: "12. Cierre, calificaciones y reputación",
      paragraphs: [
        "Después de la fecha confirmada, el cliente puede indicar que el trabajo se completó o iniciar un reclamo. Un trabajo confirmado como completado habilita una calificación de una a cinco estrellas y un comentario. El prestador también puede calificar al cliente una vez cerrado el trabajo.",
        "Las calificaciones deben basarse en una experiencia real, ser respetuosas y no incluir datos privados, amenazas, discriminación, publicidad ni acusaciones manifiestamente falsas. Servicios Ya puede moderar contenido que infrinja estas reglas, sin alterar legítimamente una opinión por ser negativa.",
        "La reputación puede mostrar promedios, cantidad de trabajos verificados, tiempos de respuesta y otros indicadores explicados en pantalla. Ningún puntaje garantiza una conducta futura. Las reseñas, por sí solas, no generan sanciones automáticas; pueden ser una señal para revisión junto con otros registros objetivos.",
      ],
    },
    {
      title: "13. Reclamos, inasistencia y trabajo no realizado",
      paragraphs: [
        "Si el prestador no se presenta, el trabajo acordado no se realiza o existe otro problema después de una comisión aprobada, el cliente puede abrir un reclamo desde el trabajo o chat confirmado. MICA recopila la información inicial y genera un número de caso; los casos que requieren intervención se derivan al equipo operativo y, cuando corresponde, a Agustín como responsable de resolución.",
        "Ambas partes deben conservar y aportar dentro de la app mensajes, presupuesto, agenda, fotos y explicaciones pertinentes. Servicios Ya puede pedir información adicional, poner el caso en revisión, contactar a las partes y registrar una resolución. La falta de respuesta puede resolverse con la evidencia disponible.",
        "Si se verifica que el prestador canceló, no se presentó o no realizó materialmente el trabajo por una causa atribuible a él, el cliente podrá elegir entre la devolución de la comisión de conexión o un crédito equivalente para una nueva conexión, sin perjuicio de otros derechos que le correspondan. Cuando el problema sea de calidad, alcance parcial, materiales, daños o diferencias sobre el saldo pagado directamente, la Plataforma facilitará el reclamo y podrá aplicar medidas sobre la cuenta, pero no administra automáticamente ese dinero.",
        "Si el cliente cancela después de que el contacto fue desbloqueado y el servicio digital de conexión fue efectivamente utilizado, la comisión no se devuelve por la mera cancelación, salvo que corresponda por derecho de revocación, incumplimiento de Servicios Ya o norma imperativa. Los reintegros aprobados se cursan, cuando sea posible, al medio original; los plazos de acreditación dependen del proveedor de pagos.",
      ],
    },
    {
      title: "14. Derecho de revocación y baja",
      paragraphs: [
        "Cuando corresponda una relación de consumo celebrada a distancia, el consumidor puede revocar su aceptación dentro de los diez días corridos previstos por la normativa, sin renunciar a ese derecho. La Plataforma debe ofrecer un BOTÓN DE ARREPENTIMIENTO visible y procesar la solicitud conforme a la ley. Puede realizar verificaciones razonables destinadas exclusivamente a confirmar identidad y seguridad.",
        "El ejercicio oportuno de la revocación libera a las partes de las obligaciones alcanzadas y da lugar a las restituciones legalmente aplicables. La normativa contempla excepciones, entre ellas el supuesto en que el servicio contratado ya fue efectivamente utilizado o consumido. Cada solicitud se analiza según el momento de la operación, el desbloqueo y uso real de la conexión y las normas vigentes; ninguna frase de estos Términos elimina derechos irrenunciables.",
        "El usuario puede solicitar la baja de su cuenta o servicio mediante el BOTÓN DE BAJA DE SERVICIO o la función de eliminar cuenta. Dentro de las veinticuatro horas se debe informar un código de identificación de la solicitud. La baja no borra registros que deban conservarse por pagos, reclamos, prevención de fraude, obligaciones legales o defensa de derechos, los cuales quedan restringidos a esas finalidades.",
      ],
    },
    {
      title: "15. Conductas prohibidas y medidas sobre cuentas",
      paragraphs: [
        "Está prohibido usar la Plataforma para fraude, acoso, discriminación, explotación, actividades ilegales, servicios que exijan una habilitación que no se posee, manipulación de reseñas, spam, malware, extracción masiva de datos, vulneración de seguridad, cobros engañosos o elusión deliberada de la comisión y controles de contacto.",
        "Ante un riesgo razonable, Servicios Ya puede bloquear contenido, limitar funciones, retirar publicaciones, pausar pagos no conciliados, suspender prioridad, suspender temporalmente una cuenta o cerrarla. La medida debe guardar relación con la gravedad, recurrencia, evidencia y riesgo. Salvo urgencia de seguridad, fraude o mandato legal, se informará el motivo general y se permitirá presentar una explicación por soporte.",
        "Las decisiones disciplinarias relevantes no se basan exclusivamente en una calificación ni en una inferencia de MICA. Los registros automáticos —por ejemplo, vencimiento de una urgencia sin respuesta— pueden iniciar una regla objetiva, pero existe revisión humana y auditoría administrativa.",
      ],
    },
    {
      title: "16. Rol y responsabilidad de Servicios Ya",
      paragraphs: [
        "Servicios Ya presta el servicio digital de publicación, búsqueda, comunicación, presupuesto, conexión, confirmación, agenda, notificaciones, reputación y gestión inicial de reclamos. Los trabajos son ofrecidos y ejecutados por prestadores independientes; la Plataforma no realiza reparaciones, instalaciones, cuidados ni las demás tareas publicadas, y no fija el precio final del trabajo.",
        "La Plataforma no garantiza disponibilidad permanente de prestadores, aceptación de una propuesta, calidad o resultado de un trabajo, compatibilidad personal, ausencia total de riesgos ni exactitud absoluta de perfiles, ubicación, transcripciones, resúmenes o notificaciones. Sí responde por las obligaciones que asume expresamente respecto de su propio servicio digital y por las responsabilidades que no puedan excluirse legalmente.",
        "Dentro de lo permitido por la ley, Servicios Ya no responde por acuerdos o pagos realizados fuera de sus sistemas, modificaciones no registradas, información falsa de usuarios, daños causados exclusivamente por la ejecución técnica del prestador o actos de terceros fuera de su control razonable. Esta delimitación no importa una renuncia del consumidor ni excluye responsabilidad legalmente solidaria, deberes de seguridad, dolo, culpa grave o cualquier otro supuesto inderogable.",
      ],
    },
    {
      title: "17. Propiedad intelectual y contenido de usuarios",
      paragraphs: [
        "La marca, software, diseño, bases de datos, textos propios e interfaces de Servicios Ya están protegidos. Se concede al usuario una licencia personal, limitada, revocable, no exclusiva e intransferible para utilizar la app conforme a estos Términos.",
        "El usuario conserva sus derechos sobre fotos, textos, presupuestos y demás contenido que aporte. Otorga a Servicios Ya una autorización no exclusiva, gratuita y limitada a alojar, reproducir, adaptar técnicamente y mostrar ese contenido en la medida necesaria para operar, moderar, respaldar y proteger la Plataforma. El usuario declara contar con derechos y permisos para compartirlo.",
      ],
    },
    {
      title: "18. Disponibilidad, cambios y continuidad",
      paragraphs: [
        "La Plataforma puede realizar mantenimiento, corregir errores, modificar funciones o incorporar proveedores tecnológicos. Se procurará avisar cambios materiales que afecten operaciones en curso. Una indisponibilidad no libera a las partes de preservar la seguridad ni autoriza a asumir que un pago, reprogramación o cancelación fue confirmado sin constancia.",
        "Los Términos pueden actualizarse por cambios legales, técnicos o comerciales. La nueva versión indicará fecha de vigencia y se solicitará una aceptación renovada cuando el cambio sea material. Las operaciones ya confirmadas conservan las condiciones particulares aceptadas, salvo aplicación obligatoria de una norma o acuerdo posterior de las partes.",
      ],
    },
    {
      title: "19. Ley aplicable y solución de conflictos",
      paragraphs: [
        `Estos Términos se rigen por las leyes de la República Argentina. El usuario puede iniciar un reclamo interno sin costo mediante ${contact}. La atención electrónica se mantiene, como mínimo, durante el horario comercial informado por la Plataforma.`,
        "Si el usuario es consumidor, conserva el derecho de acudir a la autoridad de defensa del consumidor y a los tribunales competentes que determine la normativa. No se impone una prórroga de jurisdicción contra el consumidor. Para relaciones que legalmente no sean de consumo, serán competentes los tribunales que resulten aplicables conforme a las reglas generales, sin perjuicio de mecanismos voluntarios de mediación.",
        "Si una cláusula fuera inválida o inaplicable, se interpretará o limitará en la medida necesaria para respetar la ley, sin afectar las restantes. La falta de ejercicio inmediato de un derecho no implica renuncia.",
      ],
    },
  ],
};

export const PRIVACY_DOCUMENT: LegalDocument = {
  kind: "privacy",
  title: "Política de Privacidad de Servicios Ya",
  version: "privacy-2026-08-12-v1",
  effectiveDate: "12 de agosto de 2026",
  summary:
    "Explica qué datos utiliza Servicios Ya, para qué, con quién los comparte y cómo ejercer los derechos de acceso, rectificación y supresión.",
  sections: [
    {
      title: "1. Responsable y alcance",
      paragraphs: [
        `Servicios Ya es responsable de las bases de datos y tratamientos necesarios para operar la aplicación, el sitio y los canales vinculados. Esta Política se aplica a clientes, prestadores, visitantes, postulantes y personas que contacten soporte. El canal para privacidad y ejercicio de derechos es ${contact}.`,
        "La Política debe leerse junto con los Términos y los avisos específicos mostrados al solicitar permisos, grabar audio, iniciar un pago o activar una ubicación. No se utilizan los datos para finalidades incompatibles con las informadas sin una nueva base válida o consentimiento cuando sea necesario.",
      ],
    },
    {
      title: "2. Datos que podemos tratar",
      paragraphs: [
        "Según el rol y las funciones utilizadas, Servicios Ya puede tratar las siguientes categorías:",
      ],
      bullets: [
        "Cuenta e identidad: identificador interno, correo, teléfono, nombre, apellido, edad o fecha de nacimiento, sexo declarado, DNI, domicilio, ciudad, provincia, barrio, código postal, foto de perfil, selfie e imágenes del documento cuando se habilite una verificación.",
        "Perfil profesional: categorías, descripción, experiencia, experiencia académica, referencias, antigüedad, horarios, disponibilidad, matrícula o credencial profesional y estado de verificación. Servicios Ya no solicita ni admite nuevas cargas de certificados de antecedentes penales o contravencionales.",
        "Ubicación: coordenadas aproximadas o precisas cuando el usuario concede permiso, ciudad, provincia, barrio, zona frecuente, disponibilidad y última actualización. La app utiliza ubicación en primer plano para buscar y mostrar prestadores cercanos; no declara un seguimiento permanente en segundo plano.",
        "Actividad de mercado: publicaciones, postulaciones, servicios, categorías consultadas, presupuestos, modalidad, tarifa, unidades estimadas, total, comisión, aceptaciones, agenda, opciones de reprogramación, confirmación, estado del trabajo, reclamos, resoluciones, calificaciones y bloqueos entre usuarios.",
        "Comunicaciones: mensajes, archivos, imágenes, audios, transcripciones, correcciones, resúmenes de MICA, datos de lectura y metadatos de conversación. Antes del pago, los mensajes y transcripciones se analizan para detectar contacto externo y precios enviados fuera del botón de presupuesto.",
        "Pagos: identificadores de preferencia y pago, importe, moneda, estado, fechas, referencia externa, errores y datos de conciliación provistos por Mercado Pago. Servicios Ya no almacena el número completo ni el código de seguridad de la tarjeta.",
        "Dispositivo y seguridad: dirección IP y registros técnicos disponibles en la infraestructura, versión de app, sistema operativo, identificadores de sesión, tokens de notificación, intentos y errores, eventos antifraude, consentimientos y versiones legales aceptadas.",
        "Soporte y reclamos: categoría, explicación, evidencia aportada, número de caso, resumen de MICA, notas operativas, responsable asignado, comunicaciones y resolución.",
      ],
    },
    {
      title: "3. Fuentes de los datos",
      paragraphs: [
        "La mayoría de los datos proviene del propio usuario al registrarse, completar el perfil, conceder permisos, publicar, conversar, grabar un audio, presupuestar, pagar o reclamar. También se reciben datos de la otra parte de una operación, proveedores de autenticación como Google o Apple, Mercado Pago, servicios de notificaciones y registros técnicos generados al utilizar la Plataforma.",
        "MICA puede producir transcripciones, clasificaciones y resúmenes derivados del contenido aportado. Las calificaciones y comentarios son proporcionados por la contraparte de un trabajo verificado. El usuario puede pedir la corrección de información inexacta y aportar su explicación ante contenido controvertido.",
      ],
    },
    {
      title: "4. Finalidades y bases",
      paragraphs: [
        "Los datos se utilizan para crear y proteger cuentas; verificar identidad o habilitaciones; mostrar perfiles y publicaciones; localizar prestadores; gestionar postulaciones, chats, presupuestos, comisión, agenda, urgencias, notificaciones, cierre, reputación y reclamos; prestar soporte; cumplir obligaciones legales; prevenir fraude y abuso; defender derechos; mejorar estabilidad y medir el funcionamiento del producto.",
        "El tratamiento se apoya, según el caso, en el consentimiento libre, expreso e informado; la necesidad de ejecutar la relación contractual solicitada; el cumplimiento de obligaciones legales; y finalidades legítimas compatibles con la seguridad y operación de la Plataforma, respetando los derechos de los titulares.",
        "Los permisos de cámara, fotos, micrófono, ubicación y notificaciones pueden revocarse desde el dispositivo. La revocación no afecta el tratamiento anterior válido, pero puede impedir funciones que dependen técnicamente de ese permiso.",
      ],
    },
    {
      title: "5. Datos públicos, datos entre partes y datos restringidos",
      paragraphs: [
        "En un perfil público de prestador pueden mostrarse nombre, foto, edad si fue configurada, localidad, categorías, experiencia, disponibilidad, servicios, verificación, trabajos completados, calificación y tiempo medio de respuesta. No se muestran públicamente DNI, imágenes de identidad, teléfono, correo, domicilio exacto, documentos de matrícula ni antecedentes.",
        "Antes del pago, cliente y prestador ven la información necesaria para conversar sin acceso a contacto externo. Después de aprobarse la comisión, se habilitan los datos necesarios para coordinar. Los participantes acceden a su chat, presupuesto, agenda y reclamo; el equipo operativo accede sólo cuando lo requiere el soporte, seguridad, conciliación o resolución del caso.",
        "Las credenciales profesionales pueden ser revisadas por personal autorizado. La Plataforma muestra un estado de presentación o verificación, no el archivo completo a otros usuarios. Los documentos de identidad y evidencias de reclamos deben mantenerse en almacenamiento restringido y no utilizarse con fines publicitarios.",
      ],
    },
    {
      title: "6. Decisiones automatizadas e inteligencia artificial",
      paragraphs: [
        "Se utilizan reglas automáticas para detectar datos de contacto, exigir presupuestos estructurados, transcribir audios, ordenar resultados, generar recordatorios, registrar vencimientos de urgencias y señalar riesgos. MICA utiliza modelos de inteligencia artificial para interpretar solicitudes y resumir información.",
        "Los sistemas automáticos pueden equivocarse. Una transcripción o resumen no reemplaza la confirmación de las partes. Las decisiones relevantes sobre reclamos controvertidos, devoluciones, cierres de cuenta o sanciones significativas admiten intervención humana. No se adoptan decisiones judiciales o administrativas basadas exclusivamente en perfiles automatizados.",
      ],
    },
    {
      title: "7. Destinatarios y proveedores",
      paragraphs: [
        "Servicios Ya comparte únicamente los datos necesarios con la contraparte de una operación y con proveedores que ayudan a prestar el servicio. Actualmente pueden intervenir Supabase en autenticación, base de datos, funciones y almacenamiento; Expo en notificaciones y distribución; Mercado Pago en pagos; OpenAI en asistencia de MICA y transcripción; Resend en correo transaccional cuando esté configurado; Google y Apple en autenticación y servicios del dispositivo; proveedores de mapas y geolocalización; y Vexo u otras herramientas habilitadas para métricas técnicas.",
        "Esos proveedores tratan datos conforme a sus funciones, contratos y políticas. Se procura limitar el acceso, configurar permisos y utilizar empresas con medidas razonables de seguridad. También pueden comunicarse datos a autoridades cuando exista obligación legal, orden válida, emergencia o necesidad de proteger derechos y seguridad.",
        "Servicios Ya no vende bases de datos personales ni entrega documentos de identidad, audios o conversaciones a anunciantes para publicidad dirigida de terceros.",
      ],
    },
    {
      title: "8. Transferencias internacionales",
      paragraphs: [
        "Algunos proveedores tecnológicos pueden almacenar o procesar datos fuera de Argentina. Cuando el país de destino no cuente con un nivel de protección reconocido como adecuado, Servicios Ya debe utilizar una excepción legal o garantías contractuales apropiadas y adoptar medidas complementarias según el riesgo.",
        "La aceptación de esta Política no sustituye las garantías exigidas por la legislación para una transferencia internacional. Puede solicitarse información actualizada sobre categorías de destinatarios y salvaguardas mediante el canal de privacidad.",
      ],
    },
    {
      title: "9. Conservación",
      paragraphs: [
        "Los datos se conservan sólo durante el tiempo necesario para la finalidad informada, la relación activa y los plazos legales aplicables. Los registros de cuenta se mantienen mientras la cuenta esté activa y luego se restringen por el plazo necesario para atender reclamos, fraude o defensa de derechos. Los registros de pagos, facturación y aceptaciones se conservan durante los plazos contables, fiscales y de prescripción aplicables.",
        "Los chats, presupuestos, agendas y evidencias vinculados con un trabajo pueden conservarse mientras exista una operación o reclamo y por el plazo razonable necesario para probar lo acordado. Los audios pueden eliminarse o anonimizarse antes cuando dejen de ser necesarios, salvo que estén vinculados con un caso abierto. Los tokens de notificación se invalidan al quedar obsoletos y los archivos temporales se eliminan de acuerdo con su ciclo operativo.",
        "Cuando se solicita una supresión, se eliminan o disocian los datos que ya no sean necesarios. Puede conservarse una copia bloqueada si existe obligación legal, un reclamo, deuda, investigación de fraude, derecho de un tercero o necesidad de acreditar una operación.",
      ],
    },
    {
      title: "10. Seguridad y confidencialidad",
      paragraphs: [
        "Servicios Ya aplica controles de acceso por usuario y rol, reglas de seguridad a nivel de base de datos, almacenamiento restringido para contenido privado, cifrado en tránsito, secretos de servidor, registros operativos y revisión de funciones administrativas. El acceso interno debe limitarse a quienes lo necesiten y está sujeto a confidencialidad.",
        "Ningún sistema es infalible. El usuario debe usar una contraseña única, mantener su dispositivo actualizado y no compartir códigos ni credenciales. Ante un incidente que pueda afectar significativamente derechos, Servicios Ya evaluará contención, registro y comunicaciones legalmente requeridas.",
      ],
    },
    {
      title: "11. Derechos de las personas",
      paragraphs: [
        "El titular puede solicitar información sobre sus datos, acceder a ellos, pedir actualización, rectificación, confidencialidad o supresión y revocar consentimientos cuando corresponda. La solicitud de acceso debe responderse dentro de diez días corridos; la rectificación, actualización o supresión, dentro de cinco días hábiles, salvo una excepción legal.",
        "Para proteger la cuenta puede pedirse una verificación razonable de identidad. La solicitud debe identificar el derecho y los datos involucrados. El acceso es gratuito en los intervalos previstos por la ley. Si no obtiene respuesta adecuada, el titular puede acudir a la Agencia de Acceso a la Información Pública, autoridad de control de la Ley 25.326.",
        "Eliminar la cuenta no equivale necesariamente a borrar de inmediato toda evidencia: los datos sujetos a conservación se bloquean para usos incompatibles y se eliminan al vencer su necesidad legal u operativa.",
      ],
    },
    {
      title: "12. Menores",
      paragraphs: [
        "Servicios Ya no está dirigida a menores de dieciocho años y no permite que contraten o presten servicios mediante una cuenta propia. Si se detecta una cuenta de una persona menor, puede suspenderse y eliminarse la información que no deba conservarse. Quien conozca un caso puede informarlo por el canal de privacidad.",
      ],
    },
    {
      title: "13. Cambios y contacto",
      paragraphs: [
        "Esta Política puede actualizarse por cambios funcionales, tecnológicos o normativos. Se indicará la nueva versión y fecha; si el cambio es material se solicitará una aceptación renovada o se dará un aviso destacado.",
        `Para privacidad, acceso, rectificación, supresión, seguridad o consultas, puede utilizarse ${contact}. La solicitud debe incluir información suficiente para ubicar la cuenta y responder de forma segura.`,
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentKind, LegalDocument> = {
  terms: TERMS_DOCUMENT,
  privacy: PRIVACY_DOCUMENT,
};
