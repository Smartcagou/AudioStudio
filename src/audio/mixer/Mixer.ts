import { AudioEngine } from '../engine/AudioEngine';
import { createTrackState, TrackState } from './Track';

// Mixage multipiste. Toutes les pistes partagent l'horloge du moteur.
// Lot 2 : pistes, bus, premiers effets ; surveiller la charge des effets simultanés.
export class Mixer {
  private readonly engine: AudioEngine;
  private tracks: TrackState[] = [];

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  addTrack(name: string): TrackState {
    const id = `track-${this.tracks.length + 1}`;
    const track = createTrackState(id, name);
    this.tracks.push(track);
    // TODO Lot 2 : créer le noeud de gain/pan dans le graphe et le câbler au bus master.
    return track;
  }

  removeTrack(id: string): void {
    this.tracks = this.tracks.filter((t) => t.id !== id);
    // TODO : déconnecter et libérer les noeuds natifs associés.
  }

  getTracks(): readonly TrackState[] {
    return this.tracks;
  }
}
