// Gestion de la bibliothèque audio : import, lecture des métadonnées, organisation des fichiers.
// Utilise expo-file-system et expo-document-picker pour l'accès aux fichiers.

export interface AudioFile {
  id: string;
  uri: string;
  filename: string;
  sizeBytes: number;
}

export class LibraryManager {
  private files: AudioFile[] = [];

  async importFile(): Promise<AudioFile | null> {
    // TODO Lot 1 : expo-document-picker pour sélectionner un fichier audio,
    // copier vers le répertoire de l'app avec expo-file-system,
    // lire les métadonnées et retourner l'AudioFile.
    return null;
  }

  getFiles(): readonly AudioFile[] {
    return this.files;
  }
}
