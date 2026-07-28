import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ImageBackground, Image, Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import fondo from '../assets/fondo.png';
import logo from '../assets/serviciosya-logo-2026.png';
import { supabase } from '../lib/supabase'; 
import BotonVolver from '../components/BotonVolver';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { useReferrer } from '../lib/hooks/useReferrer';
import { useGrantAchievement } from '../lib/services/achievements.services';

export default function Register({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const validarPassword = (pass) => ({
    longitud: pass.length >= 8,
    mayuscula: /[A-Z]/.test(pass),
    minuscula: /[a-z]/.test(pass),
    numero: /[0-9]/.test(pass),
    simbolo: /[!@#$%^&*(),.?":{}|<>]/.test(pass),
  });

  const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const requisitos = validarPassword(password);
  const esSegura = Object.values(requisitos).every(Boolean);

  const handleRegister = async () => {
  if (!validateEmail(email)) {
    Alert.alert('Formato inválido', 'Por favor ingresa un email válido.');
    return;
  }
  if (!esSegura) {
    Alert.alert('Contraseña débil', 'La contraseña debe cumplir con todos los requisitos de seguridad.');
    return;
  }
  if (password !== repeatPassword) {
    Alert.alert('Error', 'Las contraseñas no coinciden.');
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    if (error.message.includes('already registered')) {
      Alert.alert('Correo en uso', 'Este correo ya está registrado.');
    } else {
      Alert.alert('Error al registrarse', error.message);
    }
    return;
  }

  if (data.user) {
    await supabase.from('usuarios').insert([{ id: data.user.id, email }]);

    // ⬇️ IMPORTANTE: cargar los hooks recién ahora
    const { getReferrer, setReferrer } = useReferrer({ capture: true });
    const { refered } = useGrantAchievement();

    // obtiene el codigo de referido
    const code = await getReferrer();

    // añade el referido al usuario si está disponible
    await setReferrer(data.user.id);

    // da el logro al usuario dueño del código
    if (code) await refered(code);

    setShowMessage(true);
  }
};


  const renderRequisito = (cumple, texto) => (
    <View style={styles.requisito}>
      <Icon
        name={cumple ? 'check-circle' : 'cancel'}
        color={cumple ? '#10b981' : '#fb923c'}
        size={18}
      />
      <Text style={{ color: cumple ? '#10b981' : '#fb923c', marginLeft: 8, fontWeight: '600' }}>
        {texto}
      </Text>
    </View>
  );

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <BotonVolver />
        <View style={styles.container}>
          {showMessage ? (
            <View style={styles.messageContainer}>
              <Icon name="check-circle" size={44} color="#19D4C6" style={{ marginBottom: 14 }} />
              <Text style={styles.modalTitle}>¡Verificá tu correo!</Text>
              <Text style={styles.modalMessage}>
                Te enviamos un correo para confirmar tu cuenta. Una vez verificado, podrás iniciar sesión.
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowMessage(false);
                  navigation.navigate('Login');
                }}
              >
                <Text style={styles.modalButtonText}>Ir a Iniciar sesión</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <KeyboardAwareScrollView>
                <Image source={logo} style={styles.logo} />
                <Text style={styles.title}>Crear Cuenta</Text>
                <TextInput
                  placeholder="Correo Electrónico"
                  placeholderTextColor="#7bc1ba"
                  onChangeText={setEmail}
                  value={email}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <View style={styles.passwordContainer}>
                  <TextInput
                    placeholder="Contraseña"
                    placeholderTextColor="#7bc1ba"
                    secureTextEntry={!showPassword}
                    onChangeText={setPassword}
                    value={password}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Icon name={showPassword ? 'visibility-off' : 'visibility'} size={24} color="#19D4C6" />
                  </TouchableOpacity>
                </View>

                <View style={styles.requisitosContainer}>
                  {renderRequisito(requisitos.longitud, 'Mínimo 8 caracteres')}
                  {renderRequisito(requisitos.mayuscula, 'Una mayúscula')}
                  {renderRequisito(requisitos.minuscula, 'Una minúscula')}
                  {renderRequisito(requisitos.numero, 'Un número')}
                  {renderRequisito(requisitos.simbolo, 'Un símbolo')}
                </View>

                <TextInput
                  placeholder="Repetir Contraseña"
                  placeholderTextColor="#7bc1ba"
                  secureTextEntry={!showPassword}
                  onChangeText={setRepeatPassword}
                  value={repeatPassword}
                  style={styles.input}
                />

                <TouchableOpacity
                  style={[
                    styles.button,
                    (!email || !esSegura || password !== repeatPassword) && { backgroundColor: '#a0a0a0' }
                  ]}
                  //onPress={handleRegister}
                  onPress={() => handleRegister()}
                  disabled={!email || !esSegura || password !== repeatPassword}
                >
                  <Text style={styles.buttonText}>Registrarme</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('LoginSelect')}>
                  <Text style={styles.registerText}>¿Ya tienes cuenta? Inicia sesión</Text>
                </TouchableOpacity>
              </KeyboardAwareScrollView>
            </>
          )}
        </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    margin: 16,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#069eb3',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 7,
  },
  logo: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 10,
    borderRadius: 20,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 24,
    color: '#047a8f',
    letterSpacing: .6
  },
  input: {
    backgroundColor: '#f0f8fa',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
    marginBottom: 15,
    borderWidth: 1.4,
    borderColor: '#a8dfe8',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8fa',
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: '#a8dfe8',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 16,
    color: '#222',
  },
  requisitosContainer: {
    marginBottom: 15,
    backgroundColor: '#e8f7fa',
    borderRadius: 12,
    padding: 10,
  },
  requisito: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  button: {
    backgroundColor: '#069eb3',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#069eb3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: .3
  },
  registerText: {
    textAlign: 'center',
    color: '#047a8f',
    fontSize: 15,
    marginTop: 12,
    fontWeight: 'bold'
  },
  messageContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 22,
    shadowColor: '#069eb3',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 7,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
    color: '#047a8f'
  },
  modalMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 25,
  },
  modalButton: {
    backgroundColor: '#069eb3',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 22,
    marginTop: 6,
    elevation: 3,
    shadowColor: '#069eb3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: .5
  },
});
