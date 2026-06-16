// Modèles de données persistés en SQLite.

export interface Project {
  id: string;
  name: string;
  bpm: number;
  createdAt: number;
  updatedAt: number;
}

export interface Track {
  id: string;
  projectId: string;
  name: string;
  filePath: string;
  gainDb: number;
  pan: number;
}

export interface Setting {
  key: string;
  value: string;
}
