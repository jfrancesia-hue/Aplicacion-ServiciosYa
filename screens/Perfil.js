import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import BotonVolver from '../components/BotonVolver';
import { useQuery } from '@tanstack/react-query';
import { perfilQueryOptions } from '../lib/queryOptions';
import { VERIFICATION_DOCUMENTS_BUCKET } from '../lib/legal/verificationDocuments';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const subirArchivo = async (uri, nombre, contentType, userId) => {
  const nombreArchivo = `${userId}/${nombre}-${Date.now()}`;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { error } = await supabase.storage
    .from(VERIFICATION_DOCUMENTS_BUCKET)
    .upload(nombreArchivo, buffer, { contentType, upsert: true });
  if (error) throw error;
  return nombreArchivo;
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const ReadItem = ({ label, value }) => (
  <View style={styles.item}>
    <Text style={styles.itemLabel}>{label}</Text>
    <Text style={styles.itemValue}>{value != null && value !== '' ? String(value) : '–'}</Text>
  </View>
);

const EditItem = ({ label, value, onChange, keyboardType = 'default', multiline = false, placeholder = '' }) => (
  <View style={styles.item}>
    <Text style={styles.itemLabel}>{label}</Text>
    <TextInput
      style={[styles.editInput, multiline && styles.editInputMultiline]}
      value={value != null ? String(value) : ''}
      onChangeText={onChange}
      keyboardType={keyboardType}
      multiline={multiline}
      placeholder={placeholder}
      placeholderTextColor="#aaa"
    />
  </View>
);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function Perfil() {
  const { data: userData, isLoading, refetch } = useQuery({
    ...perfilQueryOptions,
    staleTime: 200,
    refetchOnMount: true,
  });

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  // Form state
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [edad, setEdad] = useState('');
  const [dni, setDni] = useState('');
  const [provincia, setProvincia] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [barrio, setBarrio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [horarios, setHorarios] = useState('');

  // Categorías — ref para evitar closure stale en guardarCambios
  const [categorias, setCategorias] = useState([]);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const categoriasRef = useRef([]);
  const [busquedaCategoria, setBusquedaCategoria] = useState('');
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  // Archivos — también con refs
  const [matriculaArchivos, setMatriculaArchivos] = useState([]);
  const matriculaRef = useRef([]);

  // Sync refs
  useEffect(() => { categoriasRef.current = categoriasSeleccionadas; }, [categoriasSeleccionadas]);
  useEffect(() => { matriculaRef.current = matriculaArchivos; }, [matriculaArchivos]);

  // Populate form when userData arrives
  useEffect(() => {
    if (userData) {
      // Siempre convertir a string para evitar que .trim() explote con números
      setNombre(userData.nombre ? String(userData.nombre) : '');
      setCelular(userData.celular != null ? String(userData.celular) : '');
      setEdad(userData.edad != null ? String(userData.edad) : '');
      setDni(userData.dni != null ? String(userData.dni) : '');
      setProvincia(userData.provincia ? String(userData.provincia) : '');
      setCiudad(userData.ciudad ? String(userData.ciudad) : '');
      setBarrio(userData.barrio ? String(userData.barrio) : '');
      setDescripcion(userData.descripcion ? String(userData.descripcion) : '');
      setExperiencia(userData.experiencia ? String(userData.experiencia) : '');
      setHorarios(userData.horarios ? String(userData.horarios) : '');

      const cats = Array.isArray(userData.categoria) ? userData.categoria : [];
      setCategoriasSeleccionadas(cats);
      categoriasRef.current = cats;

      const toChip = (url) => ({
        uri: url, tipo: 'url', nombre: url.split('/').pop() || 'archivo',
      });
      const mat = userData.matricula
        ? (Array.isArray(userData.matricula)
            ? userData.matricula.map(toChip)
            : [toChip(userData.matricula)])
        : [];
      setMatriculaArchivos(mat);
      matriculaRef.current = mat;
    }
  }, [userData]);

  // Load categorias list
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('nombre')
        .order('nombre', { ascending: true });
      if (!error && data) setCategorias(data.map((c) => c.nombre));
    })();
  }, []);

  const categoriasFiltradas = categorias.filter(
    (c) =>
      c.toLowerCase().includes(busquedaCategoria.toLowerCase()) &&
      !categoriasSeleccionadas.includes(c)
  );

  const agregarCategoria = (cat) => {
    if (categoriasSeleccionadas.length >= 3) {
      Alert.alert('Máximo 3 categorías');
      return;
    }
    const nuevas = [...categoriasSeleccionadas, cat];
    setCategoriasSeleccionadas(nuevas);
    categoriasRef.current = nuevas;
    setBusquedaCategoria('');
    setMostrarDropdown(false);
  };

  const quitarCategoria = (cat) => {
    const nuevas = categoriasSeleccionadas.filter((c) => c !== cat);
    setCategoriasSeleccionadas(nuevas);
    categoriasRef.current = nuevas;
  };

  // ── File selectors ──────────────────────────
  const seleccionarArchivo = async (lista, setLista, refLista, tipo) => {
    if (lista.filter((a) => a.tipo !== 'url').length >= 3) {
      Alert.alert('Máximo 3 archivos nuevos');
      return;
    }
    if (tipo === 'imagen') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permiso requerido'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, quality: 0.7,
      });
      if (!result.canceled && result.assets.length > 0) {
        const nueva = [...lista, {
          uri: result.assets[0].uri, tipo: 'imagen',
          nombre: `imagen_${Date.now()}.jpg`,
        }];
        setLista(nueva);
        refLista.current = nueva;
      }
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf', copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const nueva = [...lista, { uri: asset.uri, tipo: 'pdf', nombre: asset.name }];
        setLista(nueva);
        refLista.current = nueva;
      }
    }
  };

  // ── Photo update ────────────────────────────
  const actualizarFotoPerfil = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
      });
      if (result.canceled || result.assets.length === 0) return;
      setUpdatingPhoto(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        Alert.alert('Error', 'No se pudo obtener el usuario.');
        return;
      }
      const userId = authData.user.id;

      const imagen = result.assets[0];
      const response = await fetch(imagen.uri);
      const fileData = await response.arrayBuffer();
      const fileExt = imagen.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}-perfil-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('imagenes')
        .upload(fileName, fileData, {
          contentType: imagen.mimeType || 'image/jpeg', upsert: false,
        });
      if (uploadError) { Alert.alert('Error al subir imagen', uploadError.message); return; }

      const { data: urlData } = supabase.storage.from('imagenes').getPublicUrl(fileName);
      const { error: updateError } = await supabase
        .from('usuarios').update({ foto_perfil: urlData.publicUrl }).eq('id', userId);

      if (updateError) Alert.alert('Error al actualizar perfil', updateError.message);
      else { await refetch(); Alert.alert('Éxito', 'Foto actualizada'); }
    } catch (e) {
      Alert.alert('Error inesperado', e?.message || 'Ocurrió un error');
    } finally {
      setUpdatingPhoto(false);
    }
  };

  // ── Save all changes ─────────────────────────
  const guardarCambios = async () => {
    // Normalizar todo a string antes de validar para evitar crash con valores numéricos
    const nombreVal = nombre != null ? String(nombre).trim() : '';
    const celularVal = celular != null ? String(celular).trim() : '';
    const ciudadVal = ciudad != null ? String(ciudad).trim() : '';
    const provinciaVal = provincia != null ? String(provincia).trim() : '';
    const edadVal = edad != null ? String(edad).trim() : '';
    const dniVal = dni != null ? String(dni).trim() : '';
    const barrioVal = barrio != null ? String(barrio).trim() : '';
    const descripcionVal = descripcion != null ? String(descripcion).trim() : '';
    const experienciaVal = experiencia != null ? String(experiencia).trim() : '';
    const horariosVal = horarios != null ? String(horarios).trim() : '';

    // Leer desde refs para evitar valores stale de closures
    const categoriasActuales = categoriasRef.current;
    const matriculaActual = matriculaRef.current;

    console.log('[Perfil] guardarCambios', {
      nombreVal, celularVal, ciudadVal, provinciaVal,
      categorias: categoriasActuales,
    });

    if (!nombreVal || !celularVal || !ciudadVal || !provinciaVal) {
      Alert.alert('Error', 'Nombre, celular, ciudad y provincia son obligatorios.');
      return;
    }

    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        Alert.alert('Error', 'No se pudo obtener el usuario autenticado.');
        return;
      }
      const userId = authData.user.id;

      const subirLista = async (lista) => {
        const urls = [];
        for (const archivo of lista) {
          if (archivo.tipo === 'url') {
            urls.push(archivo.uri);
          } else {
            const ct = archivo.tipo === 'pdf' ? 'application/pdf' : 'image/jpeg';
            const url = await subirArchivo(archivo.uri, archivo.nombre, ct, userId);
            urls.push(url);
          }
        }
        return urls;
      };

      const matriculaUrls = await subirLista(matriculaActual);

      const updateData = {
        nombre: nombreVal,
        celular: celularVal,
        edad: edadVal ? Number.parseInt(edadVal) : null,
        dni: dniVal,
        provincia: provinciaVal,
        ciudad: ciudadVal,
        barrio: barrioVal || null,
        descripcion: descripcionVal || null,
        experiencia: experienciaVal || null,
        horarios: horariosVal || null,
        categoria: categoriasActuales,
        matricula: matriculaUrls.length > 0 ? matriculaUrls[0] : null,
      };

      console.log('[Perfil] updateData', updateData);

      const { error } = await supabase
        .from('usuarios')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('[Perfil] error', error);
        Alert.alert('Error al guardar', error.message || 'No se pudieron guardar los cambios.');
      } else {
        await refetch();
        setEditing(false);
        Alert.alert('Guardado', 'Tu perfil fue actualizado correctamente.');
      }
    } catch (e) {
      console.error('[Perfil] catch', e);
      Alert.alert('Error inesperado', e?.message || 'Ocurrió un error');
    } finally {
      setSaving(false);
    }
  };

  const cancelarEdicion = () => {
    if (userData) {
      setNombre(userData.nombre ? String(userData.nombre) : '');
      setCelular(userData.celular != null ? String(userData.celular) : '');
      setEdad(userData.edad != null ? String(userData.edad) : '');
      setDni(userData.dni != null ? String(userData.dni) : '');
      setProvincia(userData.provincia ? String(userData.provincia) : '');
      setCiudad(userData.ciudad ? String(userData.ciudad) : '');
      setBarrio(userData.barrio ? String(userData.barrio) : '');
      setDescripcion(userData.descripcion ? String(userData.descripcion) : '');
      setExperiencia(userData.experiencia ? String(userData.experiencia) : '');
      setHorarios(userData.horarios ? String(userData.horarios) : '');

      const cats = Array.isArray(userData.categoria) ? userData.categoria : [];
      setCategoriasSeleccionadas(cats);
      categoriasRef.current = cats;

      const toChip = (url) => ({
        uri: url, tipo: 'url', nombre: url.split('/').pop() || 'archivo',
      });
      const mat = userData.matricula
        ? (Array.isArray(userData.matricula)
            ? userData.matricula.map(toChip) : [toChip(userData.matricula)])
        : [];
      setMatriculaArchivos(mat);
      matriculaRef.current = mat;
    }
    setEditing(false);
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <LinearGradient colors={['#069eb3', '#047a8f']} style={styles.loader}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  if (!userData) {
    return (
      <LinearGradient colors={['#069eb3', '#047a8f']} style={styles.loader}>
        <Text style={{ color: '#fff' }}>No se encontraron datos de usuario</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#069eb3', '#047a8f']} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <BotonVolver />

      {/* ── HERO ── */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Mi Perfil</Text>
        <Text style={styles.heroSubtitle}>Tu información en un solo lugar</Text>
      </View>

      {/* ── CARD ── */}
      <View style={styles.card}>

        {/* ── AVATAR ── */}
        <View style={styles.avatarRow}>
          <Image
            source={{ uri: userData.foto_perfil || 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={actualizarFotoPerfil}
            disabled={updatingPhoto}
          >
            <Text style={styles.photoBtnText}>
              {updatingPhoto ? 'Subiendo…' : '📷 Cambiar foto'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── TOP ACTIONS ── */}
        <View style={styles.actionRow}>
          {!editing ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>✏️  Editar perfil</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={guardarCambios}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : '💾  Guardar cambios'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelarEdicion} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ══ INFORMACIÓN PERSONAL ══ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información personal</Text>
          {editing ? (
            <>
              <EditItem label="Nombre" value={nombre} onChange={setNombre} />
              <EditItem label="Celular" value={celular} onChange={setCelular} keyboardType="phone-pad" />
              <EditItem label="Edad" value={edad} onChange={setEdad} keyboardType="numeric" />
              <EditItem label="DNI" value={dni} onChange={setDni} keyboardType="numeric" />
              <EditItem label="Provincia" value={provincia} onChange={setProvincia} />
              <EditItem label="Ciudad" value={ciudad} onChange={setCiudad} />
              <EditItem label="Barrio" value={barrio} onChange={setBarrio} />
            </>
          ) : (
            <>
              <ReadItem label="Nombre" value={userData.nombre} />
              <ReadItem label="Email" value={userData.email} />
              <ReadItem label="Celular" value={userData.celular} />
              <ReadItem label="Edad" value={userData.edad} />
              <ReadItem label="DNI" value={userData.dni} />
              <ReadItem label="Provincia" value={userData.provincia} />
              <ReadItem label="Ciudad" value={userData.ciudad} />
              <ReadItem label="Barrio" value={userData.barrio} />
            </>
          )}
        </View>

        {/* ══ ESTADO (solo lectura) ══ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado</Text>
          <ReadItem label="Rol" value={userData.rol} />
          <ReadItem label="Verificado" value={userData.verificado ? 'Sí' : 'No'} />
          <ReadItem label="Créditos" value={userData.creditos} />
        </View>

        {/* ══ CATEGORÍAS ══ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Especialidades</Text>
          {editing ? (
            <View style={{ zIndex: 10 }}>
              <TextInput
                style={styles.editInput}
                placeholder="Buscar categoría…"
                placeholderTextColor="#aaa"
                value={busquedaCategoria}
                onChangeText={(t) => { setBusquedaCategoria(t); setMostrarDropdown(true); }}
                onFocus={() => setMostrarDropdown(true)}
              />
              {mostrarDropdown && categoriasFiltradas.length > 0 && (
                <View style={styles.dropdown}>
                  {categoriasFiltradas.slice(0, 8).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.dropdownItem}
                      onPress={() => agregarCategoria(cat)}
                    >
                      <Text style={styles.dropdownText}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.tagsContainer}>
                {categoriasSeleccionadas.map((cat) => (
                  <View key={cat} style={styles.tag}>
                    <Text style={styles.tagText}>{cat}</Text>
                    <TouchableOpacity onPress={() => quitarCategoria(cat)}>
                      <Text style={styles.tagClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <Text style={styles.hint}>Máximo 3 categorías</Text>
            </View>
          ) : (
            <View style={styles.tagsContainer}>
              {(userData.categoria || []).map((cat) => (
                <View key={cat} style={styles.tag}>
                  <Text style={styles.tagText}>{cat}</Text>
                </View>
              ))}
              {(!userData.categoria || userData.categoria.length === 0) && (
                <Text style={styles.itemValue}>–</Text>
              )}
            </View>
          )}
        </View>

        {/* ══ ARCHIVOS ══ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Archivos</Text>

          {/* Matrícula */}
          <Text style={styles.itemLabel}>Matrícula</Text>
          {editing ? (
            <>
              <View style={styles.fileBtns}>
                <TouchableOpacity
                  style={styles.fileAddBtn}
                  onPress={() => seleccionarArchivo(matriculaArchivos, setMatriculaArchivos, matriculaRef, 'imagen')}
                >
                  <Text style={styles.fileAddBtnText}>📷 Imagen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fileAddBtn}
                  onPress={() => seleccionarArchivo(matriculaArchivos, setMatriculaArchivos, matriculaRef, 'pdf')}
                >
                  <Text style={styles.fileAddBtnText}>📄 PDF</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chipsRow}>
                {matriculaArchivos.map((a, i) => (
                  <View key={a.uri || a.nombre} style={styles.fileChip}>
                    <Text numberOfLines={1} style={styles.fileChipText}>{a.nombre}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const nueva = matriculaArchivos.filter((_, idx) => idx !== i);
                        setMatriculaArchivos(nueva);
                        matriculaRef.current = nueva;
                      }}
                    >
                      <Text style={styles.tagClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.chipsRow}>
              {matriculaArchivos.length > 0
                ? matriculaArchivos.map((a) => (
                    <View key={a.uri || a.nombre} style={styles.fileChipReadOnly}>
                      <Text numberOfLines={1} style={styles.fileChipText}>{a.nombre}</Text>
                    </View>
                  ))
                : <Text style={styles.itemValue}>–</Text>
              }
            </View>
          )}

        </View>

        {/* Botón guardar inferior */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Presentación profesional</Text>
          <Text style={styles.sectionHelp}>
            Estos datos ayudan al cliente a entender qué hacés antes de escribirte. Completar el perfil no tiene costo.
          </Text>
          {editing ? (
            <>
              <EditItem
                label="Sobre mi trabajo"
                value={descripcion}
                onChange={setDescripcion}
                multiline
                placeholder="Contá qué trabajos realizás y cómo trabajás"
              />
              <EditItem
                label="Experiencia"
                value={experiencia}
                onChange={setExperiencia}
                multiline
                placeholder="Ej.: 5 años en reparaciones domiciliarias"
              />
              <EditItem
                label="Horarios disponibles"
                value={horarios}
                onChange={setHorarios}
                multiline
                placeholder="Ej.: lunes a viernes de 9 a 18 h"
              />
            </>
          ) : (
            <>
              <ReadItem label="Sobre mi trabajo" value={userData.descripcion} />
              <ReadItem label="Experiencia" value={userData.experiencia} />
              <ReadItem label="Horarios disponibles" value={userData.horarios} />
            </>
          )}
        </View>

        {editing && (
          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 24 }, saving && { opacity: 0.6 }]}
            onPress={guardarCambios}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Guardando…' : '💾  Guardar cambios'}</Text>
          </TouchableOpacity>
        )}

      </View>
    </ScrollView>
    </LinearGradient>
  );
}


// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const BLUE = '#069eb3';
const BLUE_DARK = '#047a8f';
const LIGHT_BG = '#f0f8fa';

const styles = StyleSheet.create({
  loader: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  container: {
    flexGrow: 1, padding: 24, paddingTop: 100, minHeight: '100%',
  },
  hero: {
    backgroundColor: 'rgba(0,0,0,0.2)', padding: 20, borderRadius: 20, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10,
  },
  avatarRow: { alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: BLUE, backgroundColor: '#eee',
  },
  photoBtn: {
    marginTop: 10, backgroundColor: BLUE,
    paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20,
  },
  photoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionRow: { marginBottom: 16 },
  editBtn: {
    backgroundColor: BLUE, paddingVertical: 12,
    borderRadius: 14, alignItems: 'center',
    shadowColor: BLUE, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  editActions: { gap: 8 },
  saveBtn: {
    backgroundColor: BLUE_DARK, paddingVertical: 13,
    borderRadius: 14, alignItems: 'center',
    shadowColor: BLUE_DARK, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: {
    borderWidth: 1.5, borderColor: '#c0d8e0',
    paddingVertical: 11, borderRadius: 14, alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontWeight: '600', fontSize: 14 },
  section: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#e8f0f2', paddingTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: BLUE_DARK, marginBottom: 12, letterSpacing: 0.3 },
  sectionHelp: { color: '#668086', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  item: { marginBottom: 10 },
  itemLabel: {
    fontSize: 11, color: '#89b5bf', fontWeight: '700', marginBottom: 2,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  itemValue: { fontSize: 16, fontWeight: '600', color: '#333' },
  editInput: {
    borderWidth: 1.5, borderColor: '#a8dfe8', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#333', backgroundColor: LIGHT_BG,
    marginBottom: 2,
  },
  editInputMultiline: { minHeight: 82, textAlignVertical: 'top' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: BLUE,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6,
  },
  tagText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tagClose: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  hint: { fontSize: 11, color: '#aaa', marginTop: 4 },
  dropdown: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: BLUE,
    borderRadius: 12, maxHeight: 200, zIndex: 99,
  },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#e8f0f2' },
  dropdownText: { fontSize: 14, color: '#333' },
  fileBtns: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  fileAddBtn: {
    flex: 1, backgroundColor: BLUE,
    paddingVertical: 10, borderRadius: 12, alignItems: 'center',
  },
  fileAddBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fileChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#d6f0f5', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
    gap: 6, maxWidth: '48%',
  },
  fileChipReadOnly: {
    backgroundColor: '#e8f5f8', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7, maxWidth: '48%',
  },
  fileChipText: { fontSize: 12, color: '#333', flex: 1 },
});
