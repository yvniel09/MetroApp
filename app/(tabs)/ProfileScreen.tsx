// app/MainScreen.tsx
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logout } from '../auth'; // Ajusta ruta si auth.ts queda en otro directorio

const ProfileScreen = () => {
    const navigation = useNavigation();

    const handleLogout = async () => {
        const success = await logout();
        if (success) {
            Alert.alert('Sesión cerrada', 'Has cerrado sesión correctamente');
            router.replace('/login');
        } else {
            Alert.alert('Error', 'No se pudo cerrar la sesión');
        }
    };

    return (
    <>
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.placeholderText}>Perfil</Text>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    logoutButton: {
        marginTop: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#007AFF',
        borderRadius: 5,
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 16,
    },
});

export default ProfileScreen;