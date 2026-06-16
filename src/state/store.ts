// Gestion d'état applicative minimale.
// Introduire une vraie librairie d'état seulement si un besoin réel apparaît.

export type ActiveModule = 'player' | 'engineering' | 'export';

export interface AppState {
  activeModule: ActiveModule;
}

export const initialAppState: AppState = {
  activeModule: 'player',
};
