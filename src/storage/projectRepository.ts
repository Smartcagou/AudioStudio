// Accès SQLite aux projets et à leurs pistes.
// Toutes les requêtes utilisent des paramètres liés, jamais de concaténation.

import { getDatabase } from './database';
import { Project, Track } from './models';

export async function insertProject(project: Project): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO projects (id, name, bpm, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)`,
    [project.id, project.name, project.bpm, project.createdAt, project.updatedAt],
  );
}

export async function listProjects(): Promise<Project[]> {
  const db = getDatabase();
  return db.getAllAsync<Project>(
    `SELECT id, name, bpm, createdAt, updatedAt
       FROM projects
       ORDER BY updatedAt DESC`,
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const db = getDatabase();
  return db.getFirstAsync<Project>(
    `SELECT id, name, bpm, createdAt, updatedAt FROM projects WHERE id = ?`,
    [id],
  );
}

export async function updateProjectName(
  id: string,
  name: string,
  updatedAt: number,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`UPDATE projects SET name = ?, updatedAt = ? WHERE id = ?`, [
    name,
    updatedAt,
    id,
  ]);
}

// Touche la date de mise à jour (ex. après import ou modif de pistes).
export async function touchProject(id: string, updatedAt: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`UPDATE projects SET updatedAt = ? WHERE id = ?`, [updatedAt, id]);
}

export async function deleteProject(id: string): Promise<void> {
  const db = getDatabase();
  // ON DELETE CASCADE (schéma) supprime les pistes liées (foreign_keys ON).
  await db.runAsync(`DELETE FROM projects WHERE id = ?`, [id]);
}

export async function insertTrack(track: Track): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO tracks (id, projectId, name, filePath, gainDb, pan)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [track.id, track.projectId, track.name, track.filePath, track.gainDb, track.pan],
  );
}

export async function listTracksByProject(projectId: string): Promise<Track[]> {
  const db = getDatabase();
  return db.getAllAsync<Track>(
    `SELECT id, projectId, name, filePath, gainDb, pan
       FROM tracks
       WHERE projectId = ?
       ORDER BY rowid ASC`,
    [projectId],
  );
}

// Nombre de pistes par projet, indexé par projectId (pour la liste des projets).
export async function getTrackCounts(): Promise<Record<string, number>> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ projectId: string; count: number }>(
    `SELECT projectId, COUNT(*) AS count FROM tracks GROUP BY projectId`,
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.projectId] = row.count;
  }
  return counts;
}

export async function deleteTrack(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM tracks WHERE id = ?`, [id]);
}

export async function updateTrackMix(id: string, gainDb: number, pan: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`UPDATE tracks SET gainDb = ?, pan = ? WHERE id = ?`, [gainDb, pan, id]);
}
