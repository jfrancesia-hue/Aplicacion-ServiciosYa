import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const preguntasFrecuentes = [
  { id: '1', pregunta: '¿Cómo publicar un servicio?', respuesta: 'Ingresa a la sección "Ofrecer Servicio", completa los campos requeridos como título, descripción y categoría, y pulsa "Publicar".' },
  { id: '2', pregunta: '¿Cómo elimino un servicio?', respuesta: 'Ve a la pantalla "Mis Servicios", selecciona el servicio que deseas eliminar y pulsa el botón "Eliminar".' },
  { id: '3', pregunta: '¿Dónde contacto a soporte?', respuesta: 'Usá MICA o el chat interno de la aplicación. Así tu consulta y las respuestas quedan protegidas dentro de Servicios Ya.' },
  { id: '4', pregunta: '¿Cómo edito un servicio publicado?', respuesta: 'En "Mis Servicios", pulsa sobre el servicio que quieres modificar y elige la opción "Editar".' },
  { id: '5', pregunta: '¿Cómo pausar un servicio?', respuesta: 'Desde "Mis Servicios", selecciona el servicio y toca "Pausar". Esto ocultará el servicio temporalmente sin eliminarlo.' },
  { id: '6', pregunta: '¿Cómo veo los servicios por categoría?', respuesta: 'En la pantalla principal (Home), verás un listado de categorías. Al tocar una, verás los servicios disponibles en esa categoría.' },
  { id: '7', pregunta: '¿Qué significa "Oferta pausada temporalmente"?', respuesta: 'Significa que el servicio está oculto al público pero no ha sido eliminado. Puedes reactivarlo en "Mis Servicios".' },
  { id: '8', pregunta: '¿Qué es el chat con IA?', respuesta: 'Es un chat automático para ayudarte con preguntas frecuentes. Solo tienes que seleccionar una pregunta.' },
  { id: '9', pregunta: '¿Cómo sé si me contrataron?', respuesta: 'Recibirás una notificación en tu perfil y también podrás ver tus contrataciones desde "Mis Servicios".' },
  { id: '10', pregunta: '¿Puedo volver a publicar un servicio eliminado?', respuesta: 'No, los servicios eliminados no pueden recuperarse. Deberás volver a crearlo desde "Ofrecer Servicio".' },
  { id: '11', pregunta: '¿Cómo cambio mi foto de perfil?', respuesta: 'Ve a "Configuración", toca tu foto actual y selecciona una nueva imagen desde tu galería.' },
  { id: '12', pregunta: '¿Por qué no puedo publicar un servicio?', respuesta: 'Asegúrate de haber completado todos los campos obligatorios y de tener una cuenta verificada.' },
];

export default function ChatBotModal({ visible, onClose }) {
  const [conversacion, setConversacion] = useState([]);
  const [filtro, setFiltro] = useState('');
  const scrollViewRef = useRef();

  const enviarPregunta = (p) => {
    setConversacion((prev) => [
      ...prev,
      { tipo: 'usuario', texto: p.pregunta, id: `u-${p.id}-${Date.now()}` },
      { tipo: 'bot', texto: p.respuesta, id: `b-${p.id}-${Date.now()}` },
    ]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const preguntasFiltradas = preguntasFrecuentes.filter((p) =>
    p.pregunta.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Asistente de Soluciones Ya</Text>
            <TouchableOpacity onPress={onClose} style={styles.cerrarBtn}>
              <Text style={styles.cerrarTexto}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          {/* Conversación */}
          <ScrollView
            style={styles.chatContainer}
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {conversacion.length === 0 && (
              <Text style={styles.sinMensajes}>Selecciona una pregunta para comenzar.</Text>
            )}
            
            <View style={{marginBottom:25}}>
              {conversacion.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.burbuja,
                    msg.tipo === 'usuario' ? styles.burbujaUsuario : styles.burbujaBot,
                  ]}
                >
                  <Text
                    style={[
                      styles.texto,
                      msg.tipo === 'usuario' ? styles.textoUsuario : styles.textoBot,
                    ]}
                  >
                    {msg.texto}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* El soporte se mantiene dentro de la aplicación */}
          <View style={[styles.container, {borderTopWidth: 1, borderColor: '#ccc'}]}>
            <View style={styles.supportNote}>
              <Ionicons name="shield-checkmark" size={20} color="#047a8f" />
              <Text style={styles.titleText}>
                Tus consultas y datos de contacto permanecen dentro de Servicios Ya.
              </Text>
            </View>
          </View>
          <View style={styles.preguntasContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.preguntasWrap}>
                {preguntasFiltradas.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.preguntaBtn}
                    onPress={() => enviarPregunta(p)}
                  >
                    <Text style={styles.preguntaTexto}>{p.pregunta}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Mini buscador */}
            <TextInput
              style={styles.buscador}
              placeholder="Buscar pregunta..."
              placeholderTextColor="#aaa"
              value={filtro}
              onChangeText={setFiltro}
            />
          </View>

        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 5,
    alignItems:'center'
  },
  titleText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 6,
    textAlign: 'center',
  },
  supportNote: {
    width:'100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f7fa',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#00B8A9',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  cerrarBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cerrarTexto: {
    color: '#fff',
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f9f9f9',
  },
  sinMensajes: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
  burbuja: {
    marginVertical: 6,
    padding: 12,
    borderRadius: 15,
    maxWidth: '80%',
  },
  burbujaUsuario: {
    backgroundColor: '#00B8A9',
    alignSelf: 'flex-end',
  },
  burbujaBot: {
    backgroundColor: '#e5e5ea',
    alignSelf: 'flex-start'
  },
  texto: {
    fontSize: 15,
  },
  textoUsuario: {
    color: '#fff',
    fontWeight: '700',
  },
  textoBot: {
    color: '#000',
  },
  preguntasContainer: { 
    paddingVertical: 10,
    backgroundColor: '#fff',
  },  
  preguntaTexto: {
    color: '#f62',
    fontWeight: 'bold',
    fontSize: 13,
  },
  buscador: {
    marginTop: 0,
    marginHorizontal: 10,
    padding: 8,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    color: '#333',
  },
  preguntasWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 65, // Limita a 2 filas (ajusta si las preguntas ocupan más)
    alignContent: 'flex-start',
    paddingHorizontal: 10,
  },
  preguntaBtn: {
    width: 180, // Ajusta para que entren varias por fila
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
    marginBottom: 0,
  }, 
});
