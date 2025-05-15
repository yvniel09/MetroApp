// src/utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const logout = async () => {
  try {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userEmail');
    
    return true;
  } catch (error) {return false;}
};
