// Export multi-formats.
// Natif : WAV, PCM en écriture directe ; AAC, M4A, FLAC, Opus via l'encodeur Android.
// MP3 : non natif, nécessite une bibliothèque dédiée (LAME). Toujours signaler l'absence d'encodeur.
//
// Lot 3, première étape : rendu du mix final en WAV via un contexte hors-ligne.

import { OfflineAudioContext } from 'react-native-audio-api';
import { File, Paths } from 'expo-file-system';

import { AudioEngine } from '../engine/AudioEngine';
import { dbToLinear, TrackInfo } from '../mixer/Track';
import { encodeWav } from './wav';

export type ExportFormat = 'wav' | 'pcm' | 'aac' | 'm4a' | 'flac' | 'opus' | 'mp3';

export interface MixExportResult {
  path: string;
  durationSec: number;
}

// Rend toutes les pistes (gain, pan, filtre) dans un contexte hors-ligne, puis
// écrit un fichier WAV. Le rendu hors-ligne est plus rapide que le temps réel et
// somme les pistes exactement comme le mixer en lecture.
export async function exportMixToWav(
  engine: AudioEngine,
  tracks: TrackInfo[],
): Promise<MixExportResult> {
  const playable = tracks.filter((track) => !track.muted && track.durationSec > 0);
  if (playable.length === 0) {
    throw new Error('Aucune piste a exporter.');
  }

  const sampleRate = engine.getConfig().sampleRate;
  const durationSec = Math.max(...playable.map((track) => track.durationSec));
  const length = Math.ceil(durationSec * sampleRate);

  const offline = new OfflineAudioContext(2, length, sampleRate);
  const master = offline.createGain();
  master.connect(offline.destination);

  for (const track of playable) {
    const buffer = await offline.decodeAudioData(track.uri);

    const gain = offline.createGain();
    gain.gain.value = dbToLinear(track.gainDb);
    const panner = offline.createStereoPanner();
    panner.pan.value = track.pan;

    if (track.filterEnabled) {
      const filter = offline.createBiquadFilter();
      filter.type = track.filterType;
      filter.frequency.value = track.filterFrequency;
      gain.connect(filter);
      filter.connect(panner);
    } else {
      gain.connect(panner);
    }
    panner.connect(master);

    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(0);
  }

  const rendered = await offline.startRendering();
  const left = rendered.getChannelData(0);
  const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
  const wav = encodeWav([left, right], rendered.sampleRate);

  const file = new File(Paths.document, `mix-${Date.now()}.wav`);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(wav);

  return { path: file.uri, durationSec };
}
