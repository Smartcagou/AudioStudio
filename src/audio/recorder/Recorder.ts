import {
  AudioManager,
  AudioRecorder,
  FileDirectory,
  FileFormat,
} from 'react-native-audio-api';

import { AudioEngine } from '../engine/AudioEngine';

// Enregistreur simple : capture micro vers un fichier WAV dans le sandbox.
// Lot 1 : enregistrement basique, départ ancré sur l'horloge partagée du moteur
// (utile pour la synchronisation future du looper).
// Lot 2 : monitoring faible latence (< 10 ms) et niveau d'entrée.

export interface RecordingResult {
  path: string;
  durationSec: number;
  sizeMb: number;
  // Position de l'horloge de transport au démarrage de la prise.
  startFrame: number;
}

export class Recorder {
  private readonly engine: AudioEngine;
  private recorder: AudioRecorder | null = null;
  private startFrame = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  // Demande la permission micro si nécessaire. Retourne true si accordée.
  async ensurePermission(): Promise<boolean> {
    const current = await AudioManager.checkRecordingPermissions();
    if (current === 'Granted') return true;
    const requested = await AudioManager.requestRecordingPermissions();
    return requested === 'Granted';
  }

  isRecording(): boolean {
    return this.recorder?.isRecording() ?? false;
  }

  getCurrentDuration(): number {
    return this.recorder?.getCurrentDuration() ?? 0;
  }

  async start(): Promise<void> {
    if (this.isRecording()) return;

    const granted = await this.ensurePermission();
    if (!granted) {
      throw new Error('Permission microphone refusee.');
    }

    // Le moteur fournit l'horloge commune ; on mémorise la position de départ.
    await this.engine.start();
    this.startFrame = this.engine.getClock().frame;

    const recorder = new AudioRecorder();
    const enabled = recorder.enableFileOutput({
      format: FileFormat.Wav,
      directory: FileDirectory.Document,
      fileNamePrefix: 'rec-',
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
  }

  stop(): RecordingResult {
    const recorder = this.recorder;
    if (!recorder) {
      throw new Error('No active recording.');
    }

    const result = recorder.stop();
    this.recorder = null;

    if (result.status === 'error') {
      throw new Error(result.message);
    }

    return {
      path: result.paths[0],
      durationSec: result.duration,
      sizeMb: result.size,
      startFrame: this.startFrame,
    };
  }
}
