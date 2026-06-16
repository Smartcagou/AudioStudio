// Types partagés par le moteur audio temps réel.
// L'horloge de transport est la source de vérité unique pour le looper et le mixer.

export type BufferSize = 128 | 256 | 512 | 1024;

export interface EngineConfig {
  sampleRate: number;
  // Arbitrage central latence / stabilité. Ajustable à chaud.
  bufferSize: BufferSize;
  targetMonitoringLatencyMs: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  sampleRate: 48000,
  bufferSize: 256,
  targetMonitoringLatencyMs: 10,
};

// Horloge partagée — looper et pistes synchronisées lisent ici, jamais depuis une horloge indépendante.
export interface TransportClock {
  readonly frame: number;
  readonly sampleRate: number;
  readonly bpm: number;
  readonly isRunning: boolean;
}
