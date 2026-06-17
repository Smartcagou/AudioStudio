import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  State,
  useActiveTrack,
  usePlaybackState,
} from 'react-native-track-player';

import { LibraryFile } from '../storage/models';
import { importFile, listFiles, removeFile } from '../library/LibraryManager';
import {
  loadQueue,
  pause,
  play,
  playFileAt,
  skipToNext,
  skipToPrevious,
} from '../player/LibraryPlayer';

export function PlayerScreen() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [busy, setBusy] = useState(false);
  const playback = usePlaybackState();
  const activeTrack = useActiveTrack();

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

  const isPlaying = playback.state === State.Playing;

  function onTogglePlay() {
    const action = isPlaying ? pause() : play();
    action.catch((err: unknown) => {
      console.error('[PlayerScreen] toggle play failed:', err);
    });
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.importButton, busy && styles.importButtonDisabled]}
        onPress={onImport}
        disabled={busy}
        activeOpacity={0.7}
      >
        <Text style={styles.importButtonText}>
          {busy ? 'Import en cours' : 'Importer un fichier audio'}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun fichier. Importez un fichier audio pour commencer.</Text>
        }
        renderItem={({ item, index }) => {
          const active = activeTrack?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.row, active && styles.rowActive]}
              onPress={() => {
                playFileAt(index).catch((err: unknown) => {
                  console.error('[PlayerScreen] play file failed:', err);
                });
              }}
              onLongPress={() => onRemove(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowTitle, active && styles.rowTitleActive]} numberOfLines={1}>
                {item.title ?? item.filename}
              </Text>
              <Text style={styles.rowMeta}>{formatSize(item.sizeBytes)}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.transport}>
        <Text style={styles.nowPlaying} numberOfLines={1}>
          {activeTrack ? (activeTrack.title ?? 'Lecture') : 'Aucune lecture'}
        </Text>
        <View style={styles.controls}>
          <TransportButton label="Precedent" onPress={skipToPrevious} />
          <TransportButton label={isPlaying ? 'Pause' : 'Lecture'} onPress={onTogglePlay} primary />
          <TransportButton label="Suivant" onPress={skipToNext} />
        </View>
      </View>
    </View>
  );
}

interface TransportButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  primary?: boolean;
}

function TransportButton({ label, onPress, primary }: TransportButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.transportButton, primary && styles.transportButtonPrimary]}
      onPress={() => {
        Promise.resolve(onPress()).catch((err: unknown) => {
          console.error('[PlayerScreen] transport action failed:', err);
        });
      }}
      activeOpacity={0.7}
    >
      <Text style={[styles.transportButtonText, primary && styles.transportButtonTextPrimary]}>
        {label}
      </Text>
    </TouchableOpacity>
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
    backgroundColor: '#ffffff',
  },
  importButton: {
    margin: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
  },
  importButtonDisabled: {
    backgroundColor: '#999999',
  },
  importButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  empty: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  rowActive: {
    borderColor: '#111111',
    backgroundColor: '#f0f0f0',
  },
  rowTitle: {
    fontSize: 15,
    color: '#333333',
  },
  rowTitleActive: {
    color: '#111111',
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  transport: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  nowPlaying: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 12,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transportButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  transportButtonPrimary: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  transportButtonText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '600',
  },
  transportButtonTextPrimary: {
    color: '#ffffff',
  },
});
