import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';

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
        label="Projets"
        description="Organiser vos sons et les travailler : mixage, looper, enregistreur, effets"
        onPress={() => navigation.navigate('Projects')}
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
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  module: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: palette.surface,
    ...raisedBorders,
    elevation: 3,
  },
  moduleTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
    color: palette.textPrimary,
  },
  moduleText: {
    fontSize: 13,
    color: palette.textSecondary,
  },
});
