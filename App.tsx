import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as NavigationBar from 'expo-navigation-bar';

import { palette } from './src/ui/theme';

import { HomeScreen } from './src/ui/HomeScreen';
import { PlayerScreen } from './src/ui/PlayerScreen';
import { NowPlayingScreen } from './src/ui/NowPlayingScreen';
import { ProjectsScreen } from './src/ui/ProjectsScreen';
import { ProjectDetailScreen } from './src/ui/ProjectDetailScreen';
import { EngineeringScreen } from './src/ui/EngineeringScreen';
import { MixerScreen } from './src/ui/MixerScreen';
import { LooperScreen } from './src/ui/LooperScreen';
import { RootStackParamList } from './src/ui/navigation';
import { initDatabase } from './src/storage/database';
import { setupLibraryPlayer } from './src/player/LibraryPlayer';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Thème sombre appliqué à toute la navigation (charte graphique de l'app).
const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: palette.background,
    card: palette.surface,
    text: palette.textPrimary,
    border: palette.border,
    primary: palette.accent,
    notification: palette.accent,
  },
};

// Mode immersif Android : la barre de navigation système reste cachée et ne
// réapparaît que transitoirement quand l'utilisateur swipe depuis le bas.
// Réaffirmé au retour au premier plan (le système peut la réafficher).
function useImmersiveNavigationBar() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const hide = () => {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    };
    hide();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') hide();
    });
    return () => subscription.remove();
  }, []);
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImmersiveNavigationBar();

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
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: palette.surface },
            headerTintColor: palette.textPrimary,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'AudioStudio' }}
          />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="NowPlaying"
            component={NowPlayingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Projects"
            component={ProjectsScreen}
            options={{ title: 'Projets' }}
          />
          <Stack.Screen
            name="ProjectDetail"
            component={ProjectDetailScreen}
            options={{ title: 'Projet' }}
          />
          <Stack.Screen
            name="Engineering"
            component={EngineeringScreen}
            options={{ title: 'Enregistreur' }}
          />
          <Stack.Screen
            name="Mixer"
            component={MixerScreen}
            options={{ title: 'Mixage multipiste' }}
          />
          <Stack.Screen
            name="Looper"
            component={LooperScreen}
            options={{ title: 'Looper' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  errorText: {
    color: palette.danger,
    fontSize: 15,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
