import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getAudioEngine } from '../audio/engine/AudioEngine';
import { Metronome } from '../audio/metronome/Metronome';
import { Recorder } from '../audio/recorder/Recorder';
import { addRecordingToLibrary } from '../library/LibraryManager';
import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Engineering'>;

const MIN_BPM = 40;
const MAX_BPM = 240;

export function EngineeringScreen({ navigation }: Props) {
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
        const file = await addRecordingToLibrary(
          result.path,
          result.durationSec,
          result.sizeMb,
        );
        setLastSaved(file.filename);
        Alert.alert(
          'Enregistrement',
          `Sauvegarde dans la bibliotheque (${result.durationSec.toFixed(1)} s).`,
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

  async function toggle() {
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
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigation.navigate('Mixer')}
        activeOpacity={0.7}
      >
        <Text style={styles.navButtonText}>Mixage multipiste</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigation.navigate('Looper')}
        activeOpacity={0.7}
      >
        <Text style={styles.navButtonText}>Looper</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Metronome</Text>

      <View style={styles.bpmRow}>
        <Text style={styles.bpmValue}>{bpm}</Text>
        <Text style={styles.bpmUnit}>BPM</Text>
      </View>

      <View style={styles.adjustRow}>
        <AdjustButton label="-5" onPress={() => changeBpm(-5)} />
        <AdjustButton label="-1" onPress={() => changeBpm(-1)} />
        <AdjustButton label="+1" onPress={() => changeBpm(1)} />
        <AdjustButton label="+5" onPress={() => changeBpm(5)} />
      </View>

      <TouchableOpacity
        style={[styles.toggle, running && styles.toggleActive]}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.toggleText, running && styles.toggleTextActive]}>
          {running ? 'Arreter' : 'Demarrer'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Enregistreur</Text>

      {recording ? (
        <Text style={styles.elapsed}>{elapsedSec.toFixed(1)} s</Text>
      ) : (
        <Text style={styles.hint}>
          {lastSaved ? `Dernier : ${lastSaved}` : 'Le metronome peut tourner pendant la prise.'}
        </Text>
      )}

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

      <TouchableOpacity
        style={[styles.toggle, recording && styles.toggleRecording]}
        onPress={toggleRecording}
        activeOpacity={0.7}
      >
        <Text style={styles.toggleText}>
          {recording ? 'Arreter l enregistrement' : 'Enregistrer'}
        </Text>
      </TouchableOpacity>
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
  navButton: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: palette.surface,
    ...raisedBorders,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: palette.textSecondary,
    marginTop: 16,
    marginBottom: 24,
  },
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 24,
  },
  bpmValue: {
    fontSize: 72,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  bpmUnit: {
    fontSize: 18,
    color: palette.textSecondary,
    marginLeft: 8,
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  adjustButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: palette.surface,
    ...raisedBorders,
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  toggle: {
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    elevation: 4,
  },
  toggleActive: {
    backgroundColor: palette.danger,
  },
  toggleRecording: {
    backgroundColor: palette.danger,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 32,
  },
  elapsed: {
    fontSize: 40,
    fontWeight: '700',
    color: palette.danger,
    textAlign: 'center',
    marginBottom: 24,
  },
  hint: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
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
  toggleText: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.textOnAccent,
  },
  toggleTextActive: {
    color: palette.textOnAccent,
  },
});
