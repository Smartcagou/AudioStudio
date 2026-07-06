import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioManager,
  AudioRecorder,
  FileDirectory,
  FileFormat,
  GainNode,
  OfflineAudioContext,
} from 'react-native-audio-api';
import { File, Paths } from 'expo-file-system';

import { AudioEngine } from '../engine/AudioEngine';
import { encodeWav } from '../export/wav';

// Looper synchronisé avec overdub, à durée de boucle libre.
// La boucle de base se règle par tap-to-set : on démarre la prise, on l'arrête,
// et la longueur captée définit la durée de boucle (pas de grille de tempo).
// Toutes les couches partagent l'horloge du moteur et un ancrage temporel commun
// (T0) ; la période est verrouillée par loopEnd, donc les couches ne dérivent pas.

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

  // Arme et démarre un AudioRecorder vers un fichier WAV temporaire en cache.
  private startRecorder(): AudioRecorder {
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
    return recorder;
  }

  private stopRecorder(recorder: AudioRecorder): string {
    const result = recorder.stop();
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result.paths[0];
  }

  // Frontière de boucle suivante (en temps du contexte), avec une petite avance.
  private nextBoundary(lookahead = 0.05): number {
    const now = this.engine.getContext().currentTime + lookahead;
    const elapsed = now - this.anchorTime;
    const periods = Math.ceil(elapsed / this.loopDurationSec);
    return this.anchorTime + periods * this.loopDurationSec;
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

  // Démarre la prise de la boucle de base (durée libre) : fixe l'origine T0 et
  // lance la capture. La longueur sera figée à l'arrêt (stopBaseLoop).
  async startBaseLoop(): Promise<void> {
    if (this.state !== 'idle') return;
    if (!(await this.ensurePermission())) {
      throw new Error('Permission microphone refusee.');
    }
    await this.engine.start();
    this.anchorTime = this.engine.getContext().currentTime;
    this.recorder = this.startRecorder();
    this.state = 'recording';
  }

  // Arrête la boucle de base : la durée captée devient la longueur de boucle,
  // puis la couche est lancée en boucle.
  async stopBaseLoop(): Promise<void> {
    if (this.state !== 'recording' || !this.recorder) return;
    const path = this.stopRecorder(this.recorder);
    this.recorder = null;
    try {
      const buffer = await this.engine.getContext().decodeAudioData(path);
      await Looper.deleteTemp(path);
      // La longueur de boucle = longueur réellement captée (durée libre).
      this.loopDurationSec = buffer.duration;
      const layer = this.addLayer(buffer);
      this.startLayer(layer);
      this.state = 'playing';
    } catch (err) {
      this.state = 'idle';
      throw err;
    }
  }

  // Capture exactement une longueur de boucle, quantifiée à la frontière suivante.
  private async captureQuantizedLoop(): Promise<string> {
    const context = this.engine.getContext();
    const startAt = this.nextBoundary(0);
    await wait(Math.max(0, (startAt - context.currentTime) * 1000));

    this.recorder = this.startRecorder();
    await wait(this.loopDurationSec * 1000);
    const path = this.stopRecorder(this.recorder);
    this.recorder = null;
    return path;
  }

  // Ajoute une couche d'overdub par-dessus la boucle en cours, alignée sur la grille.
  async overdub(): Promise<void> {
    if (this.state !== 'playing') return;
    this.state = 'recording';
    try {
      const path = await this.captureQuantizedLoop();
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

  // Rend la boucle (somme des couches sur une période) dans un WAV écrit en
  // Document, et renvoie son URI. Le rendu hors-ligne reproduit ce qu'on entend
  // en lecture (couches sommées à gain unitaire).
  async renderLoopToFile(): Promise<string> {
    if (this.layers.length === 0 || this.loopDurationSec <= 0) {
      throw new Error('Aucune boucle a sauvegarder.');
    }
    const sampleRate = this.engine.getConfig().sampleRate;
    const length = Math.ceil(this.loopDurationSec * sampleRate);

    const offline = new OfflineAudioContext(2, length, sampleRate);
    const master = offline.createGain();
    master.connect(offline.destination);

    for (const layer of this.layers) {
      const source = offline.createBufferSource();
      source.buffer = layer.buffer;
      source.connect(master);
      source.start(0);
    }

    const rendered = await offline.startRendering();
    const left = rendered.getChannelData(0);
    const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
    const bytes = encodeWav([left, right], rendered.sampleRate);

    const file = new File(Paths.document, `loop-${Date.now()}.wav`);
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(bytes);
    return file.uri;
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
    this.loopDurationSec = 0;
    this.state = 'idle';
  }
}
