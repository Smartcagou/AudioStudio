import { AudioEngine } from '../engine/AudioEngine';

// Looper synchronisé avec overdub.
// Ne pas implémenter avant que l'enregistreur et l'horloge audio soient stables (Lot 2).
// La synchronisation repose sur la quantification à la grille de tempo — pas d'horloges indépendantes.
export class Looper {
  private readonly engine: AudioEngine;
  private looping = false;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  start(): void {
    // TODO Lot 2 : démarrer la boucle quantifiée sur la grille de tempo de getClock().
    this.looping = true;
  }

  stop(): void {
    this.looping = false;
  }

  isLooping(): boolean {
    return this.looping;
  }
}
