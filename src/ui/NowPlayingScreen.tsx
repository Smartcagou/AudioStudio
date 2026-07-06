import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { State, useActiveTrack, usePlaybackState, useProgress } from 'react-native-track-player';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from './navigation';
import { palette, raisedBorders } from './theme';
import { HorizontalGradient } from './components/HorizontalGradient';
import { pause, play, seekTo, skipToNext, skipToPrevious } from '../player/LibraryPlayer';

type Props = NativeStackScreenProps<RootStackParamList, 'NowPlaying'>;

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 16;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function run(action: () => Promise<void>) {
  action().catch((err: unknown) => {
    console.error('[NowPlaying] action failed:', err);
  });
}

export function NowPlayingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const activeTrack = useActiveTrack();
  const playback = usePlaybackState();
  const progress = useProgress();
  const [favorite, setFavorite] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const isPlaying = playback.state === State.Playing;
  const duration = progress.duration > 0 ? progress.duration : 0;
  const fraction = duration > 0 ? Math.min(1, progress.position / duration) : 0;

  function onSeek(locationX: number) {
    if (trackWidth <= 0 || duration <= 0) return;
    const clamped = Math.max(0, Math.min(trackWidth, locationX));
    run(() => seekTo((clamped / trackWidth) * duration));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <RoundIcon name="chevron-back" onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>PLAYING NOW</Text>
        <RoundIcon name="menu" onPress={() => navigation.goBack()} />
      </View>

      <View style={styles.artWrapper}>
        <View style={styles.art}>
          <Ionicons name="musical-notes" size={72} color={palette.textSecondary} />
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {activeTrack ? (activeTrack.title ?? 'Lecture') : 'Aucune lecture'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {activeTrack?.artist ?? 'Bibliotheque'}
        </Text>
      </View>

      <View style={styles.scrubberBlock}>
        <Pressable
          style={styles.track}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={(e) => onSeek(e.nativeEvent.locationX)}
        >
          {trackWidth > 0 ? (
            <View
              pointerEvents="none"
              style={[styles.filledClip, { width: trackWidth * fraction }]}
            >
              <HorizontalGradient
                from={palette.accent}
                to={palette.accentBright}
                style={{ width: trackWidth, height: TRACK_HEIGHT }}
              />
            </View>
          ) : null}
          <View
            pointerEvents="none"
            style={[styles.thumb, { left: Math.max(0, trackWidth * fraction - THUMB_SIZE / 2) }]}
          />
        </Pressable>
        <View style={styles.times}>
          <Text style={styles.timeText}>{formatTime(progress.position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={[styles.controls, { marginBottom: insets.bottom + 24 }]}>
        <RoundIcon name="heart" size={22} active={favorite} onPress={() => setFavorite((f) => !f)} />
        <RoundIcon name="play-skip-back" size={26} onPress={() => run(skipToPrevious)} />
        <Pressable
          style={styles.playButton}
          onPress={() => run(isPlaying ? pause : play)}
          disabled={!activeTrack}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={34}
            color={palette.textOnAccent}
            style={isPlaying ? undefined : styles.playGlyphOffset}
          />
        </Pressable>
        <RoundIcon name="play-skip-forward" size={26} onPress={() => run(skipToNext)} />
        <RoundIcon name="repeat" size={22} onPress={() => undefined} />
      </View>
    </View>
  );
}

interface RoundIconProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  active?: boolean;
}

function RoundIcon({ name, onPress, size = 22, active = false }: RoundIconProps) {
  return (
    <Pressable style={styles.roundIcon} onPress={onPress}>
      <Ionicons name={name} size={size} color={active ? palette.accent : palette.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  artWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...raisedBorders,
    elevation: 12,
  },
  meta: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  artist: {
    color: palette.textSecondary,
    fontSize: 14,
    marginTop: 6,
  },
  scrubberBlock: {
    marginBottom: 36,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: palette.track,
    justifyContent: 'center',
  },
  filledClip: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: palette.accentBright,
    elevation: 4,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  timeText: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    ...raisedBorders,
    elevation: 4,
  },
  playButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    elevation: 10,
  },
  playGlyphOffset: {
    marginLeft: 4,
  },
});
