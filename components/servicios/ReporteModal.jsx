// ReportServiceModal.jsx
import { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, ToastAndroid } from 'react-native';
import { supabase } from '../../lib/supabase'; // Asegúrate que la ruta a tu cliente supabase sea correcta
import { Picker } from '@react-native-picker/picker';
import ModalFooter from '../ModalFooter';

const REPORT_REASONS = [
  { label: 'Seleccioná una razón...', value: '' },
  { label: 'Contenido Inapropiado', value: 'inappropriate_content' },
  { label: 'Información Falsa o Engañosa', value: 'false_information' },
  { label: 'Spam o Publicidad no Deseada', value: 'spam' },
  { label: 'Estafa Potencial o Fraude', value: 'potential_scam' },
  { label: 'Problemas de Seguridad', value: 'security_issue' },
  { label: 'Otro', value: 'other' },
];

const getUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
};

const ReportServiceModal = ({ visible, onClose, servicio }) => {
  const { titulo, id } = servicio;
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleReportSubmit = async () => {
    if (!selectedReason) {
      ToastAndroid.show('Por favor, seleccioná una razón para el reporte.', ToastAndroid.SHORT);
      return;
    }
    if (selectedReason === 'other' && !details.trim()) {
      ToastAndroid.show('Por favor, proporciona detalles para la razón "Otro".', ToastAndroid.SHORT);
      return;
    }
    const currentUserId = await getUserId();
    if (!id || !currentUserId) {
      ToastAndroid.show('No se pudo identificar el servicio o el usuario. Intentá de nuevo.', ToastAndroid.SHORT);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('reports')
        .insert([
          {
            service_id: id,
            reporter_user_id: currentUserId,
            reason_category: selectedReason,
            details: details.trim() || null, // Guarda null si details está vacío
            // status por defecto es 'pending'
          },
        ]);

      if (error) {
        throw error;
      }

      ToastAndroid.show('Gracias, hemos recibido tu reporte y lo revisaremos pronto.', ToastAndroid.LONG);
      onClose();
      resetFields();
    } catch (error) {
      console.error('Error submitting report:', error);
      ToastAndroid.show('No se pudo enviar el reporte. Inténtalo de nuevo más tarde.', ToastAndroid.SHORT);
    } finally {
      setIsLoading(false);
    }
  };

  const resetFields = () => {
    setSelectedReason('');
    setDetails('');
  };

  const handleCancelar = () => {
    onClose();
    resetFields();
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={() => {
        resetFields();
        onClose();
      }}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Reportar Servicio</Text>
          <Text style={styles.titulo}>{titulo}</Text>


          <Text style={styles.label}>Razón:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedReason}
              onValueChange={(itemValue) => setSelectedReason(itemValue)}
              style={styles.picker}
              dropdownIconColor="#1E90FF"
            >
              {REPORT_REASONS.map((reason) => (
                <Picker.Item key={reason.value} label={reason.label} value={reason.value} />
              ))}
            </Picker>
          </View>

          {selectedReason === 'other' && (
            <>
              <Text style={styles.label}>Detalles Adicionales:</Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={4}
                placeholder="Describe el problema..."
                value={details}
                onChangeText={setDetails}
              />
            </>
          )}

          <ModalFooter
            isLoading={isLoading}
            onCancel={handleCancelar}
            onSubmit={handleReportSubmit}
            submitButtonText="Reportar"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'stretch', // Para que los inputs ocupen el ancho
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%', // Ancho del modal
  },
  modalTitle: {
    marginBottom: 5,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  titulo: {
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 16,
    color: '#888', // More gray color
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    marginTop: 10,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    overflow: 'hidden',
    justifyContent: 'center', // Center the picker vertically
  },
  picker: {
    height: 50,
    color: '#222',
    textAlign: 'center', // Center the text horizontally
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    textAlignVertical: 'top', // Para multiline en Android
    minHeight: 80,
  },
});

export default ReportServiceModal;
