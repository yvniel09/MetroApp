import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      {/* Pestaña 1: Reportes */}
      <Tabs.Screen
        name="ReportScreen"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
          tabBarLabel: 'Reportes', // Puedes poner la etiqueta aquí si la quieres explícita
        }}
      />

      {/* Pestaña 2: Recargar */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recargar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
          tabBarLabel: 'Recargar', // Etiqueta explícita
        }}
      />

      {/* Pestaña 3: Perfil */}
      <Tabs.Screen
        name="ProfileScreen"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
          tabBarLabel: 'Perfil', // Etiqueta explícita
        }}
      />
      <Tabs.Screen
        name="NFCtab"
        options={{
          title: 'Procesar pase',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="navigate-outline" size={size} color={color} />
          ),
          tabBarLabel: 'Recargar', // Etiqueta explícita
        }}
      />
    </Tabs>
  );
}
