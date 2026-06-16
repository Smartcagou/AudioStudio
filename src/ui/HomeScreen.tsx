import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';

import { AppState, ActiveModule, initialAppState } from '../state/store';

export function HomeScreen() {
  const [state, setState] = useState<AppState>(initialAppState);

  function selectModule(module: ActiveModule) {
    setState((prev) => ({ ...prev, activeModule: module }));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AudioStudio</Text>

      <ModuleButton
        label="Lecteur"
        description="Lecture multi-formats et bibliotheque"
        active={state.activeModule === 'player'}
        onPress={() => selectModule('player')}
      />
      <ModuleButton
        label="Ingenierie sonore"
        description="Enregistreur, mixage, looper, effets temps reel"
        active={state.activeModule === 'engineering'}
        onPress={() => selectModule('engineering')}
      />
      <ModuleButton
        label="Export"
        description="Rendu et encodage multi-formats"
        active={state.activeModule === 'export'}
        onPress={() => selectModule('export')}
      />
    </View>
  );
}

interface ModuleButtonProps {
  label: string;
  description: string;
  active: boolean;
  onPress: () => void;
}

function ModuleButton({ label, description, active, onPress }: ModuleButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.module, active && styles.moduleActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.moduleTitle, active && styles.moduleTitleActive]}>{label}</Text>
      <Text style={styles.moduleText}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 32,
    color: '#111111',
  },
  module: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  moduleActive: {
    borderColor: '#111111',
    backgroundColor: '#f0f0f0',
  },
  moduleTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333333',
  },
  moduleTitleActive: {
    color: '#111111',
  },
  moduleText: {
    fontSize: 13,
    color: '#666666',
  },
});
