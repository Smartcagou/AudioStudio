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

// Fichier importé dans la bibliothèque de lecture (distinct des pistes de projet).
export interface LibraryFile {
  id: string;
  uri: string;
  filename: string;
  sizeBytes: number;
  title: string | null;
  artist: string | null;
  durationMs: number | null;
  importedAt: number;
}
