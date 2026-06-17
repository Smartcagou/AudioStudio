import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAudioEngine } from '../audio/engine/AudioEngine';
import { Mixer } from '../audio/mixer/Mixer';
import { TrackInfo } from '../audio/mixer/Track';
import { listFiles } from '../library/LibraryManager';

export function MixerScreen() {
  const mixerRef = useRef<Mixer | null>(null);
  if (mixerRef.current === null) {
    mixerRef.current = new Mixer(getAudioEngine());
  }
  const mixer = mixerRef.current;

  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

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

  function togglePlay() {
    if (playing) {
      mixer.stopAll();
      setPlaying(false);
    } else {
      mixer.playAll();
      setPlaying(true);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
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
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  empty: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
  },
  track: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa',
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
    color: '#111111',
    marginRight: 12,
  },
  muteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  muteButtonActive: {
    backgroundColor: '#b00020',
    borderColor: '#b00020',
  },
  muteText: {
    fontSize: 13,
    color: '#333333',
  },
  muteTextActive: {
    color: '#ffffff',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    width: 44,
    fontSize: 13,
    color: '#666666',
  },
  controlValue: {
    width: 64,
    textAlign: 'center',
    fontSize: 14,
    color: '#111111',
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  smallButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
  },
  panButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  panButtonActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  panText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  panTextActive: {
    color: '#ffffff',
  },
  transport: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
  },
  playButton: {
    paddingVertical: 18,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: '#b00020',
  },
  playButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
});
