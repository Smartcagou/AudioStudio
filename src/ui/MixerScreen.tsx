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

import { getAudioEngine } from '../audio/engine/AudioEngine';
import { Mixer } from '../audio/mixer/Mixer';
import { TrackFilterType, TrackInfo } from '../audio/mixer/Track';
import { ExportFormat, exportMix, exportTrack } from '../audio/export/Exporter';
import { addExportToLibrary, listFiles } from '../library/LibraryManager';
import { palette, raisedBorders } from './theme';

export function MixerScreen() {
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
      const files = await listFiles();
      for (const file of files) {
        try {
          await mixer.addTrack({
            id: file.id,
            name: file.title ?? file.filename,
            uri: file.uri,
            gainDb: 0,
            pan: 0,
            muted: false,
          });
        } catch (err) {
          console.error('[MixerScreen] track load failed:', file.filename, err);
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
  }, [mixer, refresh]);

  function findTrack(id: string) {
    return mixer.getTracks().find((t) => t.id === id) ?? null;
  }

  function changeGain(id: string, delta: number) {
    const track = findTrack(id);
    if (!track) return;
    track.setGainDb(Math.min(12, Math.max(-60, track.getInfo().gainDb + delta)));
    refresh();
  }

  function setPan(id: string, pan: number) {
    findTrack(id)?.setPan(pan);
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.listContent}>
        {tracks.length === 0 ? (
          <Text style={styles.empty}>
            Aucune piste. Importez ou enregistrez de l audio, puis revenez ici.
          </Text>
        ) : (
          tracks.map((track) => (
            <View key={track.id} style={styles.track}>
              <View style={styles.trackHeader}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {track.name}
                </Text>
                <TouchableOpacity
                  style={[styles.muteButton, track.muted && styles.muteButtonActive]}
                  onPress={() => toggleMute(track.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.muteText, track.muted && styles.muteTextActive]}>
                    {track.muted ? 'Muet' : 'Actif'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Gain</Text>
                <SmallButton label="-3" onPress={() => changeGain(track.id, -3)} />
                <Text style={styles.controlValue}>{track.gainDb} dB</Text>
                <SmallButton label="+3" onPress={() => changeGain(track.id, 3)} />
              </View>

              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Pan</Text>
                <PanButton label="G" active={track.pan < 0} onPress={() => setPan(track.id, -1)} />
                <PanButton label="C" active={track.pan === 0} onPress={() => setPan(track.id, 0)} />
                <PanButton label="D" active={track.pan > 0} onPress={() => setPan(track.id, 1)} />
              </View>

              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Filtre</Text>
                <PanButton
                  label="Aucun"
                  active={!track.filterEnabled}
                  onPress={() => setFilter(track.id, 'none')}
                />
                <PanButton
                  label="Pass-bas"
                  active={track.filterEnabled && track.filterType === 'lowpass'}
                  onPress={() => setFilter(track.id, 'lowpass')}
                />
                <PanButton
                  label="Pass-haut"
                  active={track.filterEnabled && track.filterType === 'highpass'}
                  onPress={() => setFilter(track.id, 'highpass')}
                />
              </View>

              {track.filterEnabled ? (
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Freq</Text>
                  <SmallButton label="-" onPress={() => scaleFilterFrequency(track.id, 1 / 1.5)} />
                  <Text style={styles.controlValue}>{track.filterFrequency} Hz</Text>
                  <SmallButton label="+" onPress={() => scaleFilterFrequency(track.id, 1.5)} />
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.transport}>
        <TouchableOpacity
          style={[styles.playButton, playing && styles.playButtonActive]}
          onPress={togglePlay}
          activeOpacity={0.7}
          disabled={tracks.length === 0}
        >
          <Text style={styles.playButtonText}>{playing ? 'Arreter' : 'Tout lire'}</Text>
        </TouchableOpacity>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Format</Text>
          <PanButton label="WAV" active={format === 'wav'} onPress={() => setFormat('wav')} />
          <PanButton label="M4A" active={format === 'm4a'} onPress={() => setFormat('m4a')} />
        </View>

        <TouchableOpacity
          style={[styles.exportButton, (exporting || tracks.length === 0) && styles.exportButtonDisabled]}
          onPress={onExport}
          activeOpacity={0.7}
          disabled={exporting || tracks.length === 0}
        >
          <Text style={styles.exportButtonText}>
            {exporting ? 'Export en cours' : `Exporter le mix (${format.toUpperCase()})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportButton, (exporting || tracks.length === 0) && styles.exportButtonDisabled]}
          onPress={onExportStems}
          activeOpacity={0.7}
          disabled={exporting || tracks.length === 0}
        >
          <Text style={styles.exportButtonText}>Exporter les pistes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
}

function SmallButton({ label, onPress }: ButtonProps) {
  return (
    <TouchableOpacity style={styles.smallButton} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

interface PanButtonProps extends ButtonProps {
  active: boolean;
}

function PanButton({ label, active, onPress }: PanButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.panButton, active && styles.panButtonActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.panText, active && styles.panTextActive]}>{label}</Text>
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
  muteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: palette.surfaceRaised,
  },
  muteButtonActive: {
    backgroundColor: palette.danger,
  },
  muteText: {
    fontSize: 13,
    color: palette.textPrimary,
  },
  muteTextActive: {
    color: palette.textOnAccent,
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
    width: 64,
    textAlign: 'center',
    fontSize: 14,
    color: palette.textPrimary,
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: palette.surfaceRaised,
  },
  smallButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  panButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
  },
  panButtonActive: {
    backgroundColor: palette.accent,
  },
  panText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  panTextActive: {
    color: palette.textOnAccent,
  },
  transport: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    padding: 16,
  },
  playButton: {
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    elevation: 4,
  },
  playButtonActive: {
    backgroundColor: palette.danger,
  },
  playButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: palette.textOnAccent,
  },
  exportButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: palette.surface,
    ...raisedBorders,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.4,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
});
