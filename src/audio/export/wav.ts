// Encodage WAV PCM 16 bits à partir de canaux Float32 (-1..1).
// Écriture directe, sans dépendance : c'est le format d'export le plus fiable.

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function clampSample(value: number): number {
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
}

// Entrelace les canaux et produit un buffer WAV complet (en-tête RIFF + données).
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // taille du sous-bloc fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // octets par seconde
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bits par échantillon

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = clampSample(channels[channel][frame]);
      view.setInt16(offset, Math.round(sample * 32767), true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}
