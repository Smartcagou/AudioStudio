import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getAudioEngine } from '../audio/engine/AudioEngine';
import { Metronome } from '../audio/metronome/Metronome';
import { Recorder } from '../audio/recorder/Recorder';
import { addRecordingToProject } from '../library/ProjectManager';
import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Engineering'>;

const MIN_BPM = 40;
const MAX_BPM = 240;

export function EngineeringScreen({ route }: Props) {
  const { projectId } = route.params;

  const metronomeRef = useRef<Metronome | null>(null);
  if (metronomeRef.current === null) {
    metronomeRef.current = new Metronome(getAudioEngine());
  }
  const metronome = metronomeRef.current;

  const recorderRef = useRef<Recorder | null>(null);
  if (recorderRef.current === null) {
    recorderRef.current = new Recorder(getAudioEngine());
  }
  const recorder = recorderRef.current;

  const [bpm, setBpm] = useState(120);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function toggleMonitoring() {
    const next = !monitoring;
    recorder.setMonitoring(next);
    setMonitoring(next);
  }

  // Le tempo vit sur le moteur (horloge partagée) : le métronome le relit à chaque
  // temps, donc un changement de BPM pendant la lecture est pris en compte.
  useEffect(() => {
    getAudioEngine().setTempo(bpm);
  }, [bpm]);

  useEffect(() => {
    return () => {
      metronome.stop();
      if (recorder.isRecording()) {
        recorder.stop();
      }
      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
      }
    };
  }, [metronome, recorder]);

  async function toggleRecording() {
    if (recording) {
      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      try {
        const result = recorder.stop();
        setRecording(false);
        setElapsedSec(0);
        const track = await addRecordingToProject(projectId, result.path);
        setLastSaved(track.name);
        Alert.alert(
          'Enregistrement',
          `Ajoute au projet (${result.durationSec.toFixed(1)} s).`,
        );
      } catch (err) {
        setRecording(false);
        Alert.alert('Enregistrement', err instanceof Error ? err.message : 'Erreur inconnue');
      }
    } else {
      try {
        await recorder.start();
        setRecording(true);
        setLastSaved(null);
        setElapsedSec(0);
        tickRef.current = setInterval(() => {
          setElapsedSec(recorder.getCurrentDuration());
        }, 250);
      } catch (err) {
        Alert.alert('Enregistrement', err instanceof Error ? err.message : 'Erreur inconnue');
      }
    }
  }

  function changeBpm(delta: number) {
    setBpm((prev) => Math.min(MAX_BPM, Math.max(MIN_BPM, prev + delta)));
  }

  async function toggleMetronome() {
    if (running) {
      metronome.stop();
      setRunning(false);
    } else {
      try {
        await metronome.start();
        setRunning(true);
      } catch (err) {
        console.error('[EngineeringScreen] metronome start failed:', err);
      }
    }
  }

  return (
    <View style={styles.container}>
      {/* Métronome compact : une icône encadrée d'un - et d'un +. */}
      <View style={styles.metronomeRow}>
        <AdjustButton label="-" onPress={() => changeBpm(-5)} />
        <TouchableOpacity
          style={styles.metronomeCore}
          onPress={toggleMetronome}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="metronome"
            size={30}
            color={running ? palette.accent : palette.textSecondary}
          />
          <Text style={[styles.bpmValue, running && styles.bpmValueActive]}>{bpm}</Text>
          <Text style={styles.bpmUnit}>BPM</Text>
        </TouchableOpacity>
        <AdjustButton label="+" onPress={() => changeBpm(5)} />
      </View>

      {/* Bouton d'enregistrement central : élément dominant de l'écran. */}
      <View style={styles.recordArea}>
        <TouchableOpacity
          style={styles.recordButton}
          onPress={toggleRecording}
          activeOpacity={0.8}
        >
          <View style={[styles.recordInner, recording && styles.recordInnerActive]} />
        </TouchableOpacity>
        <Text style={styles.elapsed}>
          {recording ? `${elapsedSec.toFixed(1)} s` : 'Enregistrer'}
        </Text>
        <Text style={styles.hint}>
          {recording
            ? 'Appuyez pour arreter'
            : lastSaved
              ? `Derniere prise : ${lastSaved}`
              : 'La prise devient une piste du projet.'}
        </Text>
      </View>

      <View style={styles.monitorRow}>
        <Text style={styles.controlLabel}>Monitoring</Text>
        <TouchableOpacity
          style={[styles.monitorToggle, monitoring && styles.monitorToggleActive]}
          onPress={toggleMonitoring}
          disabled={recording}
          activeOpacity={0.7}
        >
          <Text style={[styles.monitorText, monitoring && styles.monitorTextActive]}>
            {monitoring ? 'Active' : 'Inactif'}
          </Text>
        </TouchableOpacity>
      </View>
      {monitoring && !recording ? (
        <Text style={styles.warning}>Au casque uniquement (risque de larsen sur haut-parleur).</Text>
      ) : null}
    </View>
  );
}

interface AdjustButtonProps {
  label: string;
  onPress: () => void;
}

function AdjustButton({ label, onPress }: AdjustButtonProps) {
  return (
    <TouchableOpacity style={styles.adjustButton} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.adjustButtonText}>{label}</Text>
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
  metronomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metronomeCore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginHorizontal: 20,
    minWidth: 120,
  },
  bpmValue: {
    fontSize: 40,
    fontWeight: '800',
    color: palette.textPrimary,
    marginLeft: 10,
  },
  bpmValueActive: {
    color: palette.accent,
  },
  bpmUnit: {
    fontSize: 14,
    color: palette.textSecondary,
    marginLeft: 6,
  },
  adjustButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.surface,
    ...raisedBorders,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  recordArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  recordInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.textOnAccent,
  },
  recordInnerActive: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: palette.danger,
  },
  elapsed: {
    fontSize: 36,
    fontWeight: '800',
    color: palette.textPrimary,
    marginTop: 28,
  },
  hint: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  monitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  monitorToggle: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: palette.surface,
    ...raisedBorders,
  },
  monitorToggleActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  monitorText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  monitorTextActive: {
    color: palette.textOnAccent,
  },
  warning: {
    fontSize: 12,
    color: palette.danger,
    marginBottom: 16,
  },
});
