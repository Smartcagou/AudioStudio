import { GainNode } from 'react-native-audio-api';

import { AudioEngine } from '../engine/AudioEngine';
import { dbToLinear, Track, TrackInit } from './Track';

// Mixage multipiste. Toutes les pistes partagent l'horloge du moteur et sont
// sommées dans un bus master unique avant la sortie.
// Lot 2 : pistes, bus, premiers effets ; surveiller la charge des effets simultanés.
export class Mixer {
  private readonly engine: AudioEngine;
  private masterGain: GainNode | null = null;
  private masterGainDb = 0;
  private tracks: Track[] = [];
  private playing = false;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  private ensureMaster(): GainNode {
    if (!this.masterGain) {
      const context = this.engine.getContext();
      this.masterGain = context.createGain();
      this.masterGain.gain.value = dbToLinear(this.masterGainDb);
      this.masterGain.connect(context.destination);
    }
    return this.masterGain;
  }

  async addTrack(info: TrackInit): Promise<Track> {
    await this.engine.start();
    const master = this.ensureMaster();
    const track = new Track(this.engine, info, master);
    await track.load();
    this.tracks.push(track);
    return track;
  }

  removeTrack(id: string): void {
    const track = this.tracks.find((t) => t.id === id);
    if (track) {
      track.dispose();
      this.tracks = this.tracks.filter((t) => t.id !== id);
    }
  }

  // Démarre toutes les pistes au même instant (léger délai de planification pour
  // garantir un départ commun, calé à l'échantillon près sur l'horloge audio).
  playAll(): void {
    const context = this.engine.getContext();
    const when = context.currentTime + 0.1;
    this.tracks.forEach((track) => track.start(when));
    this.playing = true;
  }

  stopAll(): void {
    this.tracks.forEach((track) => track.stop());
    this.playing = false;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setMasterGainDb(db: number): void {
    this.masterGainDb = db;
    if (this.masterGain) {
      this.masterGain.gain.value = dbToLinear(db);
    }
  }

  getMasterGainDb(): number {
    return this.masterGainDb;
  }

  clear(): void {
    this.stopAll();
    this.tracks.forEach((track) => track.dispose());
    this.tracks = [];
  }

  getTracks(): readonly Track[] {
    return this.tracks;
  }
}
