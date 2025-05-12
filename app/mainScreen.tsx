// MainScreen.tsx
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Button, View } from 'react-native';
import { logout } from './auth'; // Ajusta la ruta según tu estructura

const MainScreen = () => {
  const navigation = useNavigation();

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      Alert.alert('Sesión cerrada', 'Has cerrado sesión correctamente');
      router.replace('/login'); // O reemplaza si usas stack.replace
    } else {
      Alert.alert('Error', 'No se pudo cerrar la sesión');
    }
  };

  return (
    <View>
      <Button title="Cerrar sesión" onPress={handleLogout} />
    </View>
  );
};

export default MainScreen;
