import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export interface Tarjeta {
  id: string;
  sobrenombre: string;
  saldo: number;
  estado: boolean; // true = activo, false = inactivo
}

// Añadimos un tipo para la UI
interface TarjetaUI extends Tarjeta {
  estadoStr: 'activo' | 'inactivo';
}

interface TarjetasResponse {
  tarjetas: Tarjeta[];
}

interface Props {
  refreshSignal: number;
}

const CardList: React.FC<Props> = ({ refreshSignal }) => {
  const [tarjetas, setTarjetas] = useState<TarjetaUI[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState<TarjetaUI | null>(null);
  const [aliasEdit, setAliasEdit] = useState('');
  const [montoRecarga, setMontoRecarga] = useState('');

  // Fetch tarjetas y convertir estado
  const fetchTarjetas = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const resp = await axios.get<TarjetasResponse>(
        'https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const withStr: TarjetaUI[] = resp.data.tarjetas.map(t => ({
        ...t,
        estadoStr: t.estado ? 'activo' : 'inactivo',
      }));
      setTarjetas(withStr);
    } catch (e) {
      console.error('Error al obtener tarjetas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTarjetas();
  }, [refreshSignal]);

  const openModal = (t: TarjetaUI) => {
    setTarjetaSeleccionada(t);
    setAliasEdit(t.sobrenombre);
    setMontoRecarga('');
    setModalVisible(true);
  };
  const closeModal = () => {
    setModalVisible(false);
    setTarjetaSeleccionada(null);
  };

  // Actualizar alias
  const handleUpdate = async () => {
    if (!tarjetaSeleccionada) return;
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        'https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas/editar',
        {
          nfc_uid: tarjetaSeleccionada.id,
          nuevo_alias: aliasEdit,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchTarjetas();
      Alert.alert('Éxito', 'Alias actualizado correctamente');
      closeModal();
    } catch (error: any) {
      console.error('Error al actualizar alias:', error);
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo actualizar el alias.');
    }
  };

  // Eliminar tarjeta
const handleDelete = () => {
  if (!tarjetaSeleccionada) return;

  Alert.alert(
    'Eliminar tarjeta',
    '¿Seguro que quieres eliminar esta tarjeta?',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            await axios.delete(
              `https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas/${tarjetaSeleccionada.id}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            await fetchTarjetas(); // Refrescar la lista después de eliminar
            closeModal(); // Cerrar el modal
          } catch (error) {
            console.error('Error al eliminar tarjeta:', error);
            Alert.alert('Error', 'No se pudo eliminar la tarjeta.');
          }
        },
      },
    ]
  );
};



  // Recargar saldo
  const handleRecarga = async () => {
    if (!tarjetaSeleccionada) return;
    const monto = parseFloat(montoRecarga);
    if (isNaN(monto) || monto <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido mayor que 0.');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        'https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas/recargar',
        { nfc_uid: tarjetaSeleccionada.id, saldo: monto },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchTarjetas();
      Alert.alert('¡Éxito!', `Recargaste RD$${monto.toFixed(2)}.`);
      setMontoRecarga('');
    } catch {
      Alert.alert('Error', 'No se pudo recargar la tarjeta.');
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" style={{ marginTop: 20 }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={tarjetas}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openModal(item)}>
            <View style={styles.card}>
              <Text style={styles.title}>{item.sobrenombre}</Text>
              <Text style={styles.info}>Saldo: RD${item.saldo.toFixed(2)}</Text>
              <Text
                style={[
                  styles.estado,
                  item.estadoStr === 'activo' ? styles.activo : styles.inactivo,
                ]}
              >
                Estado: {item.estadoStr}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />

      {/* Modal de administración */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Administrar Tarjeta</Text>
            <Text>ID: {tarjetaSeleccionada?.id}</Text>
            <Text>Saldo: RD${tarjetaSeleccionada?.saldo.toFixed(2)}</Text>
            <Text>Estado: {tarjetaSeleccionada?.estadoStr}</Text>

            {/* Recarga */}
            <View style={[styles.section, styles.rechargeSection]}>
              <Text style={styles.subtitle}>Recargar Saldo</Text>
              <TextInput
                style={styles.input}
                value={montoRecarga}
                onChangeText={setMontoRecarga}
                placeholder="Monto a recargar"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={[styles.button, styles.rechargeButton]} onPress={handleRecarga}>
                <Text style={styles.buttonText}>Recargar</Text>
              </TouchableOpacity>
            </View>

            {/* Editar alias */}
            <View style={[styles.section, styles.editSection]}>
              <Text style={styles.subtitle}>Editar Alias</Text>
              <TextInput
                style={styles.input}
                value={aliasEdit}
                onChangeText={setAliasEdit}
                placeholder="Nuevo alias"
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleUpdate}>
                <Text style={styles.buttonText}>Guardar Cambios</Text>
              </TouchableOpacity>
            </View>

            {/* Eliminar */}
            <View style={[styles.section, styles.deleteSection]}>
              <Text style={styles.subtitle}>Eliminar Tarjeta</Text>
              <Text style={styles.deleteWarning}>
                Esta acción es irreversible.
              </Text>
              <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
                <Text style={styles.buttonText}>Eliminar Tarjeta</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Text style={styles.closeText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#4e54c8',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  info: { fontSize: 16, color: '#fff', marginTop: 8 },
  estado: { marginTop: 8, fontWeight: '600' },
  activo: { color: '#0f0' },
  inactivo: { color: '#f00' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  section: { marginBottom: 20 },
  rechargeSection: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 16,
  },
  editSection: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  rechargeButton: { backgroundColor: '#28a745' },
  saveButton: { backgroundColor: '#4e54c8' },
  deleteSection: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 16,
  },
  deleteWarning: {
    color: '#b00020',
    marginBottom: 12,
    fontWeight: '600',
  },
  deleteButton: { backgroundColor: '#b00020' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  closeButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 8,
  },
  closeText: {
    color: '#888',
    fontSize: 16,
  },
});

export default CardList;
