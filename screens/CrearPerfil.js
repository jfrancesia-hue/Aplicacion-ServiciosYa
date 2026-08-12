
import {
View,
Text,
TextInput,
Button,
TouchableOpacity,
Image,
Switch,
StyleSheet,
ScrollView,
Alert,
Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { useQueryClient } from '@tanstack/react-query';
import { perfilQueryKey } from '../lib/queryOptions';
import { useGrantAchievement } from "../lib/services/achievements.services";
import { LEGAL_TERMS_URL } from "../lib/constants/legal";

export default function FormularioRegistroDNI() {
const queryClient = useQueryClient();
const { completeProfile } = useGrantAchievement();
const [nombre, setNombre] = useState('');
const [apellido, setApellido] = useState('');
const [edad, setEdad] = useState('');
const [dni, setDni] = useState('');
const[fotoPerfil, setFotoPerfil] = useState(null);
const [fotoFrente, setFotoFrente] = useState(null);
const [fotoDorso, setFotoDorso] = useState(null);
const [aceptaTerminos, setAceptaTerminos] = useState(false);
const [subiendo, setSubiendo] = useState(false);
const [domicilio, setDomicilio] = useState('');
const [calle, setCalle] = useState('');

const [validaciones, setValidaciones] = useState({
nombre: false,
apellido: false,
edad: false,
dni: false,
fotoPerfil: false,
fotoFrente: false,
fotoDorso: false,
domicilio: false,
calle: false,
terminos: false,
});

const navigation = useNavigation();


const seleccionarImagen = async (setImage, tipo) => {
try {
let result;


// Para DNI frente y dorso, usar la cámara
if (tipo === 'fotoFrente' || tipo === 'fotoDorso') {
  const permisoCamara = await ImagePicker.requestCameraPermissionsAsync();
  if (!permisoCamara.granted) {
    Alert.alert('Permiso requerido', 'Se necesita permiso para usar la cámara.');
    return;
  }

  result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.7,
  });
} else {
  // Para otros usos (como la foto de perfil), se permite elegir desde galería
  const permisoGaleria = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permisoGaleria.granted) {
    Alert.alert('Permiso requerido', 'Se necesita permiso para acceder a la galería.');
    return;
  }

  result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.7,
  });
}

if (!result.canceled && result.assets.length > 0) {
  const uri = result.assets[0].uri;
  setImage(uri);
  setValidaciones((prev) => ({ ...prev, [tipo]: true }));
}


} catch (error) {
console.log('Error seleccionando imagen:', error);
}
};

const subirImagen = async (uri, nombreBase) => {
const user = (await supabase.auth.getUser()).data.user;
const nombreArchivo = `${user.id}-${nombreBase}-${Date.now()}.jpg`;

const fileData = await FileSystem.readAsStringAsync(uri, {
  encoding: FileSystem.EncodingType.Base64,
});
const buffer = Uint8Array.from(atob(fileData), (c) => c.charCodeAt(0));

const { error } = await supabase.storage
  .from('imagenes')
  .upload(nombreArchivo, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });

if (error) throw error;

const { data: publicUrlData } = supabase.storage
  .from('imagenes')
  .getPublicUrl(nombreArchivo);

return publicUrlData.publicUrl;


};

const enviarFormulario = async () => {
if (!nombre || !apellido || !edad || !dni || !fotoFrente || !fotoDorso || !fotoPerfil || !domicilio || !calle) {
Alert.alert('Faltan datos', 'Por favor completá todos los campos.');
return;
}

if (!aceptaTerminos) {
  Alert.alert('Términos', 'Debés aceptar los términos y condiciones.');
  return;
}

try {
  setSubiendo(true);

  const user = (await supabase.auth.getUser()).data.user;

  const urlPerfil = await subirImagen(fotoPerfil, 'perfil');
  const urlFrente = await subirImagen(fotoFrente, 'dni-frente');
  const urlDorso = await subirImagen(fotoDorso, 'dni-dorso');

  await supabase
    .from('usuarios')
    .update({
      nombre,
      apellido,
      edad: parseInt(edad),
      dni: parseInt(dni),
      foto_perfil: urlPerfil,
      dni_frente: urlFrente,
      dni_dorso: urlDorso,
      dni_verificado: false,
      perfil_completo: true,
      domicilio,
      calle,
    })
    .eq('id', user.id);

    
  // Invalidar la caché del perfil, necesario cada vez que se hagan cambios al perfil del usuario
  await queryClient.invalidateQueries({ queryKey: perfilQueryKey });
  await completeProfile();
  Alert.alert('✅ Éxito', 'Datos guardados correctamente.');
  navigation.navigate('Home');

} catch (error) {
  console.log('Error al enviar:', error);
  Alert.alert('❌ Error', 'No se pudo enviar la información.');
} finally {
  setSubiendo(false);
}


};



