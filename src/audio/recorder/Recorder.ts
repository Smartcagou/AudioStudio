import {
  AudioManager,
  AudioRecorder,
  FileDirectory,
  FileFormat,
  GainNode,
  RecorderAdapterNode,
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

  // Monitoring d'entrée : route le micro vers la sortie pendant la prise.
  // Armé avant l'enregistrement (comportement type DAW). À utiliser au casque,
  // sinon le retour haut-parleur provoque un larsen.
  private monitoring = false;
  private adapter: RecorderAdapterNode | null = null;
  private monitorGain: GainNode | null = null;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  setMonitoring(enabled: boolean): void {
    this.monitoring = enabled;
  }

  isMonitoringEnabled(): boolean {
    return this.monitoring;
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

    // Câble le retour direct micro -> sortie avant de démarrer la capture.
    if (this.monitoring) {
      const context = this.engine.getContext();
      const adapter = context.createRecorderAdapter();
      const monitorGain = context.createGain();
      monitorGain.gain.value = 1;
      recorder.connect(adapter);
      adapter.connect(monitorGain);
      monitorGain.connect(context.destination);
      this.adapter = adapter;
      this.monitorGain = monitorGain;
    }

    const started = recorder.start();
    if (started.status === 'error') {
      this.teardownMonitoring(recorder);
      throw new Error(started.message);
    }

    this.recorder = recorder;
  }

  private teardownMonitoring(recorder: AudioRecorder): void {
    if (this.adapter) {
      recorder.disconnect();
      this.adapter = null;
    }
    if (this.monitorGain) {
      this.monitorGain.disconnect();
      this.monitorGain = null;
    }
  }

  stop(): RecordingResult {
    const recorder = this.recorder;
    if (!recorder) {
      throw new Error('No active recording.');
    }

    const result = recorder.stop();
    this.teardownMonitoring(recorder);
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
