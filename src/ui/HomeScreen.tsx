import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from './navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <ModuleButton
        label="Lecteur"
        description="Lecture multi-formats et bibliotheque"
        onPress={() => navigation.navigate('Player')}
      />
      <ModuleButton
        label="Ingenierie sonore"
        description="Metronome, enregistreur, mixage, looper, effets temps reel"
        onPress={() => navigation.navigate('Engineering')}
      />
      <ModuleButton
        label="Export"
        description="Rendu et encodage multi-formats"
        onPress={() => Alert.alert('Export', 'Disponible dans un prochain lot.')}
      />
    </View>
  );
}

interface ModuleButtonProps {
  label: string;
  description: string;
  onPress: () => void;
}

function ModuleButton({ label, description, onPress }: ModuleButtonProps) {
  return (
    <TouchableOpacity style={styles.module} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.moduleTitle}>{label}</Text>
      <Text style={styles.moduleText}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  module: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  moduleTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
    color: '#111111',
  },
  moduleText: {
    fontSize: 13,
    color: '#666666',
  },
});
