import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getAudioEngine } from '../audio/engine/AudioEngine';
import { Looper, LooperState } from '../audio/looper/Looper';
import { addRecordingToProject } from '../library/ProjectManager';
import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Looper'>;

export function LooperScreen({ route }: Props) {
  const { projectId } = route.params;
  const looperRef = useRef<Looper | null>(null);
  if (looperRef.current === null) {
    looperRef.current = new Looper(getAudioEngine());
  }
  const looper = looperRef.current;

  const [state, setState] = useState<LooperState>('idle');
  const [layers, setLayers] = useState(0);
  const [loopDuration, setLoopDuration] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      looper.clear();
    };
  }, [looper]);

  function sync() {
    setState(looper.getState());
    setLayers(looper.getLayerCount());
    setLoopDuration(looper.getLoopDurationSec());
  }

  // Boucle de base à durée libre : 1er tap démarre la prise, 2e tap l'arrête.
  async function onToggleBase() {
    if (busy) return;
    setBusy(true);
    try {
      if (state === 'idle') {
        await looper.startBaseLoop();
        setState('recording');
      } else if (state === 'recording') {
        await looper.stopBaseLoop();
      }
    } catch (err) {
      Alert.alert('Looper', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
      sync();
    }
  }

  async function onOverdub() {
    if (busy) return;
    setBusy(true);
    setState('recording');
    try {
      await looper.overdub();
    } catch (err) {
      Alert.alert('Looper', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
      sync();
    }
  }

  async function onSave() {
    if (busy) return;
    setBusy(true);
    try {
      const path = await looper.renderLoopToFile();
      const track = await addRecordingToProject(projectId, path);
      Alert.alert('Looper', `Boucle ajoutee au projet : ${track.name}`);
    } catch (err) {
      Alert.alert('Looper', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
      sync();
    }
  }

  function onUndo() {
    looper.undoLastLayer();
    sync();
  }

  function onClear() {
    looper.clear();
    sync();
  }

  const recording = state === 'recording';

  return (
    <View style={styles.container}>
      <Text style={styles.warning}>
        Au casque : sinon la boucle jouee est recapturee dans l overdub.
      </Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusLabel}>
          {state === 'idle'
            ? 'En attente'
            : state === 'recording'
              ? 'Enregistrement'
              : 'Lecture'}
        </Text>
        <Text style={styles.statusMeta}>
          {layers} couche{layers > 1 ? 's' : ''}
          {loopDuration > 0 ? `  -  ${loopDuration.toFixed(1)} s` : ''}
        </Text>
      </View>

      {state === 'idle' || state === 'recording' ? (
        <TouchableOpacity
          style={[styles.action, recording ? styles.actionDanger : styles.actionPrimary, busy && styles.actionDisabled]}
          onPress={onToggleBase}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>
            {recording ? 'Arreter la boucle' : 'Enregistrer la boucle'}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.action, styles.actionPrimary, busy && styles.actionDisabled]}
            onPress={onOverdub}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>{busy ? 'Enregistrement...' : 'Overdub'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, styles.actionSave, (busy || layers === 0) && styles.actionDisabled]}
            onPress={onSave}
            disabled={busy || layers === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.actionSaveText}>Sauvegarder dans le projet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, styles.actionSecondary, (busy || layers === 0) && styles.actionDisabled]}
            onPress={onUndo}
            disabled={busy || layers === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.actionSecondaryText}>Annuler la derniere couche</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, styles.actionDanger, busy && styles.actionDisabled]}
            onPress={onClear}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>Effacer</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  warning: {
    fontSize: 12,
    color: palette.danger,
    textAlign: 'center',
    marginBottom: 20,
  },
  statusBox: {
    alignItems: 'center',
    paddingVertical: 28,
    borderRadius: 16,
    backgroundColor: palette.surface,
    ...raisedBorders,
    marginBottom: 28,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  statusMeta: {
    fontSize: 14,
    color: palette.textSecondary,
    marginTop: 6,
  },
  action: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionPrimary: {
    backgroundColor: palette.accent,
    elevation: 4,
  },
  actionSave: {
    backgroundColor: palette.accentBright,
    elevation: 3,
  },
  actionSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.background,
  },
  actionSecondary: {
    backgroundColor: palette.surface,
    ...raisedBorders,
  },
  actionDanger: {
    backgroundColor: palette.danger,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textOnAccent,
  },
  actionSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
  },
});
