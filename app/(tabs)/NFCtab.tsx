import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import NfcManager, { NfcEvents, TagEvent } from 'react-native-nfc-manager';

type VerificationResponse = {
  status: string; // "ok" o "error"
  message?: string;
  nuevoSaldo?: number;
};

const API_URL = 'https://us-central1-metroapp-56fb6.cloudfunctions.net/api/tarjetas/verificar';

// 1. Verifica tarjeta en API, sacando token automáticamente
const verificarTarjetaEnAPI = async (nfc_uid: string): Promise<VerificationResponse | null> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      console.warn('Token no encontrado');
      return null;
    }

    const response = await axios.post<VerificationResponse>(
      API_URL,
      { nfc_uid },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
  } catch (error: any) {
    console.warn('Error al verificar tarjeta:', error.response?.data || error.message);
    return null;
  }
};

// Inicializar NFC
NfcManager.start();

export default function NFCTab() {
  const [result, setResult] = useState<string | null>(null);
  const verifyingRef = useRef(false);
  const lastUidRef = useRef<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const ws = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // 2. Conexión WebSocket con ESP32
  useEffect(() => {
    const ipEsp = '10.0.0.223:80'; // IP de tu ESP32
    ws.current = new WebSocket(`ws://${ipEsp}/ws`);

    ws.current.onopen = () => {
      console.log('WebSocket conectado');
      setWsConnected(true);
    };
    ws.current.onclose = () => setWsConnected(false);
    ws.current.onerror = e => console.warn('WebSocket error:', e);
    ws.current.onmessage = e => console.log('Mensaje del ESP32:', e.data);

    return () => {
      ws.current?.close();
      ws.current = null;
    };
  }, []);

  // 3. Animación NFC
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, [pulse]);

  // 4. Enviar mensaje al ESP32
  const enviarMensajeESP32 = (mensaje: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(mensaje);
      console.log('✅ Mensaje enviado al ESP32:', mensaje);
    } else {
      console.warn('❌ WebSocket no está conectado');
    }
  };

  // 5. Manejar lectura NFC
  const handleTag = async ({ id }: TagEvent) => {
    const uid = id?.toUpperCase();
    if (!uid || verifyingRef.current || uid === lastUidRef.current) return;

    verifyingRef.current = true;
    lastUidRef.current = uid;
    setResult('Detectado, verificando...');

    const verificationResult = await verificarTarjetaEnAPI(uid);

    if (!verificationResult) {
      setResult('❌ Error al verificar');
      enviarMensajeESP32('STATUS:error;SALDO:0');
      resetAfterDelay();
      return;
    }

    const { status, nuevoSaldo } = verificationResult;
    const saldo = nuevoSaldo ?? 0;
    const mensajeParaESP = `STATUS:${status};SALDO:${saldo}`;
    enviarMensajeESP32(mensajeParaESP);

    setResult(`Estado: ${status === 'ok' ? '✔️ Aprobado' : '❌ Denegado'}\nSaldo restante: $${saldo}`);
    resetAfterDelay();
  };

  const resetAfterDelay = () => {
    setTimeout(() => {
      setResult(null);
      verifyingRef.current = false;
      lastUidRef.current = null;
    }, 3000);
  };

  // 6. Escuchar eventos NFC
  useFocusEffect(useCallback(() => {
    NfcManager.setEventListener(NfcEvents.DiscoverTag, handleTag);
    NfcManager.registerTagEvent().catch(e => console.warn('NFC no iniciado', e));
    return () => {
      NfcManager.unregisterTagEvent().catch(e => console.warn('NFC no detenido', e));
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    };
  }, []));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pulse, { transform: [{ scale: pulse }] }]} />
      <Text style={styles.title}>Acerca tu tarjeta NFC</Text>
      <Text style={styles.wsStatus}>
        WebSocket: {wsConnected ? '✔️ Conectado' : '❌ Desconectado'}
      </Text>
      {result ? (
        <View style={[styles.messageBox]}>
          <Text style={styles.messageText}>{result}</Text>
        </View>
      ) : (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
  pulse:        { width: 120, height: 120, borderRadius: 60, backgroundColor: '#4caf50', opacity: 0.3, position: 'absolute' },
  title:        { fontSize: 20, fontWeight: '600', marginTop: 140 },
  wsStatus:     { marginTop: 8, color: '#555' },
  messageBox:   { marginTop: 30, padding: 16, borderRadius: 12, backgroundColor: '#4caf50', width: '80%', alignItems: 'center' },
  messageText:  { fontSize: 16, textAlign: 'center', color: '#fff' }
});
