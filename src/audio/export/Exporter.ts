// Export multi-formats.
// Natif : WAV, PCM en écriture directe ; AAC, M4A, FLAC, Opus via l'encodeur Android.
// MP3 : non natif, nécessite une bibliothèque dédiée (LAME). Toujours signaler l'absence d'encodeur.
//
// Lot 3 : rendu du mix final hors-ligne (WAV), puis ré-encodage AAC/M4A via le
// module natif MediaCodec/MediaMuxer (modules/audio-encoder). Tout est local.

import { OfflineAudioContext } from 'react-native-audio-api';
import { File, Paths } from 'expo-file-system';

import { AudioEngine } from '../engine/AudioEngine';
import { dbToLinear, TrackInfo } from '../mixer/Track';
import { encodeWav } from './wav';
import AudioEncoder from '../../../modules/audio-encoder';

export type ExportFormat = 'wav' | 'm4a';

// Débit AAC pour l'export compressé (M4A). 192 kbps : bon compromis qualité/taille.
const AAC_BITRATE = 192_000;

export interface MixExportResult {
  path: string;
  durationSec: number;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Rend une liste de pistes (gain, pan, filtre) dans un contexte hors-ligne et
// renvoie les octets WAV. Le rendu hors-ligne somme les pistes exactement comme
// le mixer en lecture, plus vite que le temps réel.
async function renderTracksToWav(
  engine: AudioEngine,
  tracks: TrackInfo[],
): Promise<{ bytes: Uint8Array; durationSec: number }> {
  const sampleRate = engine.getConfig().sampleRate;
  const durationSec = Math.max(...tracks.map((track) => track.durationSec));
  const length = Math.ceil(durationSec * sampleRate);

  const offline = new OfflineAudioContext(2, length, sampleRate);
  const master = offline.createGain();
  master.connect(offline.destination);

  for (const track of tracks) {
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
  return { bytes: encodeWav([left, right], rendered.sampleRate), durationSec };
}

// Écrit directement un WAV dans le répertoire de documents.
function writeWavToDocument(prefix: string, bytes: Uint8Array): string {
  const file = new File(Paths.document, `${prefix}-${Date.now()}.wav`);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(bytes);
  return file.uri;
}

// Ré-encode les octets WAV en AAC/M4A via le module natif. L'encodeur natif lit
// un fichier : on passe par un WAV temporaire en cache, supprimé ensuite.
async function encodeToM4a(prefix: string, bytes: Uint8Array): Promise<string> {
  const temp = new File(Paths.cache, `render-${Date.now()}.wav`);
  if (temp.exists) {
    temp.delete();
  }
  temp.create();
  temp.write(bytes);

  const outUri = new File(Paths.document, `${prefix}-${Date.now()}.m4a`).uri;
  try {
    return await AudioEncoder.encodeWavToM4a(temp.uri, outUri, AAC_BITRATE);
  } finally {
    if (temp.exists) {
      temp.delete();
    }
  }
}

async function finalize(
  prefix: string,
  bytes: Uint8Array,
  durationSec: number,
  format: ExportFormat,
): Promise<MixExportResult> {
  if (format === 'm4a') {
    return { path: await encodeToM4a(prefix, bytes), durationSec };
  }
  return { path: writeWavToDocument(prefix, bytes), durationSec };
}

// Exporte le mix complet (toutes les pistes non muettes sommées).
export async function exportMix(
  engine: AudioEngine,
  tracks: TrackInfo[],
  format: ExportFormat,
): Promise<MixExportResult> {
  const playable = tracks.filter((track) => !track.muted && track.durationSec > 0);
  if (playable.length === 0) {
    throw new Error('Aucune piste a exporter.');
  }
  const { bytes, durationSec } = await renderTracksToWav(engine, playable);
  return finalize('mix', bytes, durationSec, format);
}

// Exporte une seule piste (avec son gain/pan/filtre), indépendamment du mute.
export async function exportTrack(
  engine: AudioEngine,
  track: TrackInfo,
  format: ExportFormat,
): Promise<MixExportResult> {
  if (track.durationSec <= 0) {
    throw new Error('Piste vide.');
  }
  const { bytes, durationSec } = await renderTracksToWav(engine, [{ ...track, muted: false }]);
  return finalize(`stem-${safeName(track.name)}`, bytes, durationSec, format);
}
