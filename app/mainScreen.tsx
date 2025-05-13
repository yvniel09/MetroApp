// app/MainScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logout } from './auth'; // Ajusta ruta si auth.ts queda en otro directorio

type RootStackParamList = {
  RechargeScreen: undefined;
  ProfileScreen: undefined;
  ReportScreen: undefined;
  Login: undefined;
};

// Permite tipar navigation.navigate
import { StackNavigationProp } from '@react-navigation/stack';
type MainScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RechargeScreen'>;

const MainScreen: React.FC = () => {
  const router = useRouter();

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      Alert.alert('Sesión cerrada', 'Has cerrado sesión correctamente');
      router.replace('./login');
    } else {
      Alert.alert('Error', 'No se pudo cerrar la sesión');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Main content area: aquí va la lógica de tarjetas */}
      <View style={styles.content}>
        <Text style={styles.placeholderText}>Gestión de tarjetas</Text>
      </View>

      {/* Bottom navigation bar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.replace('/screens/ReportScreen')}>
          <Ionicons name="bar-chart-outline" size={28} color="#007AFF" />
          <Text style={styles.navText}>Uso</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navButton, styles.rechargeButton]} onPress={() => router.replace('/screens/RechargeScreen')}>
          <Ionicons name="add-circle" size={52} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => router.replace('/screens/ProfileScreen')}>
          <Ionicons name="person-circle-outline" size={28} color="#007AFF" />
            <Text style={styles.navText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default MainScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 18, color: '#888' },
  navbar: {
    flexDirection: 'row',
    height: 70,
    borderTopWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 5,
  },
  navButton: { alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, color: '#555', marginTop: 2 },
  rechargeButton: {
    bottom: 10,
    backgroundColor: '#fff',
    borderRadius: 35,
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  logoutButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    padding: 10,
    borderRadius: 8,
  },
  logoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 5 },
});
