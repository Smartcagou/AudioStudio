// Lecteur de bibliothèque basé sur ExoPlayer (react-native-track-player).
// Décodage multi-formats, file de lecture, lecture en arrière-plan, métadonnées.
// IMPORTANT : strictement distinct du moteur audio temps réel (src/audio/engine/).

import TrackPlayer, {
  Capability,
  Track,
} from 'react-native-track-player';

import { LibraryFile } from '../storage/models';

let isSetup = false;

function toTrack(file: LibraryFile): Track {
  return {
    id: file.id,
    url: file.uri,
    title: file.title ?? file.filename,
    artist: file.artist ?? undefined,
    duration: file.durationMs != null ? file.durationMs / 1000 : undefined,
  };
}

// Initialise le moteur une seule fois. setupPlayer lève une erreur s'il est
// déjà initialisé (par ex. après un rechargement JS) : on l'absorbe.
export async function setupLibraryPlayer(): Promise<void> {
  if (isSetup) return;
  try {
    await TrackPlayer.setupPlayer();
  } catch {
    // Déjà initialisé côté natif : rien à faire.
  }
  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.Stop,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause],
  });
  isSetup = true;
}

export async function loadQueue(files: LibraryFile[]): Promise<void> {
  await TrackPlayer.setQueue(files.map(toTrack));
}

export async function playFileAt(index: number): Promise<void> {
  await TrackPlayer.skip(index);
  await TrackPlayer.play();
}

export async function play(): Promise<void> {
  await TrackPlayer.play();
}

export async function pause(): Promise<void> {
  await TrackPlayer.pause();
}

export async function skipToNext(): Promise<void> {
  await TrackPlayer.skipToNext();
}

export async function skipToPrevious(): Promise<void> {
  await TrackPlayer.skipToPrevious();
}

export async function seekTo(positionSec: number): Promise<void> {
  await TrackPlayer.seekTo(Math.max(0, positionSec));
}
