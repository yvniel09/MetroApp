// components/CardList.tsx

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
  estado: boolean;   // ahora booleano
}

interface TarjetasResponse {
  tarjetas: Tarjeta[];
}

interface Props {
  refreshSignal: number;
}

const CardList: React.FC<Props> = ({ refreshSignal }) => {
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [tarjetaSel, setTarjetaSel] = useState<Tarjeta | null>(null);
  const [aliasEdit, setAliasEdit] = useState('');
  const [montoRecarga, setMontoRecarga] = useState('');

  // Obtener y mapear tarjetas
  const fetchTarjetas = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const { data } = await axios.get<TarjetasResponse>(
        'https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTarjetas(data.tarjetas);
    } catch (e) {
      console.error('Error al obtener tarjetas:', e);
      Alert.alert('Error', 'No se pudieron cargar las tarjetas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTarjetas();
  }, [refreshSignal]);

  // Abre modal
  const openModal = (t: Tarjeta) => {
    setTarjetaSel(t);
    setAliasEdit(t.sobrenombre);
    setMontoRecarga('');
    setModalVisible(true);
  };
  const closeModal = () => {
    setModalVisible(false);
    setTarjetaSel(null);
  };

  // Edición de alias
  const handleUpdate = async () => {
    if (!tarjetaSel) return;
    const nuevo_alias = aliasEdit.trim();
    if (!nuevo_alias) {
      return Alert.alert('Error', 'El alias no puede quedar vacío.');
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        'https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas/editar',
        { nfc_uid: tarjetaSel.id, nuevo_alias },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('¡Éxito!', 'Alias actualizado correctamente.');
      await fetchTarjetas();
      closeModal();
    } catch (err: any) {
      console.error('Error al actualizar alias:', err);
      Alert.alert('Error', err.response?.data?.message || 'No se pudo actualizar el alias.');
    }
  };

  // Eliminación
  const handleDelete = () => {
    if (!tarjetaSel) return;
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
                `https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas/${tarjetaSel.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              await fetchTarjetas();
              closeModal();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la tarjeta.');
            }
          },
        },
      ]
    );
  };

  // Recarga de saldo
  const handleRecarga = async () => {
    if (!tarjetaSel) return;
    const monto = parseFloat(montoRecarga);
    if (isNaN(monto) || monto <= 0) {
      return Alert.alert('Error', 'Ingresa un monto válido mayor que 0.');
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        'https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas/recargar',
        { nfc_uid: tarjetaSel.id, saldo: monto },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('¡Éxito!', `Recargaste RD$${monto.toFixed(2)}.`);
      await fetchTarjetas();
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
        keyExtractor={i => i.id}
        renderItem={({ item }) => {
          const estadoStr = item.estado ? 'activo' : 'inactivo';
          return (
            <TouchableOpacity onPress={() => openModal(item)}>
              <View style={styles.card}>
                <Text style={styles.title}>{item.sobrenombre}</Text>
                <Text style={styles.info}>Saldo: RD${item.saldo.toFixed(2)}</Text>
                <Text style={[styles.estado, estadoStr==='activo'?styles.activo:styles.inactivo]}>
                  Estado: {estadoStr}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />

      {/* Modal de administración */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Administrar Tarjeta</Text>
            <Text>ID: {tarjetaSel?.id}</Text>
            <Text>Saldo: RD${tarjetaSel?.saldo.toFixed(2)}</Text>
            <Text>
              Estado: {(tarjetaSel?.estado ?? false) ? 'activo' : 'inactivo'}
            </Text>

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
              <TouchableOpacity
                style={[styles.button, styles.rechargeButton]}
                onPress={handleRecarga}
              >
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
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdate}
              >
                <Text style={styles.buttonText}>Guardar Cambios</Text>
              </TouchableOpacity>
            </View>

            {/* Eliminar tarjeta */}
            <View style={[styles.section, styles.deleteSection]}>
              <Text style={styles.subtitle}>Eliminar Tarjeta</Text>
              <Text style={styles.deleteWarning}>
                Esta acción es irreversible.
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={handleDelete}
              >
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

export default CardList;

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
  deleteSection: {
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
