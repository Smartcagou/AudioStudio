// Types de navigation racine.
// L'app est organisée autour des projets : Mixer, Looper et Ingénierie
// travaillent sur les pistes du projet passé en paramètre.

export type RootStackParamList = {
  Home: undefined;
  Player: undefined;
  NowPlaying: undefined;
  Projects: undefined;
  ProjectDetail: { projectId: string };
  Engineering: { projectId: string };
  Mixer: { projectId: string };
  Looper: { projectId: string };
};
