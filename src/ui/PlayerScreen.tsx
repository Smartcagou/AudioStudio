import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { State, useActiveTrack, usePlaybackState } from 'react-native-track-player';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';
import { LibraryFile } from '../storage/models';
import { importFile, listFiles, removeFile } from '../library/LibraryManager';
import { loadQueue, pause, play, playFileAt } from '../player/LibraryPlayer';

type Props = NativeStackScreenProps<RootStackParamList, 'Player'>;

export function PlayerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [busy, setBusy] = useState(false);
  const playback = usePlaybackState();
  const activeTrack = useActiveTrack();

  const isPlaying = playback.state === State.Playing;

  const refresh = useCallback(async () => {
    const next = await listFiles();
    setFiles(next);
    await loadQueue(next);
  }, []);

  useEffect(() => {
    refresh().catch((err: unknown) => {
      console.error('[PlayerScreen] refresh failed:', err);
    });
  }, [refresh]);

  async function onImport() {
    if (busy) return;
    setBusy(true);
    try {
      const imported = await importFile();
      if (imported) {
        await refresh();
      }
    } catch (err) {
      Alert.alert('Import impossible', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  }

  function onRemove(file: LibraryFile) {
    Alert.alert('Retirer', `Retirer "${file.filename}" de la bibliotheque ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          removeFile(file)
            .then(refresh)
            .catch((err: unknown) => {
              Alert.alert(
                'Suppression impossible',
                err instanceof Error ? err.message : 'Erreur inconnue',
              );
            });
        },
      },
    ]);
  }

  function onPlayRow(index: number, open: boolean) {
    playFileAt(index)
      .then(() => {
        if (open) navigation.navigate('NowPlaying');
      })
      .catch((err: unknown) => {
        console.error('[PlayerScreen] play file failed:', err);
      });
  }

  function onRowButton(item: LibraryFile, index: number) {
    if (activeTrack?.id === item.id) {
      const action = isPlaying ? pause() : play();
      action.catch((err: unknown) => console.error('[PlayerScreen] toggle failed:', err));
    } else {
      onPlayRow(index, false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.roundIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={palette.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Bibliotheque</Text>
        <Pressable style={styles.roundIcon} onPress={onImport} disabled={busy}>
          <Ionicons
            name={busy ? 'hourglass-outline' : 'add'}
            size={24}
            color={busy ? palette.textSecondary : palette.accent}
          />
        </Pressable>
      </View>

      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun fichier. Importez un fichier audio pour commencer.</Text>
        }
        renderItem={({ item, index }) => {
          const active = activeTrack?.id === item.id;
          const showPause = active && isPlaying;
          return (
            <Pressable
              style={[styles.row, active && styles.rowActive]}
              onPress={() => onPlayRow(index, true)}
              onLongPress={() => onRemove(item)}
            >
              <View style={styles.rowText}>
                <Text
                  style={[styles.rowTitle, active && styles.rowTitleActive]}
                  numberOfLines={1}
                >
                  {item.title ?? item.filename}
                </Text>
                <Text
                  style={[styles.rowMeta, active && styles.rowMetaActive]}
                  numberOfLines={1}
                >
                  {item.artist ?? formatSize(item.sizeBytes)}
                </Text>
              </View>
              <Pressable
                style={[styles.rowButton, active && styles.rowButtonActive]}
                onPress={() => onRowButton(item, index)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPause ? 'pause' : 'play'}
                  size={18}
                  color={active ? palette.textOnAccent : palette.textPrimary}
                  style={showPause ? undefined : styles.playGlyphOffset}
                />
              </Pressable>
            </Pressable>
          );
        }}
      />

      {activeTrack ? (
        <Pressable
          style={[styles.miniBar, { marginBottom: insets.bottom + 8 }]}
          onPress={() => navigation.navigate('NowPlaying')}
        >
          <View style={styles.miniArt}>
            <Ionicons name="musical-notes" size={18} color={palette.textSecondary} />
          </View>
          <View style={styles.miniText}>
            <Text style={styles.miniTitle} numberOfLines={1}>
              {activeTrack.title ?? 'Lecture'}
            </Text>
            <Text style={styles.miniArtist} numberOfLines={1}>
              {activeTrack.artist ?? 'Bibliotheque'}
            </Text>
          </View>
          <Pressable
            style={styles.miniButton}
            onPress={() => {
              const action = isPlaying ? pause() : play();
              action.catch((err: unknown) => console.error('[PlayerScreen] mini toggle failed:', err));
            }}
            hitSlop={8}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={palette.textOnAccent}
              style={isPlaying ? undefined : styles.playGlyphOffset}
            />
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  roundIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    ...raisedBorders,
    elevation: 3,
  },
  listContent: {
    paddingBottom: 12,
  },
  empty: {
    color: palette.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: palette.surface,
  },
  rowActive: {
    backgroundColor: palette.pill,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  rowTitleActive: {
    color: palette.textOnAccent,
  },
  rowMeta: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 3,
  },
  rowMetaActive: {
    color: palette.textOnAccent,
    opacity: 0.85,
  },
  rowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceRaised,
  },
  rowButtonActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  playGlyphOffset: {
    marginLeft: 3,
  },
  miniBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 20,
    backgroundColor: palette.surface,
    ...raisedBorders,
    elevation: 6,
  },
  miniArt: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceRaised,
  },
  miniText: {
    flex: 1,
    marginHorizontal: 12,
  },
  miniTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  miniArtist: {
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  miniButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    elevation: 4,
  },
});
