// src/utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const logout = async () => {
  try {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userEmail');
    alert('Sesión cerrada correctamente');
    console.log('Sesión cerrada correctamente');
    return true;
  } catch (error) {
   alert('Error al cerrar sesión');
   console.error('Error al cerrar sesión', error);
    return false;
  }
};
