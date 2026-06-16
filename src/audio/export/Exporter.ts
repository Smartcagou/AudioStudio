// Export multi-formats.
// Natif : WAV, PCM en écriture directe ; AAC, M4A, FLAC, Opus via l'encodeur Android.
// MP3 : non natif, nécessite une bibliothèque dédiée (LAME). Toujours signaler l'absence d'encodeur.
// Lot 3.

export type ExportFormat = 'wav' | 'pcm' | 'aac' | 'm4a' | 'flac' | 'opus' | 'mp3';

export interface ExportOptions {
  format: ExportFormat;
  sampleRate?: number;
  bitrate?: number;
}

export class Exporter {
  async export(sourcePath: string, options: ExportOptions): Promise<string> {
    if (options.format === 'mp3') {
      // MP3 nécessite un encodeur dédié (LAME). Lever une erreur explicite si absent.
      throw new Error('MP3 export requires a dedicated encoder (LAME). Not yet implemented.');
    }
    // TODO Lot 3 : brancher l'encodeur Android natif selon le format.
    void sourcePath;
    return '';
  }
}
