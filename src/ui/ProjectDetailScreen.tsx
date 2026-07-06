import { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { Project, Track } from '../storage/models';
import {
  getProjectById,
  importSoundsToProject,
  listProjectTracks,
  removeTrack,
  renameProject,
} from '../library/ProjectManager';
import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;

export function ProjectDetailScreen({ navigation, route }: Props) {
  const { projectId } = route.params;
  const [project, setProject] = useState<Project | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [name, setName] = useState('');
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => {
    const [loaded, projectTracks] = await Promise.all([
      getProjectById(projectId),
      listProjectTracks(projectId),
    ]);
    setProject(loaded);
    setName(loaded?.name ?? '');
    setTracks(projectTracks);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function onRename() {
    const trimmed = name.trim();
    if (project === null || trimmed.length === 0 || trimmed === project.name) return;
    await renameProject(project.id, trimmed);
    await refresh();
  }

  async function onImport() {
    if (importing) return;
    setImporting(true);
    try {
      const count = await importSoundsToProject(projectId);
      if (count > 0) {
        await refresh();
        Alert.alert('Import', `${count} son${count > 1 ? 's' : ''} ajoute${count > 1 ? 's' : ''} au projet.`);
      }
    } catch (err) {
      Alert.alert('Import', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setImporting(false);
    }
  }

  function onDeleteTrack(track: Track) {
    Alert.alert('Supprimer la piste', `Supprimer "${track.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await removeTrack(track);
          await refresh();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            onBlur={onRename}
            onSubmitEditing={onRename}
            returnKeyType="done"
            placeholder="Nom du projet"
            placeholderTextColor={palette.textSecondary}
          />
          <View style={styles.countBox}>
            <Text style={styles.countValue}>{tracks.length}</Text>
            <Text style={styles.countLabel}>piste{tracks.length > 1 ? 's' : ''}</Text>
          </View>
        </View>

        <View style={styles.toolsRow}>
          <ToolButton label="Mixage" onPress={() => navigation.navigate('Mixer', { projectId })} />
          <ToolButton label="Looper" onPress={() => navigation.navigate('Looper', { projectId })} />
          <ToolButton
            label="Enregistreur"
            onPress={() => navigation.navigate('Engineering', { projectId })}
          />
        </View>

        <TouchableOpacity
          style={[styles.importButton, importing && styles.importButtonDisabled]}
          onPress={onImport}
          disabled={importing}
          activeOpacity={0.7}
        >
          <Text style={styles.importButtonText}>
            {importing ? 'Import en cours' : 'Importer des sons'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Pistes</Text>
        {tracks.length === 0 ? (
          <Text style={styles.empty}>
            Aucune piste. Importez des sons ou enregistrez une prise.
          </Text>
        ) : (
          tracks.map((track) => (
            <View key={track.id} style={styles.track}>
              <Text style={styles.trackName} numberOfLines={1}>
                {track.name}
              </Text>
              <TouchableOpacity
                style={styles.trackDelete}
                onPress={() => onDeleteTrack(track)}
                activeOpacity={0.7}
              >
                <Text style={styles.trackDeleteText}>Retirer</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

interface ToolButtonProps {
  label: string;
  onPress: () => void;
}

function ToolButton({ label, onPress }: ToolButtonProps) {
  return (
    <TouchableOpacity style={styles.toolButton} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.toolButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  nameInput: {
    flex: 1,
    marginRight: 16,
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
    paddingVertical: 4,
  },
  countBox: {
    alignItems: 'center',
    minWidth: 72,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: palette.surface,
    ...raisedBorders,
  },
  countValue: {
    fontSize: 34,
    fontWeight: '800',
    color: palette.accent,
  },
  countLabel: {
    fontSize: 11,
    color: palette.textSecondary,
  },
  toolsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  toolButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: palette.surface,
    ...raisedBorders,
    alignItems: 'center',
    elevation: 3,
  },
  toolButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  importButton: {
    marginTop: 4,
    marginBottom: 24,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    elevation: 4,
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textOnAccent,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: palette.textSecondary,
    marginBottom: 12,
  },
  empty: {
    color: palette.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: palette.surface,
    ...raisedBorders,
  },
  trackName: {
    flex: 1,
    fontSize: 15,
    color: palette.textPrimary,
    marginRight: 12,
  },
  trackDelete: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.surfaceRaised,
  },
  trackDeleteText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.danger,
  },
});
