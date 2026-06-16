// Lecteur de bibliothèque basé sur ExoPlayer (react-native-track-player).
// Décodage multi-formats, file de lecture, lecture en arrière-plan, métadonnées.
// IMPORTANT : strictement distinct du moteur audio temps réel (src/audio/engine/).

export interface LibraryTrack {
  id: string;
  uri: string;
  title: string;
  artist?: string;
  durationMs?: number;
}

export class LibraryPlayer {
  private queue: LibraryTrack[] = [];

  async setup(): Promise<void> {
    // TODO Lot 1 : TrackPlayer.setupPlayer() et enregistrement du service de fond.
  }

  async setQueue(tracks: LibraryTrack[]): Promise<void> {
    this.queue = tracks;
    // TODO Lot 1 : TrackPlayer.setQueue() avec mapping vers le format attendu.
  }

  async play(): Promise<void> {
    // TODO : TrackPlayer.play()
  }

  async pause(): Promise<void> {
    // TODO : TrackPlayer.pause()
  }

  async skipToNext(): Promise<void> {
    // TODO : TrackPlayer.skipToNext()
  }

  async skipToPrevious(): Promise<void> {
    // TODO : TrackPlayer.skipToPrevious()
  }

  getQueue(): readonly LibraryTrack[] {
    return this.queue;
  }
}
