import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// --- API Types ---
type LoginResponse = {
  token: string;
  user: {
    uid: string;
    email: string;
    name: string;
    username: string;
    phoneNumber: string;
  };
};

// --- Form data types ---
type FormData = {
  // Required fields for register
  email: string;
  password: string;
  username?: string;
  name?: string;
  phoneNumber?: string;
};

// --- Main component ---
const RegisterLoginScreen: React.FC = () => {
  const router = useRouter();
  // Toggle between register and login tabs
  const [isRegister, setIsRegister] = useState<boolean>(true);
  // Flag to know if user has an existing session
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // react-hook-form setup with validation
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { email: '', username: '', password: '', name: '', phoneNumber: '' },
  });

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        setHasSession(true);
        setIsRegister(false);
      } else {
        setHasSession(false);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setHasSession(false);
    }
  };

  // API calls
  const registerUser = async (data: FormData): Promise<LoginResponse> => {
    const response = await fetch('https://us-central1-metroapp-56fb6.cloudfunctions.net/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: data.name,
        username: data.username,
        phoneNumber: data.phoneNumber
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  };

  const loginUser = async (data: FormData): Promise<LoginResponse> => {
    const response = await fetch('https://us-central1-metroapp-56fb6.cloudfunctions.net/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  };

  // Save session after successful auth
  const saveSession = async (token: string) => {
    await AsyncStorage.setItem('userToken', token);
  };

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      let response: LoginResponse;
      
      if (isRegister) {
        response = await registerUser(data);
        // After successful registration, switch to login
        setIsRegister(false);
        reset({ email: data.email, password: '' });
        Alert.alert('Success', 'Registration successful! Please login.');
      } else {
        response = await loginUser(data);
        await saveSession(response.token);
        // Navigate to success screen
        router.replace('/success');
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Attempt biometric login
  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autentícate',
      });
      if (result.success) {
        // Navigate to success screen
        router.replace('/success');
      }
    } catch (e) {
      console.warn('Biometric error', e);
    }
  };

  if (hasSession === null) {
    // Still loading storage
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {/* Header image */}
      <Image
        source={require('../assets/images/icon.png')}
        style={styles.headerImage}
      />

      {/* Form area */}
      <View style={styles.formContainer}>
        {/* Only show tabs if no existing session */}
        {hasSession === false && (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              onPress={() => setIsRegister(false)}
              style={[styles.tab, !isRegister && styles.activeTab]}
            >
              <Text style={[styles.tabText, !isRegister && styles.activeTabText]}>Iniciar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsRegister(true)}
              style={[styles.tab, isRegister && styles.activeTab]}
            >
              <Text style={[styles.tabText, isRegister && styles.activeTabText]}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Email field */}
        <Controller
          control={control}
          name="email"
          rules={{ 
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          }}
          render={({ field: { onChange, value } }) => (
            <View>
              <TextInput
                placeholder="Email"
                style={[styles.input, errors.email && styles.inputError]}
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email.message}</Text>
              )}
            </View>
          )}
        />

        {/* Registration fields */}
        {isRegister && hasSession === false && (
          <>
            <Controller
              control={control}
              name="name"
              rules={{ required: 'Name is required' }}
              render={({ field: { onChange, value } }) => (
                <View>
                  <TextInput
                    placeholder="Nombre completo"
                    style={[styles.input, errors.name && styles.inputError]}
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors.name && (
                    <Text style={styles.errorText}>{errors.name.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="username"
              rules={{ required: 'Username is required' }}
              render={({ field: { onChange, value } }) => (
                <View>
                  <TextInput
                    placeholder="Nombre de usuario"
                    style={[styles.input, errors.username && styles.inputError]}
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors.username && (
                    <Text style={styles.errorText}>{errors.username.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="phoneNumber"
              rules={{ required: 'Phone number is required' }}
              render={({ field: { onChange, value } }) => (
                <View>
                  <TextInput
                    placeholder="Número de teléfono"
                    style={[styles.input, errors.phoneNumber && styles.inputError]}
                    keyboardType="phone-pad"
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors.phoneNumber && (
                    <Text style={styles.errorText}>{errors.phoneNumber.message}</Text>
                  )}
                </View>
              )}
            />
          </>
        )}

        {/* Password field */}
        <Controller
          control={control}
          name="password"
          rules={{ 
            required: 'Password is required',
            minLength: {
              value: 6,
              message: 'Password must be at least 6 characters'
            }
          }}
          render={({ field: { onChange, value } }) => (
            <View>
              <TextInput
                placeholder="Contraseña"
                style={[styles.input, errors.password && styles.inputError]}
                secureTextEntry
                value={value}
                onChangeText={onChange}
              />
              {errors.password && (
                <Text style={styles.errorText}>{errors.password.message}</Text>
              )}
            </View>
          )}
        />

        {/* If session exists, show biometric button */}
        {hasSession && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricAuth}
          >
            <Ionicons name="finger-print-outline" size={20} />
            <Text style={styles.biometricText}>Usar huella</Text>
          </TouchableOpacity>
        )}

        {/* Action buttons: register or login */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Additional link only in login mode */}
        {!isRegister && hasSession === false && (
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.orText}>o</Text>
          <View style={styles.line} />
        </View>

        {/* Google login (always shown) */}
        <TouchableOpacity style={styles.googleButton}>
          <Ionicons name="logo-google" size={20} />
          <Text style={styles.googleText}>Continuar con Google</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default RegisterLoginScreen;

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerImage: { width: '100%', height: 220, resizeMode: 'cover' },
  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    marginTop: -20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  tabContainer: { flexDirection: 'row', marginBottom: 20, borderRadius: 8, backgroundColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#fff', borderBottomWidth: 2, borderColor: '#007AFF' },
  tabText: { color: '#999', fontWeight: 'bold' },
  activeTabText: { color: '#007AFF' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, marginBottom: 15 },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 10,
  },
  biometricText: { marginLeft: 10, fontWeight: 'bold' },
  submitButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontWeight: 'bold' },
  linkButton: { alignSelf: 'flex-end', marginTop: 10 },
  linkText: { color: '#007AFF' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#ccc' },
  orText: { marginHorizontal: 10, color: '#999' },
  googleButton: { flexDirection: 'row', alignItems: 'center', borderColor: '#ccc', borderWidth: 1, padding: 12, borderRadius: 10, justifyContent: 'center' },
  googleText: { marginLeft: 10, fontWeight: 'bold' },
  inputError: {
    borderColor: '#ff3b30',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 5,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
});
