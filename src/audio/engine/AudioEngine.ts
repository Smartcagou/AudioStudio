import { DEFAULT_ENGINE_CONFIG, EngineConfig, TransportClock } from './types';

// Moteur audio temps réel — cœur du mixage, du looper et des effets.
// S'appuie sur react-native-audio-api. Aucun traitement lourd sur le fil JS.
// Strictement distinct de LibraryPlayer (src/player/).
export class AudioEngine {
  private config: EngineConfig;
  private running = false;

  constructor(config: EngineConfig = DEFAULT_ENGINE_CONFIG) {
    this.config = config;
  }

  async start(): Promise<void> {
    // TODO Lot 1 : créer l'AudioContext natif, configurer sampleRate et bufferSize,
    // démarrer l'horloge de transport.
    this.running = true;
  }

  async stop(): Promise<void> {
    // TODO : fermer le graphe et libérer les ressources natives.
    this.running = false;
  }

  setBufferSize(bufferSize: EngineConfig['bufferSize']): void {
    this.config = { ...this.config, bufferSize };
    // TODO : reconfigurer le graphe sans interrompre la lecture si possible.
  }

  getConfig(): EngineConfig {
    return this.config;
  }

  // Source de vérité unique pour le temps. Looper et pistes lisent ici.
  getClock(): TransportClock {
    // TODO Lot 1 : exposer la position réelle lue depuis le thread audio.
    return {
      frame: 0,
      sampleRate: this.config.sampleRate,
      bpm: 120,
      isRunning: this.running,
    };
  }
}