return (

<ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
  <Text style={styles.titulo}>Completá tu perfil</Text>

  <Text style={styles.subtitulo}>Foto de perfil</Text>
  <TouchableOpacity
    style={styles.touchBoton}
    onPress={() => seleccionarImagen(setFotoPerfil, 'fotoPerfil')}
    disabled={subiendo}
  >
    <Text style={styles.touchBotonTexto}>Seleccionar foto de perfil</Text>
  </TouchableOpacity>
  {fotoPerfil && <Image source={{ uri: fotoPerfil }} style={styles.imagenCircular} />}
  {validaciones.fotoPerfil && <Text style={styles.validacion}>✔️ Foto seleccionada</Text>}

  <TextInput
    style={[styles.input, !validaciones.nombre && nombre !== '' ? styles.inputError : null]}
    placeholder="Nombre"placeholderTextColor="#999"
    value={nombre}
    onChangeText={(text) => {
      setNombre(text);
      setValidaciones((prev) => ({ ...prev, nombre: /^[a-zA-Z\s]+$/.test(text) }));
    }}
  />
  {validaciones.nombre ? (
    <Text style={styles.validacion}>✔️ Nombre válido</Text>
  ) : (
    nombre !== '' && <Text style={styles.invalidacion}>⚠️ Solo se permiten letras.</Text>
  )}

  <TextInput
    style={[styles.input, !validaciones.apellido && apellido !== '' ? styles.inputError : null]}
    placeholder="Apellido"placeholderTextColor="#999"
    value={apellido}
    onChangeText={(text) => {
      setApellido(text);
      setValidaciones((prev) => ({ ...prev, apellido: /^[a-zA-Z\s]+$/.test(text) }));
    }}
  />
  {validaciones.apellido ? (
    <Text style={styles.validacion}>✔️ Apellido válido</Text>
  ) : (
    apellido !== '' && <Text style={styles.invalidacion}>⚠️ Solo se permiten letras.</Text>
  )}

  <TextInput
    style={[styles.input, !validaciones.edad && edad !== '' ? styles.inputError : null]}
    placeholder="Edad"placeholderTextColor="#999"
    value={edad}
    onChangeText={(text) => {
      setEdad(text);
      setValidaciones((prev) => ({ 
  ...prev, 
  edad: /^[0-9]+$/.test(text) && parseInt(text) > 18 
}));

    }}
    keyboardType="numeric"
  />
  {validaciones.edad ? (
    <Text style={styles.validacion}>✔️ Edad válida</Text>
  ) : (
    edad !== '' && <Text style={styles.invalidacion}>⚠️ Debes ser mayor de 18 años.</Text>
  )}

  <TextInput
    style={[styles.input, !validaciones.dni && dni !== '' ? styles.inputError : null]}
    placeholder="DNI"placeholderTextColor="#999"
    value={dni}
    onChangeText={(text) => {
      setDni(text);
      setValidaciones((prev) => ({ ...prev, dni: /^[0-9]{8}$/.test(text) }));
    }}
    keyboardType="numeric"
  />
  {validaciones.dni ? (
    <Text style={styles.validacion}>✔️ DNI válido</Text>
  ) : (
    dni !== '' && <Text style={styles.invalidacion}>⚠️ El DNI debe tener 8 dígitos.</Text>
  )}

  <Text style={styles.subtitulo}>Foto frente del DNI</Text>
  <TouchableOpacity
    style={styles.touchBoton}
    onPress={() => seleccionarImagen(setFotoFrente, 'fotoFrente')}
    disabled={subiendo}
  >
    <Text style={styles.touchBotonTexto}>Seleccionar imagen frente</Text>
  </TouchableOpacity>
  {fotoFrente && <Image source={{ uri: fotoFrente }} style={styles.imagen} />}
  {validaciones.fotoFrente && <Text style={styles.validacion}>✔️ Imagen seleccionada</Text>}

  <Text style={styles.subtitulo}>Foto dorso del DNI</Text>
  <TouchableOpacity
    style={styles.touchBoton}
    onPress={() => seleccionarImagen(setFotoDorso, 'fotoDorso')}
    disabled={subiendo}
  >
    <Text style={styles.touchBotonTexto}>Seleccionar imagen dorso</Text>
  </TouchableOpacity>
  {fotoDorso && <Image source={{ uri: fotoDorso }} style={styles.imagen} />}
  {validaciones.fotoDorso && <Text style={styles.validacion}>✔️ Imagen seleccionada</Text>}

  

  <TextInput
    style={[styles.input, !validaciones.domicilio && domicilio !== '' ? styles.inputError : null]}
    placeholder="Domicilio"placeholderTextColor="#999"
    value={domicilio}
    onChangeText={(text) => {
      setDomicilio(text);
      setValidaciones((prev) => ({ ...prev, domicilio: text.trim().length > 0 }));
    }}
  />
  {validaciones.domicilio ? (
    <Text style={styles.validacion}>✔️ Domicilio válido</Text>
  ) : (
    domicilio !== '' && <Text style={styles.invalidacion}>⚠️ El domicilio no puede estar vacío.</Text>
  )}

  <TextInput
    style={[styles.input, !validaciones.calle && calle !== '' ? styles.inputError : null]}
    placeholder="Calle"placeholderTextColor="#999"
    value={calle}
    onChangeText={(text) => {
      setCalle(text);
      setValidaciones((prev) => ({ ...prev, calle: text.trim().length > 0 }));
    }}
  />
  {validaciones.calle ? (
    <Text style={styles.validacion}>✔️ Calle válida</Text>
  ) : (
    calle !== '' && <Text style={styles.invalidacion}>⚠️ La calle no puede estar vacía.</Text>
  )}

  <View style={styles.switchContainer}>
    <Switch
      trackColor={{ false: '#ccc', true: '#1E90FF' }}
      thumbColor={aceptaTerminos ? '#007AFF' : '#f4f3f4'}
      ios_backgroundColor="#3e3e3e"
      value={aceptaTerminos}
      onValueChange={(value) => {
        setAceptaTerminos(value);
        setValidaciones((prev) => ({ ...prev, terminos: value }));
      }}
    />
    <Text
      style={[styles.switchLabel, { textDecorationLine: 'underline' }]}
      onPress={() => Linking.openURL(LEGAL_TERMS_URL)}
    >
      Acepto los términos y condiciones
    </Text>
  </View>

  <TouchableOpacity
    style={[
      styles.touchBoton,
      {
        backgroundColor: Object.values(validaciones).every((valor) => valor) ? '#1E90FF' : '#a0a0a0',
      },
    ]}
    onPress={enviarFormulario}
    disabled={!Object.values(validaciones).every((valor) => valor) || subiendo}
  >
    <Text style={styles.touchBotonTexto}>
      {subiendo ? 'Enviando...' : 'Continuar'}
    </Text>
  </TouchableOpacity>
</ScrollView>

  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    padding: 25,
    borderRadius: 16,
    margin: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFA987',
    marginBottom: 25,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFA987',
    marginBottom: 10,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 17,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10
  },
  inputError: {
    borderColor: '#e63946',
  },
  validacion: {
    marginTop: 5,
    color: '#2a9d8f',
    fontWeight: '600',
  },
  invalidacion: {
    marginTop: 5,
    color: '#e63946',
    fontWeight: '600',
  },
  botonContainer: {
    marginTop: 15,
    marginBottom: 5,
  },
  imagenCircular: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginTop: 15,
    alignSelf: 'center',
  },
  imagen: {
    width: '100%',
    height: 180,
    marginTop: 15,
    borderRadius: 12,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#222',
  },
  switchContainer: {
    flexDirection: 'row',
    marginTop: 30,
    alignItems: 'center',
  },
  switchLabel: {
    marginLeft: 12,
    fontSize: 16,
    color: '#444',
    fontWeight: '600',
  },
  touchBoton: {
  backgroundColor: '#40BFC1',
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 10,
  marginVertical: 10,
  alignItems: 'center',
},

touchBotonTexto: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},

});
