import { AudioEngine } from '../engine/AudioEngine';

// Enregistreur simple avec monitoring.
// Lot 1 : enregistrement basique calé sur l'horloge partagée du moteur.
// Lot 2 : monitoring faible latence (objectif < 10 ms) et niveau d'entrée.
export class Recorder {
  private readonly engine: AudioEngine;
  private recording = false;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  async start(): Promise<void> {
    // TODO Lot 1 : ouvrir l'entrée micro, écrire le flux PCM, caler le départ
    // sur getClock() du moteur.
    this.recording = true;
  }

  async stop(): Promise<string> {
    // TODO : finaliser le fichier PCM/WAV et retourner son chemin.
    this.recording = false;
    return '';
  }

  isRecording(): boolean {
    return this.recording;
  }
}
