import { AntDesign, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import CardList, { Tarjeta } from '../../components/cardList';

export default function RecargaScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingNfc, setLoadingNfc] = useState(false);
  const [success, setSuccess] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const scaleAnim = useState(new Animated.Value(0))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  const animateSuccess = () => {
    setSuccess(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        closeModal();
      }, 1500);
    });
  };

  const cancelNfcScan = async () => {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch (_) {}
  };

  const closeModal = async () => {
    await cancelNfcScan();
    setModalVisible(false);
    setLoadingNfc(false);
    setSuccess(false);
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
  };

  const startNfc = async () => {
  setLoadingNfc(true);
  try {
    const isSupported = await NfcManager.isSupported();
    if (!isSupported) {
      Alert.alert('⚠️ Este dispositivo no soporta NFC');
      return closeModal();
    }

    await NfcManager.start();
    await NfcManager.requestTechnology([NfcTech.Ndef]);

    const tag = await NfcManager.getTag();
    if (!tag?.id) throw new Error('No se detectó el UID del tag');

    const uidHex = typeof tag.id === 'string'
      ? tag.id.toUpperCase()
      : (tag.id as number[])
          .map(byte => byte.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();

    const token = await AsyncStorage.getItem('userToken');
    if (!token) throw new Error('No se encontró un token válido en AsyncStorage');

    const payload = {
      nfc_uid: uidHex,
      sobrenombre: `Tarjeta ${uidHex.slice(-4)}`,
      estado: true,
      saldo: 0,
    };

    const { status, data } = await axios.post(
      'https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas/registrar',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        validateStatus: status => status < 500,
      }
    );

    if (status !== 201) {
      throw new Error((data as { message?: string })?.message || `HTTP ${status}`);
    }
    

    await cancelNfcScan();
    setLoadingNfc(false);
    setRefreshSignal(prev => prev + 1);
    animateSuccess();
  } catch (ex: any) {
    console.warn(ex);
    closeModal();
    Alert.alert('⚠️ Error', ex.message || 'Error leyendo o registrando la tarjeta');
  }
};

  const onAddPress = () => {
    setModalVisible(true);
    setTimeout(startNfc, 500);
  };

  const onCardPress = (tarjeta: Tarjeta) => {
    alert(`Editar o ver tarjeta: ${tarjeta.sobrenombre}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <CardList refreshSignal={refreshSignal} />
      </View>

      <TouchableOpacity style={styles.addButton} onPress={onAddPress} disabled={loadingNfc}>
        <AntDesign name="pluscircle" size={56} color="#4e54c8" />
      </TouchableOpacity>

      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <AntDesign name="closecircle" size={24} color="#999" />
            </TouchableOpacity>

            {loadingNfc && !success ? (
              <>
                <Ionicons name="radio-outline" size={48} color="#4e54c8" />
                <Text style={styles.modalTitle}>Acerca tu tarjeta NFC</Text>
                <ActivityIndicator size="large" color="#4e54c8" style={{ marginTop: 10 }} />
                <Text style={styles.modalSubText}>Procesando...</Text>
              </>
            ) : success ? (
              <Animated.View
                style={[
                  styles.successContainer,
                  {
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                  },
                ]}
              >
                <AntDesign name="checkcircle" size={72} color="#4BB543" />
                <Text style={styles.modalTitle}>¡Tarjeta registrada!</Text>
              </Animated.View>
            ) : (
              <>
                <Ionicons name="radio-outline" size={48} color="#4e54c8" />
                <Text style={styles.modalTitle}>Acerca tu tarjeta NFC</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  content: { flex: 1, paddingTop: 20 },

  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBox: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    position: 'relative',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  successContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 12,
    color: '#333',
  },

  modalSubText: {
    fontSize: 16,
    marginTop: 8,
    color: '#777',
  },
});
