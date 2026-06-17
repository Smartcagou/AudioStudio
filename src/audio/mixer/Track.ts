import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioNode,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';

import { AudioEngine } from '../engine/AudioEngine';

// État sérialisable d'une piste, utilisé par l'interface.
export interface TrackInfo {
  id: string;
  name: string;
  uri: string;
  gainDb: number;
  pan: number;
  muted: boolean;
  durationSec: number;
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

// Une piste du mixer. Le couple gain + panoramique est permanent et reste câblé
// au bus master ; la source de lecture est recréée à chaque démarrage (les sources
// Web Audio sont à usage unique). Tout est posé sur le contexte partagé du moteur.
export class Track {
  readonly id: string;
  readonly name: string;
  readonly uri: string;
  private gainDb: number;
  private pan: number;
  private muted: boolean;
  private durationSec = 0;

  private readonly engine: AudioEngine;
  private readonly gainNode: GainNode;
  private readonly pannerNode: StereoPannerNode;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;

  constructor(engine: AudioEngine, info: Omit<TrackInfo, 'durationSec'>, master: AudioNode) {
    this.engine = engine;
    this.id = info.id;
    this.name = info.name;
    this.uri = info.uri;
    this.gainDb = info.gainDb;
    this.pan = info.pan;
    this.muted = info.muted;

    const context = engine.getContext();
    this.gainNode = context.createGain();
    this.pannerNode = context.createStereoPanner();
    this.gainNode.connect(this.pannerNode);
    this.pannerNode.connect(master);

    this.applyGain();
    this.pannerNode.pan.value = this.pan;
  }

  async load(): Promise<void> {
    const context = this.engine.getContext();
    this.buffer = await context.decodeAudioData(this.uri);
    this.durationSec = this.buffer.duration;
  }

  // Programme la lecture à l'instant `when` (horloge du contexte). Toutes les
  // pistes reçoivent le même `when` pour démarrer ensemble, à l'échantillon près.
  start(when: number): void {
    if (!this.buffer) return;
    const context = this.engine.getContext();
    const source = context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gainNode);
    source.start(when);
    this.source = source;
  }

  stop(when?: number): void {
    if (this.source) {
      this.source.stop(when);
      this.source = null;
    }
  }

  setGainDb(db: number): void {
    this.gainDb = db;
    this.applyGain();
  }

  setPan(pan: number): void {
    this.pan = Math.min(1, Math.max(-1, pan));
    this.pannerNode.pan.value = this.pan;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  // Libère les noeuds natifs de la piste.
  dispose(): void {
    this.stop();
    this.gainNode.disconnect();
    this.pannerNode.disconnect();
  }

  private applyGain(): void {
    this.gainNode.gain.value = this.muted ? 0 : dbToLinear(this.gainDb);
  }

  getInfo(): TrackInfo {
    return {
      id: this.id,
      name: this.name,
      uri: this.uri,
      gainDb: this.gainDb,
      pan: this.pan,
      muted: this.muted,
      durationSec: this.durationSec,
    };
  }
}
