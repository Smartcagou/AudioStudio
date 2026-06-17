import * as SQLite from 'expo-sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  bpm INTEGER NOT NULL DEFAULT 120,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY NOT NULL,
  projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filePath TEXT NOT NULL,
  gainDb REAL NOT NULL DEFAULT 0,
  pan REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS library_files (
  id TEXT PRIMARY KEY NOT NULL,
  uri TEXT NOT NULL,
  filename TEXT NOT NULL,
  sizeBytes INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  artist TEXT,
  durationMs INTEGER,
  importedAt INTEGER NOT NULL
);
`;

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('audiostudio.db');
  await db.execAsync(SCHEMA);
}

// Toutes les requêtes exécutées via ce handle DOIVENT utiliser des paramètres liés
// (runAsync / getFirstAsync / getAllAsync avec tableau de valeurs).
// Ne jamais concaténer d'entrées utilisateur dans une chaîne SQL.
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}
