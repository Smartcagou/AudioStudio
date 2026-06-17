import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioManager,
  AudioRecorder,
  FileDirectory,
  FileFormat,
  GainNode,
} from 'react-native-audio-api';
import { File } from 'expo-file-system';

import { AudioEngine } from '../engine/AudioEngine';

// Looper synchronisé avec overdub.
// Toutes les couches partagent l'horloge du moteur et un ancrage temporel commun
// (T0). La longueur de boucle est dérivée du tempo (quantification à la grille),
// jamais d'une horloge indépendante. La période est verrouillée par loopEnd, donc
// les couches ne dérivent pas les unes par rapport aux autres.

export type LooperState = 'idle' | 'recording' | 'playing';

interface Layer {
  buffer: AudioBuffer;
  gain: GainNode;
  source: AudioBufferSourceNode | null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Looper {
  private readonly engine: AudioEngine;
  private bars = 1;
  private beatsPerBar = 4;
  private loopDurationSec = 0;
  // Origine de la grille de boucle, en temps du contexte audio.
  private anchorTime = 0;
  private layers: Layer[] = [];
  private master: GainNode | null = null;
  private state: LooperState = 'idle';
  private recorder: AudioRecorder | null = null;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  setBars(bars: number): void {
    if (this.state === 'idle') {
      this.bars = Math.max(1, Math.round(bars));
    }
  }

  getBars(): number {
    return this.bars;
  }

  getState(): LooperState {
    return this.state;
  }

  getLayerCount(): number {
    return this.layers.length;
  }

  getLoopDurationSec(): number {
    return this.loopDurationSec;
  }

  private async ensurePermission(): Promise<boolean> {
    const current = await AudioManager.checkRecordingPermissions();
    if (current === 'Granted') return true;
    const requested = await AudioManager.requestRecordingPermissions();
    return requested === 'Granted';
  }

  private ensureMaster(): GainNode {
    if (!this.master) {
      const context = this.engine.getContext();
      this.master = context.createGain();
      this.master.connect(context.destination);
    }
    return this.master;
  }

  // Frontière de boucle suivante (en temps du contexte), avec une petite avance.
  private nextBoundary(lookahead = 0.05): number {
    const now = this.engine.getContext().currentTime + lookahead;
    const elapsed = now - this.anchorTime;
    const periods = Math.ceil(elapsed / this.loopDurationSec);
    return this.anchorTime + periods * this.loopDurationSec;
  }

  // Capture exactement une longueur de boucle vers un fichier WAV temporaire.
  // `quantize` attend la prochaine frontière avant de démarrer la prise.
  private async captureOneLoop(quantize: boolean): Promise<string> {
    const context = this.engine.getContext();

    if (quantize) {
      const startAt = this.nextBoundary(0);
      await wait(Math.max(0, (startAt - context.currentTime) * 1000));
    } else {
      // Boucle de base : la prise démarre maintenant et définit l'origine T0.
      this.anchorTime = context.currentTime;
    }

    const recorder = new AudioRecorder();
    const enabled = recorder.enableFileOutput({
      format: FileFormat.Wav,
      directory: FileDirectory.Cache,
      fileNamePrefix: 'loop-',
      channelCount: 1,
    });
    if (enabled.status === 'error') {
      throw new Error(enabled.message);
    }
    const started = recorder.start();
    if (started.status === 'error') {
      throw new Error(started.message);
    }
    this.recorder = recorder;

    await wait(this.loopDurationSec * 1000);

    const result = recorder.stop();
    this.recorder = null;
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result.paths[0];
  }

  private addLayer(buffer: AudioBuffer): Layer {
    const context = this.engine.getContext();
    const gain = context.createGain();
    gain.connect(this.ensureMaster());
    const layer: Layer = { buffer, gain, source: null };
    this.layers.push(layer);
    return layer;
  }

  // Démarre une couche en boucle, calée sur la prochaine frontière de grille.
  private startLayer(layer: Layer): void {
    const context = this.engine.getContext();
    const source = context.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = true;
    source.loopStart = 0;
    // Période verrouillée sur la grille, indépendante de la longueur captée.
    source.loopEnd = Math.min(this.loopDurationSec, layer.buffer.duration);
    source.connect(layer.gain);
    source.start(this.nextBoundary());
    layer.source = source;
  }

  private static async deleteTemp(path: string): Promise<void> {
    try {
      const file = new File(path);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Fichier temporaire en cache : sa suppression n'est pas critique.
    }
  }

  // Enregistre la boucle de base : démarre maintenant, capture une longueur de
  // boucle, puis lance la lecture en boucle. Définit la grille (T0, durée).
  async recordBaseLoop(): Promise<void> {
    if (this.state !== 'idle') return;
    if (!(await this.ensurePermission())) {
      throw new Error('Permission microphone refusee.');
    }
    await this.engine.start();
    this.loopDurationSec = (60 / this.engine.getTempo()) * this.beatsPerBar * this.bars;

    this.state = 'recording';
    try {
      const path = await this.captureOneLoop(false);
      const buffer = await this.engine.getContext().decodeAudioData(path);
      await Looper.deleteTemp(path);
      const layer = this.addLayer(buffer);
      this.startLayer(layer);
      this.state = 'playing';
    } catch (err) {
      this.state = 'idle';
      throw err;
    }
  }

  // Ajoute une couche d'overdub par-dessus la boucle en cours, alignée sur la grille.
  async overdub(): Promise<void> {
    if (this.state !== 'playing') return;
    this.state = 'recording';
    try {
      const path = await this.captureOneLoop(true);
      const buffer = await this.engine.getContext().decodeAudioData(path);
      await Looper.deleteTemp(path);
      const layer = this.addLayer(buffer);
      this.startLayer(layer);
      this.state = 'playing';
    } catch (err) {
      this.state = 'playing';
      throw err;
    }
  }

  // Retire la dernière couche enregistrée.
  undoLastLayer(): void {
    const layer = this.layers.pop();
    if (layer) {
      layer.source?.stop();
      layer.gain.disconnect();
    }
  }

  // Arrête tout et réinitialise le looper.
  clear(): void {
    this.layers.forEach((layer) => {
      layer.source?.stop();
      layer.gain.disconnect();
    });
    this.layers = [];
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
    this.state = 'idle';
  }
}
