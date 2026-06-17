// Accès SQLite à la bibliothèque de lecture.
// Toutes les requêtes utilisent des paramètres liés, jamais de concaténation.

import { getDatabase } from './database';
import { LibraryFile } from './models';

export async function insertLibraryFile(file: LibraryFile): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO library_files
       (id, uri, filename, sizeBytes, title, artist, durationMs, importedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      file.id,
      file.uri,
      file.filename,
      file.sizeBytes,
      file.title,
      file.artist,
      file.durationMs,
      file.importedAt,
    ],
  );
}

export async function listLibraryFiles(): Promise<LibraryFile[]> {
  const db = getDatabase();
  return db.getAllAsync<LibraryFile>(
    `SELECT id, uri, filename, sizeBytes, title, artist, durationMs, importedAt
       FROM library_files
       ORDER BY importedAt DESC`,
  );
}

export async function deleteLibraryFile(id: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM library_files WHERE id = ?`, [id]);
}
