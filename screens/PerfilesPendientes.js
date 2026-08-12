import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { resolveVerificationDocumentUrl } from '../lib/legal/verificationDocuments';

export default function PerfilesPendientes() {
  const navigation = useNavigation();
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [imgAmpliada, setImgAmpliada] = useState(null);

  useEffect(() => {
    obtenerPerfilesPendientes();
  }, []);

  const obtenerPerfilesPendientes = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido, email, dni, foto_perfil, dni_frente, dni_dorso')
      .filter('dni_verificado', 'is', false)
      .filter('perfil_completo', 'is', true);

    if (error) {
      Alert.alert('Error', 'No se pudieron cargar los perfiles pendientes.');
      setPerfiles([]);
      setCargando(false);
      return;
    }

    const perfilesConAcceso = await Promise.all(
      (data || []).map(async (perfil) => ({
        ...perfil,
        dni_frente: await resolveVerificationDocumentUrl(perfil.dni_frente).catch(
          () => null,
        ),
        dni_dorso: await resolveVerificationDocumentUrl(perfil.dni_dorso).catch(
          () => null,
        ),
      })),
    );
    setPerfiles(perfilesConAcceso);
    setCargando(false);
  };

  const verificarPerfil = async (usuarioId) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ dni_verificado: true })
      .eq('id', usuarioId);

    if (!error) {
      setPerfiles((prev) => prev.filter((u) => u.id !== usuarioId));
      Alert.alert('Perfil verificado');
    }
  };

  const rechazarPerfil = async (usuarioId) => {
    Alert.alert(
      'Rechazar perfil',
      '¿Seguro que querés rechazar este perfil? Esta acción es irreversible.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('usuarios')
              .update({ perfil_completo: false })
              .eq('id', usuarioId);

            if (!error) {
              setPerfiles((prev) => prev.filter((u) => u.id !== usuarioId));
              Alert.alert('Perfil rechazado');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.perfilCard}>
      <View style={styles.headerCard}>
        <Image
          source={{ uri: item.foto_perfil || 'https://ui-avatars.com/api/?background=00B8A9&color=fff&name=' + (item.nombre || 'U') }}
          style={styles.avatar}
        />
        <View>
          <Text style={styles.nombre}>{item.nombre} {item.apellido}</Text>
          <Text style={styles.email}>{item.email}</Text>
          <Text style={styles.dni}>DNI: <Text style={{fontWeight: 'bold'}}>{item.dni}</Text></Text>
        </View>
      </View>

      <Text style={styles.subtitulo}>DNI (frente y dorso)</Text>
      <View style={styles.dniContainer}>
        <TouchableOpacity
          onPress={() => { setImgAmpliada(item.dni_frente); setModalVisible(true); }}>
          {item.dni_frente ? (
            <Image source={{ uri: item.dni_frente }} style={styles.dniImg} />
          ) : (
            <Text style={styles.errorTexto}>Sin imagen</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setImgAmpliada(item.dni_dorso); setModalVisible(true); }}>
          {item.dni_dorso ? (
            <Image source={{ uri: item.dni_dorso }} style={styles.dniImg} />
          ) : (
            <Text style={styles.errorTexto}>Sin imagen</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.acciones}>
        <TouchableOpacity onPress={() => verificarPerfil(item.id)} style={styles.btnAceptar}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.txtBtn}>Verificar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => rechazarPerfil(item.id)} style={styles.btnRechazar}>
          <Ionicons name="close-circle" size={18} color="#fff" />
          <Text style={styles.txtBtn}>Rechazar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('PerfilPendienteDetalle', { perfil: item })}
          style={styles.btnVerDetalles}
        >
          <Ionicons name="information-circle-outline" size={18} color="#00B8A9" />
          <Text style={[styles.txtBtn, { color: '#00B8A9' }]}>Detalles</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{flex:1, backgroundColor: '#f0fdfc'}}>
      <View style={styles.container}>
        <Text style={styles.titulo}>Perfiles pendientes de verificación</Text>
        {cargando ? (
          <ActivityIndicator size="large" color="#00B8A9" style={{ marginTop: 30 }} />
        ) : perfiles.length === 0 ? (
          <Text style={styles.sinPerfiles}>No hay perfiles pendientes para revisar.</Text>
        ) : (
          <FlatList
            data={perfiles}
            keyExtractor={(item) => item.id?.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
      {/* Modal para imagen ampliada */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBg}>
          <Image source={{ uri: imgAmpliada }} style={styles.imgGrande} />
          <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cerrarModal}>
            <Text style={{ color:'#fff', fontSize:18, fontWeight:'bold'}}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#f0fdfc' },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 14,
    color: '#1f2937',
    textAlign: 'center',
    letterSpacing: .5,
  },
  sinPerfiles: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
    color: '#7f8c8d',
  },
  perfilCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#19D4C6',
    shadowOpacity: 0.09,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    borderLeftWidth: 6,
    borderLeftColor: '#19D4C6',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#FFA987',
    backgroundColor: '#d1f3ef'
  },
  nombre: { fontSize: 17, fontWeight: '700', color: '#222' },
  email: { fontSize: 14, color: '#888', marginTop: 2 },
  dni: { fontSize: 14, color: '#FF6B35', marginTop: 2 },
  subtitulo: { fontWeight: 'bold', marginTop: 10, marginBottom: 5, color: '#00B8A9', fontSize: 14 },
  dniContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  dniImg: {
    width: 120,
    height: 75,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFA987',
    backgroundColor: '#f8fafc',
    marginBottom: 5
  },
  errorTexto: { color: '#dc3545', fontSize: 13, fontStyle: 'italic', marginTop: 24 },
  acciones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 6
  },
  btnAceptar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#19D4C6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 17,
    elevation: 2,
  },
  btnRechazar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 17,
    elevation: 2,
  },
  btnVerDetalles: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F7FA',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#00B8A9'
  },
  txtBtn: { color: '#fff', fontWeight: '700', marginLeft: 5, fontSize: 14 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.89)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  imgGrande: {
    width: '90%',
    height: '70%',
    resizeMode: 'contain',
    borderRadius: 16,
    marginBottom: 18,
    borderWidth: 3,
    borderColor: '#19D4C6'
  },
  cerrarModal: {
    marginTop: 4,
    backgroundColor: '#FF6B35',
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 30,
    alignItems: 'center'
  }
});
