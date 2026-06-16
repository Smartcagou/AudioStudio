import TrackPlayer, { Event } from 'react-native-track-player';

// Service de lecture en arrière-plan requis par react-native-track-player.
// Exécuté dans un fil séparé par Android. Enregistre les gestionnaires télécommande.
function handleEvent(action: () => Promise<void>): () => void {
  return () => {
    action().catch((err: unknown) => {
      console.error('[PlaybackService] event handler failed:', err);
    });
  };
}

export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, handleEvent(() => TrackPlayer.play()));
  TrackPlayer.addEventListener(Event.RemotePause, handleEvent(() => TrackPlayer.pause()));
  TrackPlayer.addEventListener(Event.RemoteStop, handleEvent(() => TrackPlayer.stop()));
  TrackPlayer.addEventListener(Event.RemoteNext, handleEvent(() => TrackPlayer.skipToNext()));
  TrackPlayer.addEventListener(Event.RemotePrevious, handleEvent(() => TrackPlayer.skipToPrevious()));
}
