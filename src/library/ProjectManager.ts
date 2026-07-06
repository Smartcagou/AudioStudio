// Gestion des projets : création, renommage, suppression, import de sons.
// Un projet regroupe des pistes (fichiers copiés dans le sandbox) travaillées
// ensuite par le mixer, le looper et l'enregistreur. Distinct de la bibliothèque
// de lecture (LibraryManager).

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';

import { Project, Track } from '../storage/models';
import {
  deleteProject as deleteProjectRow,
  deleteTrack,
  getProject,
  getTrackCounts,
  insertProject,
  insertTrack,
  listProjects,
  listTracksByProject,
  touchProject,
  updateProjectName,
  updateTrackMix,
} from '../storage/projectRepository';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Conserve uniquement les caractères sûrs pour un nom de fichier dans le sandbox.
function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function createProject(name: string): Promise<Project> {
  const now = Date.now();
  const project: Project = {
    id: generateId(),
    name: name.trim() || 'Projet',
    bpm: 120,
    createdAt: now,
    updatedAt: now,
  };
  await insertProject(project);
  return project;
}

export async function getProjects(): Promise<Project[]> {
  return listProjects();
}

export async function getProjectTrackCounts(): Promise<Record<string, number>> {
  return getTrackCounts();
}

export async function getProjectById(id: string): Promise<Project | null> {
  return getProject(id);
}

export async function renameProject(id: string, name: string): Promise<void> {
  await updateProjectName(id, name.trim() || 'Projet', Date.now());
}

// Supprime le projet, ses pistes en base (cascade) et les fichiers copiés.
export async function deleteProject(project: Project): Promise<void> {
  const tracks = await listTracksByProject(project.id);
  await deleteProjectRow(project.id);
  for (const track of tracks) {
    deleteTrackFile(track.filePath);
  }
}

export async function listProjectTracks(projectId: string): Promise<Track[]> {
  return listTracksByProject(projectId);
}

// Ouvre le sélecteur multi-fichiers, copie chaque son dans le sandbox et l'ajoute
// comme piste du projet. Retourne le nombre de pistes importées.
export async function importSoundsToProject(projectId: string): Promise<number> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return 0;
  }

  let imported = 0;
  for (const asset of result.assets) {
    try {
      const id = generateId();
      const dest = new File(Paths.document, `${id}-${safeFilename(asset.name)}`);
      new File(asset.uri).copy(dest);
      await insertTrack({
        id,
        projectId,
        name: asset.name,
        filePath: dest.uri,
        gainDb: 0,
        pan: 0,
      });
      imported += 1;
    } catch (err) {
      console.error('[ProjectManager] import failed:', asset.name, err);
    }
  }

  if (imported > 0) {
    await touchProject(projectId, Date.now());
  }
  return imported;
}

// Ajoute une prise micro (déjà écrite dans le sandbox par le Recorder) comme
// piste du projet.
export async function addRecordingToProject(
  projectId: string,
  filePath: string,
): Promise<Track> {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  const name = filePath.split('/').pop() ?? 'prise.wav';
  const track: Track = {
    id: generateId(),
    projectId,
    name,
    filePath: uri,
    gainDb: 0,
    pan: 0,
  };
  await insertTrack(track);
  await touchProject(projectId, Date.now());
  return track;
}

// Retire une piste : ligne en base puis fichier copié du sandbox.
export async function removeTrack(track: Track): Promise<void> {
  await deleteTrack(track.id);
  deleteTrackFile(track.filePath);
}

export async function persistTrackMix(
  id: string,
  gainDb: number,
  pan: number,
): Promise<void> {
  await updateTrackMix(id, gainDb, pan);
}

function deleteTrackFile(filePath: string): void {
  try {
    const file = new File(filePath);
    if (file.exists) {
      file.delete();
    }
  } catch (err) {
    console.error('[ProjectManager] file delete failed:', filePath, err);
  }
}
