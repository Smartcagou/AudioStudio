import { AudioContext } from 'react-native-audio-api';

import { DEFAULT_ENGINE_CONFIG, EngineConfig, TransportClock } from './types';

// Moteur audio temps réel — cœur du mixage, du looper et des effets.
// S'appuie sur react-native-audio-api. Aucun traitement lourd sur le fil JS.
// Strictement distinct de LibraryPlayer (src/player/).
export class AudioEngine {
  private config: EngineConfig;
  private context: AudioContext | null = null;
  private bpm = 120;

  constructor(config: EngineConfig = DEFAULT_ENGINE_CONFIG) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.context) return;
    this.context = new AudioContext({ sampleRate: this.config.sampleRate });
    if (this.context.state !== 'running') {
      await this.context.resume();
    }
  }

  async stop(): Promise<void> {
    if (!this.context) return;
    await this.context.close();
    this.context = null;
  }

  isRunning(): boolean {
    return this.context?.state === 'running';
  }

  // Le contexte natif est partagé par tous les consommateurs (métronome, looper,
  // mixer). Ils planifient leurs événements sur la même horloge.
  getContext(): AudioContext {
    if (!this.context) {
      throw new Error('AudioEngine not started. Call start() first.');
    }
    return this.context;
  }

  setBufferSize(bufferSize: EngineConfig['bufferSize']): void {
    // La version 0.12.2 de react-native-audio-api n'expose pas encore le réglage
    // de buffer côté JS. On conserve la valeur de config pour le jour où ce sera
    // branché ; le réglage doit rester ajustable (contrainte de latence).
    this.config = { ...this.config, bufferSize };
  }

  setTempo(bpm: number): void {
    this.bpm = bpm;
  }

  getTempo(): number {
    return this.bpm;
  }

  getConfig(): EngineConfig {
    return this.config;
  }

  // Source de vérité unique pour le temps. Looper et pistes lisent ici.
  getClock(): TransportClock {
    const sampleRate = this.context?.sampleRate ?? this.config.sampleRate;
    const currentTime = this.context?.currentTime ?? 0;
    return {
      frame: Math.round(currentTime * sampleRate),
      sampleRate,
      bpm: this.bpm,
      isRunning: this.isRunning(),
    };
  }
}

let instance: AudioEngine | null = null;

// Instance unique du moteur temps réel pour toute l'application.
export function getAudioEngine(): AudioEngine {
  if (!instance) {
    instance = new AudioEngine();
  }
  return instance;
}
