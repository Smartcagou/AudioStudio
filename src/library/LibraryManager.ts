// Gestion de la bibliothèque audio : import, copie dans le sandbox de l'app, persistance.
// Utilise expo-document-picker (sélection) et expo-file-system (copie permanente).

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';

import { LibraryFile } from '../storage/models';
import {
  deleteLibraryFile,
  insertLibraryFile,
  listLibraryFiles,
} from '../storage/libraryRepository';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Conserve uniquement les caractères sûrs pour un nom de fichier dans le sandbox.
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Ouvre le sélecteur, copie le fichier choisi dans le répertoire de documents
// de l'app, puis persiste l'entrée. Retourne null si l'utilisateur annule.
export async function importFile(): Promise<LibraryFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const id = generateId();
  const destName = `${id}-${safeFilename(asset.name)}`;

  const source = new File(asset.uri);
  const dest = new File(Paths.document, destName);
  source.copy(dest);

  const file: LibraryFile = {
    id,
    uri: dest.uri,
    filename: asset.name,
    sizeBytes: dest.size ?? asset.size ?? 0,
    title: asset.name,
    artist: null,
    durationMs: null,
    importedAt: Date.now(),
  };

  await insertLibraryFile(file);
  return file;
}

// Ajoute un enregistrement (déjà écrit dans le sandbox par le Recorder) à la
// bibliothèque, pour pouvoir le relire depuis le lecteur.
export async function addRecordingToLibrary(
  filePath: string,
  durationSec: number,
  sizeMb: number,
): Promise<LibraryFile> {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  const filename = filePath.split('/').pop() ?? 'recording.wav';
  const file: LibraryFile = {
    id: generateId(),
    uri,
    filename,
    sizeBytes: Math.round(sizeMb * 1024 * 1024),
    title: filename,
    artist: 'Enregistrement',
    durationMs: Math.round(durationSec * 1000),
    importedAt: Date.now(),
  };
  await insertLibraryFile(file);
  return file;
}

// Ajoute un mix exporté (déjà écrit dans le sandbox) à la bibliothèque.
export async function addExportToLibrary(
  filePath: string,
  durationSec: number,
): Promise<LibraryFile> {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  const filename = filePath.split('/').pop() ?? 'mix.wav';
  let sizeBytes = 0;
  try {
    sizeBytes = new File(uri).size ?? 0;
  } catch {
    sizeBytes = 0;
  }
  const file: LibraryFile = {
    id: generateId(),
    uri,
    filename,
    sizeBytes,
    title: filename,
    artist: 'Mix',
    durationMs: Math.round(durationSec * 1000),
    importedAt: Date.now(),
  };
  await insertLibraryFile(file);
  return file;
}

export async function listFiles(): Promise<LibraryFile[]> {
  return listLibraryFiles();
}

// Retire l'entrée de la bibliothèque et supprime le fichier copié du sandbox.
export async function removeFile(file: LibraryFile): Promise<void> {
  await deleteLibraryFile(file.id);
  const stored = new File(file.uri);
  if (stored.exists) {
    stored.delete();
  }
}
