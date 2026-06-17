import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getAudioEngine } from '../audio/engine/AudioEngine';
import { Metronome } from '../audio/metronome/Metronome';
import { Recorder } from '../audio/recorder/Recorder';
import { addRecordingToLibrary } from '../library/LibraryManager';

const MIN_BPM = 40;
const MAX_BPM = 240;

export function EngineeringScreen() {
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
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
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
    color: '#111111',
  },
  bpmUnit: {
    fontSize: 18,
    color: '#666666',
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  toggle: {
    paddingVertical: 18,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: '#b00020',
  },
  toggleRecording: {
    backgroundColor: '#b00020',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 32,
  },
  elapsed: {
    fontSize: 40,
    fontWeight: '700',
    color: '#b00020',
    textAlign: 'center',
    marginBottom: 24,
  },
  hint: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 24,
  },
  toggleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
});
