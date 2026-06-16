// Représente l'état d'une piste dans le mixer.
// Les valeurs numériques sont utilisées pour configurer les noeuds natifs du graphe.

export interface TrackState {
  readonly id: string;
  readonly name: string;
  gainDb: number;
  pan: number;
  muted: boolean;
}

export function createTrackState(id: string, name: string): TrackState {
  return { id, name, gainDb: 0, pan: 0, muted: false };
}
