import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from './src/ui/HomeScreen';
import { PlayerScreen } from './src/ui/PlayerScreen';
import { EngineeringScreen } from './src/ui/EngineeringScreen';
import { MixerScreen } from './src/ui/MixerScreen';
import { RootStackParamList } from './src/ui/navigation';
import { initDatabase } from './src/storage/database';
import { setupLibraryPlayer } from './src/player/LibraryPlayer';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await setupLibraryPlayer();
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Initialisation impossible');
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'AudioStudio' }}
          />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{ title: 'Lecteur' }}
          />
          <Stack.Screen
            name="Engineering"
            component={EngineeringScreen}
            options={{ title: 'Ingenierie sonore' }}
          />
          <Stack.Screen
            name="Mixer"
            component={MixerScreen}
            options={{ title: 'Mixage multipiste' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  errorText: {
    color: '#b00020',
    fontSize: 15,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
