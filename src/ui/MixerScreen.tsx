import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getAudioEngine } from '../audio/engine/AudioEngine';
import { Mixer } from '../audio/mixer/Mixer';
import { TrackFilterType, TrackInfo } from '../audio/mixer/Track';
import { ExportFormat, exportMix, exportTrack } from '../audio/export/Exporter';
import { addExportToLibrary } from '../library/LibraryManager';
import { listProjectTracks, persistTrackMix } from '../library/ProjectManager';
import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Mixer'>;

export function MixerScreen({ route }: Props) {
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();
  const mixerRef = useRef<Mixer | null>(null);
  if (mixerRef.current === null) {
    mixerRef.current = new Mixer(getAudioEngine());
  }
  const mixer = mixerRef.current;

  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('wav');

  const refresh = useCallback(() => {
    setTracks(mixer.getTracks().map((t) => t.getInfo()));
  }, [mixer]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const projectTracks = await listProjectTracks(projectId);
      for (const track of projectTracks) {
        try {
          await mixer.addTrack({
            id: track.id,
            name: track.name,
            uri: track.filePath,
            gainDb: track.gainDb,
            pan: track.pan,
            muted: false,
          });
        } catch (err) {
          console.error('[MixerScreen] track load failed:', track.name, err);
        }
      }
      if (!cancelled) {
        refresh();
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      mixer.clear();
    };
  }, [mixer, refresh, projectId]);

  function findTrack(id: string) {
    return mixer.getTracks().find((t) => t.id === id) ?? null;
  }

  function changeGain(id: string, delta: number) {
    const track = findTrack(id);
    if (!track) return;
    track.setGainDb(Math.min(12, Math.max(-60, track.getInfo().gainDb + delta)));
    const info = track.getInfo();
    void persistTrackMix(id, info.gainDb, info.pan);
    refresh();
  }

  function setPan(id: string, pan: number) {
    const track = findTrack(id);
    if (!track) return;
    track.setPan(pan);
    const info = track.getInfo();
    void persistTrackMix(id, info.gainDb, info.pan);
    refresh();
  }

  function toggleMute(id: string) {
    const track = findTrack(id);
    if (!track) return;
    track.setMuted(!track.getInfo().muted);
    refresh();
  }

  function setFilter(id: string, type: TrackFilterType | 'none') {
    const track = findTrack(id);
    if (!track) return;
    if (type === 'none') {
      track.setFilterEnabled(false);
    } else {
      track.setFilterType(type);
      track.setFilterEnabled(true);
    }
    refresh();
  }

  function scaleFilterFrequency(id: string, factor: number) {
    const track = findTrack(id);
    if (!track) return;
    track.setFilterFrequency(Math.round(track.getInfo().filterFrequency * factor));
    refresh();
  }

  function togglePlay() {
    if (playing) {
      mixer.stopAll();
      setPlaying(false);
    } else {
      mixer.playAll();
      setPlaying(true);
    }
  }

  async function onExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportMix(
        getAudioEngine(),
        mixer.getTracks().map((t) => t.getInfo()),
        format,
      );
      const file = await addExportToLibrary(result.path, result.durationSec);
      Alert.alert('Export', `Mix exporte (${result.durationSec.toFixed(1)} s) : ${file.filename}`);
    } catch (err) {
      Alert.alert('Export', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setExporting(false);
    }
  }

  async function onExportStems() {
    if (exporting) return;
    setExporting(true);
    try {
      const engine = getAudioEngine();
      const exportable = mixer.getTracks().filter((t) => t.getInfo().durationSec > 0);
      let count = 0;
      for (const track of exportable) {
        const result = await exportTrack(engine, track.getInfo(), format);
        await addExportToLibrary(result.path, result.durationSec);
        count += 1;
      }
      Alert.alert('Export', `${count} piste${count > 1 ? 's' : ''} exportee${count > 1 ? 's' : ''}.`);
    } catch (err) {
      Alert.alert('Export', err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const disabled = tracks.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.listContent}>
        {tracks.length === 0 ? (
          <Text style={styles.empty}>
            Aucune piste dans ce projet. Importez des sons ou enregistrez une prise.
          </Text>
        ) : (
          tracks.map((track) => (
            <View key={track.id} style={styles.track}>
              <View style={styles.trackHeader}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {track.name}
                </Text>
                <TouchableOpacity
                  style={[styles.iconToggle, track.muted && styles.iconToggleActive]}
                  onPress={() => toggleMute(track.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={track.muted ? 'volume-mute' : 'volume-high'}
                    size={20}
                    color={track.muted ? palette.textOnAccent : palette.textPrimary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Gain</Text>
                <IconStep name="remove" onPress={() => changeGain(track.id, -3)} />
                <Text style={styles.controlValue}>{track.gainDb} dB</Text>
                <IconStep name="add" onPress={() => changeGain(track.id, 3)} />
              </View>

              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Pan</Text>
                <Segment label="G" active={track.pan < 0} onPress={() => setPan(track.id, -1)} />
                <Segment label="C" active={track.pan === 0} onPress={() => setPan(track.id, 0)} />
                <Segment label="D" active={track.pan > 0} onPress={() => setPan(track.id, 1)} />
              </View>

              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Filtre</Text>
                <Segment
                  label="Aucun"
                  active={!track.filterEnabled}
                  onPress={() => setFilter(track.id, 'none')}
                />
                <Segment
                  label="Pass-bas"
                  active={track.filterEnabled && track.filterType === 'lowpass'}
                  onPress={() => setFilter(track.id, 'lowpass')}
                />
                <Segment
                  label="Pass-haut"
                  active={track.filterEnabled && track.filterType === 'highpass'}
                  onPress={() => setFilter(track.id, 'highpass')}
                />
              </View>

              {track.filterEnabled ? (
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Freq</Text>
                  <IconStep name="remove" onPress={() => scaleFilterFrequency(track.id, 1 / 1.5)} />
                  <Text style={styles.controlValue}>{track.filterFrequency} Hz</Text>
                  <IconStep name="add" onPress={() => scaleFilterFrequency(track.id, 1.5)} />
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.transport, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <TouchableOpacity
          style={[styles.playButton, playing && styles.playButtonActive, disabled && styles.buttonDisabled]}
          onPress={togglePlay}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <Ionicons name={playing ? 'stop' : 'play'} size={22} color={palette.textOnAccent} />
          <Text style={styles.playButtonText}>{playing ? 'Arreter' : 'Tout lire'}</Text>
        </TouchableOpacity>

        <View style={styles.formatRow}>
          <Text style={styles.controlLabel}>Format</Text>
          <Segment label="WAV" active={format === 'wav'} onPress={() => setFormat('wav')} />
          <Segment label="M4A" active={format === 'm4a'} onPress={() => setFormat('m4a')} />
        </View>

        <View style={styles.exportRow}>
          <TouchableOpacity
            style={[styles.exportButton, (exporting || disabled) && styles.buttonDisabled]}
            onPress={onExport}
            activeOpacity={0.7}
            disabled={exporting || disabled}
          >
            <Ionicons name="download-outline" size={18} color={palette.textPrimary} />
            <Text style={styles.exportButtonText}>Mix ({format.toUpperCase()})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportButton, (exporting || disabled) && styles.buttonDisabled]}
            onPress={onExportStems}
            activeOpacity={0.7}
            disabled={exporting || disabled}
          >
            <Ionicons name="albums-outline" size={18} color={palette.textPrimary} />
            <Text style={styles.exportButtonText}>Pistes</Text>
          </TouchableOpacity>
        </View>
        {exporting ? <Text style={styles.exportHint}>Export en cours...</Text> : null}
      </View>
    </View>
  );
}

interface IconStepProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

function IconStep({ name, onPress }: IconStepProps) {
  return (
    <TouchableOpacity style={styles.iconStep} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={name} size={22} color={palette.textPrimary} />
    </TouchableOpacity>
  );
}

interface SegmentProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function Segment({ label, active, onPress }: SegmentProps) {
  return (
    <TouchableOpacity
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  listContent: {
    padding: 16,
  },
  empty: {
    color: palette.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  track: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    backgroundColor: palette.surface,
    ...raisedBorders,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trackName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
    marginRight: 12,
  },
  iconToggle: {
    width: 40,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceRaised,
  },
  iconToggleActive: {
    backgroundColor: palette.danger,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    width: 44,
    fontSize: 13,
    color: palette.textSecondary,
  },
  controlValue: {
    width: 72,
    textAlign: 'center',
    fontSize: 14,
    color: palette.textPrimary,
  },
  iconStep: {
    width: 44,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceRaised,
  },
  segment: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: palette.accent,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  segmentTextActive: {
    color: palette.textOnAccent,
  },
  transport: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: palette.background,
  },
  playButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  playButtonActive: {
    backgroundColor: palette.danger,
  },
  playButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.textOnAccent,
    marginLeft: 10,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 12,
  },
  exportRow: {
    flexDirection: 'row',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 4,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: palette.surface,
    ...raisedBorders,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
    marginLeft: 8,
  },
  exportHint: {
    fontSize: 12,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
});
