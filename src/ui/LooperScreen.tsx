import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getAudioEngine } from '../audio/engine/AudioEngine';
import { Looper, LooperState } from '../audio/looper/Looper';
import { palette, raisedBorders } from './theme';

const BAR_CHOICES = [1, 2, 4];

export function LooperScreen() {
  const looperRef = useRef<Looper | null>(null);
  if (looperRef.current === null) {
    looperRef.current = new Looper(getAudioEngine());
  }
  const looper = looperRef.current;

  const [state, setState] = useState<LooperState>('idle');
  const [bars, setBars] = useState(1);
  const [layers, setLayers] = useState(0);

  useEffect(() => {
    return () => {
      looper.clear();
    };
  }, [looper]);

  function sync() {
    setState(looper.getState());
    setLayers(looper.getLayerCount());
  }

  function chooseBars(value: number) {
    looper.setBars(value);
    setBars(looper.getBars());
  }

  async function onRecordBase() {
    setState('recording');
    try {
      await looper.recordBaseLoop();
    } catch (err) {
      Alert.alert('Looper', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      sync();
    }
  }

  async function onOverdub() {
    setState('recording');
    try {
      await looper.overdub();
    } catch (err) {
      Alert.alert('Looper', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      sync();
    }
  }

  function onUndo() {
    looper.undoLastLayer();
    sync();
  }

  function onClear() {
    looper.clear();
    setBars(looper.getBars());
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
          {state === 'idle' ? 'En attente' : state === 'recording' ? 'Enregistrement' : 'Lecture'}
        </Text>
        <Text style={styles.statusMeta}>
          {layers} couche{layers > 1 ? 's' : ''}
        </Text>
      </View>

      {state === 'idle' ? (
        <View style={styles.barsRow}>
          <Text style={styles.barsLabel}>Mesures</Text>
          {BAR_CHOICES.map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.barButton, bars === value && styles.barButtonActive]}
              onPress={() => chooseBars(value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.barText, bars === value && styles.barTextActive]}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {state === 'idle' ? (
        <TouchableOpacity
          style={[styles.action, styles.actionPrimary, recording && styles.actionDisabled]}
          onPress={onRecordBase}
          disabled={recording}
          activeOpacity={0.7}
        >
          <Text style={styles.actionText}>Enregistrer la boucle</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.action, styles.actionPrimary, recording && styles.actionDisabled]}
            onPress={onOverdub}
            disabled={recording}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>{recording ? 'Enregistrement...' : 'Overdub'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, styles.actionSecondary, (recording || layers === 0) && styles.actionDisabled]}
            onPress={onUndo}
            disabled={recording || layers === 0}
            activeOpacity={0.7}
          >
            <Text style={styles.actionSecondaryText}>Annuler la derniere couche</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.action, styles.actionDanger, recording && styles.actionDisabled]}
            onPress={onClear}
            disabled={recording}
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
  barsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  barsLabel: {
    fontSize: 14,
    color: palette.textSecondary,
    marginRight: 16,
  },
  barButton: {
    width: 48,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: palette.surface,
    ...raisedBorders,
    alignItems: 'center',
  },
  barButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  barText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  barTextActive: {
    color: palette.textOnAccent,
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
