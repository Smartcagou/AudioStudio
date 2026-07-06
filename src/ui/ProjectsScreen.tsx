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

import { Project } from '../storage/models';
import {
  createProject,
  deleteProject,
  getProjectTrackCounts,
  getProjects,
} from '../library/ProjectManager';
import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Projects'>;

export function ProjectsScreen({ navigation }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState('');

  const refresh = useCallback(async () => {
    const [list, trackCounts] = await Promise.all([getProjects(), getProjectTrackCounts()]);
    setProjects(list);
    setCounts(trackCounts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function onCreate() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    const project = await createProject(trimmed);
    setName('');
    await refresh();
    navigation.navigate('ProjectDetail', { projectId: project.id });
  }

  function onDelete(project: Project) {
    Alert.alert('Supprimer le projet', `Supprimer "${project.name}" et ses pistes ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteProject(project);
          await refresh();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nom du projet"
          placeholderTextColor={palette.textSecondary}
          returnKeyType="done"
          onSubmitEditing={onCreate}
        />
        <TouchableOpacity
          style={[styles.createButton, name.trim().length === 0 && styles.createButtonDisabled]}
          onPress={onCreate}
          disabled={name.trim().length === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.createButtonText}>Creer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {projects.length === 0 ? (
          <Text style={styles.empty}>Aucun projet. Creez-en un pour commencer.</Text>
        ) : (
          projects.map((project) => {
            const count = counts[project.id] ?? 0;
            return (
              <TouchableOpacity
                key={project.id}
                style={styles.card}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
                onLongPress={() => onDelete(project)}
                activeOpacity={0.7}
              >
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {project.name}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {count} piste{count > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.cardCount}>{count}</Text>
              </TouchableOpacity>
            );
          })
        )}
        {projects.length > 0 ? (
          <Text style={styles.hint}>Appui long sur un projet pour le supprimer.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.surface,
    ...raisedBorders,
    color: palette.textPrimary,
    fontSize: 15,
  },
  createButton: {
    marginLeft: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center',
    elevation: 3,
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.textOnAccent,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: {
    color: palette.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: palette.surface,
    ...raisedBorders,
    elevation: 3,
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  cardMeta: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 4,
  },
  cardCount: {
    fontSize: 40,
    fontWeight: '800',
    color: palette.accent,
  },
  hint: {
    fontSize: 12,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
