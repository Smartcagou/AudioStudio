# CLAUDE.md

Ce fichier donne à Claude Code le contexte persistant du projet. Il est chargé au début de chaque session. Les règles ci-dessous priment sur toute suggestion générique. En cas de doute, se référer au cahier des charges du projet.

## État du scaffold

Projet initialisé avec Expo SDK 56 (React Native 0.85, React 19), New Architecture activée. Dossier du projet : `AudioStudio/`. Le squelette de modules existe sous `src/` ; l'implémentation suit la roadmap par lots ci-dessous. Avant d'écrire du code natif ou de configuration Expo, lire la documentation versionnée correspondante (voir `AGENTS.md`).

## Projet

Application audio mobile Android pour un musicien. Trois modules : un lecteur multi-formats, un module d'ingénierie sonore (enregistreur, mixage multipiste, looper synchronisé, effets temps réel), et un module d'export multi-formats. Distribution hors store, sous forme d'APK installé manuellement. Mono-utilisateur, pas de backend ni de cloud dans le périmètre actuel.

## Règle absolue : development build, jamais Expo Go

Le projet utilise Expo en development build, pas Expo Go. Expo Go ne peut pas charger les modules natifs nécessaires au temps réel audio. Cette règle ne se discute pas.

Ne jamais proposer de tester dans Expo Go, ni de retirer une dépendance native au motif qu'elle « ne marche pas dans Expo Go ». Si une fonctionnalité audio temps réel est en jeu, la réponse passe par le development build et un module natif, pas par un repli sur `expo-av` ou Expo Go.

## Pile technique

- Framework : React Native sous Expo, New Architecture activée.
- Moteur audio temps réel : react-native-audio-api (graphe audio, enregistrement PCM, effets biquad, lecture sample-accurate). C'est le cœur du mixage, du looper et des effets.
- Lecteur de bibliothèque : moteur basé sur ExoPlayer (par exemple react-native-track-player) pour le décodage multi-formats, la file de lecture, la lecture en arrière-plan et les métadonnées. À garder distinct du moteur temps réel.
- Fichiers : expo-file-system, expo-document-picker.
- Persistance : expo-sqlite pour les projets, pistes et réglages.
- Compilation et APK : EAS Build, profil de distribution interne produisant un APK.

## Réalité des codecs

À ne jamais promettre au-delà du tenable.

- Lecture : quasi universelle (MP3, AAC, M4A, FLAC, WAV, PCM, OGG Vorbis, Opus, AIFF).
- Export natif : WAV et PCM en écriture directe ; AAC, M4A, FLAC et Opus via l'encodeur média natif d'Android.
- Export MP3 : non fourni nativement. Nécessite une bibliothèque dédiée de type LAME. Toujours le signaler comme cas particulier et prévoir un repli explicite si l'encodeur est absent.

## Structure de projet visée

```
src/
  audio/
    engine/        moteur temps réel (graphe, horloge, buffers)
    looper/        logique de boucles synchronisées
    mixer/         pistes, bus, effets
    recorder/      capture micro, monitoring
    export/        rendu et encodage multi-formats
  player/          lecteur de bibliothèque (ExoPlayer)
  library/         import, métadonnées, gestion des fichiers
  storage/         accès SQLite, modèles de projet
  ui/              écrans et composants
  state/           gestion d'état applicative
```

## Commandes

- Installer les dépendances : `npm install`
- Lancer le development build sur appareil ou émulateur : `npx expo run:android`
- Construire l'APK de distribution interne : `eas build -p android --profile preview`
- Vérifier le typage et le lint avant commit : `npm run typecheck`

Le profil EAS de production d'APK doit cibler une distribution interne et non un bundle de store.

## Conventions de code

- TypeScript en mode strict.
- Le code, les identifiants, les noms de fichiers et les messages de commit sont en anglais. La documentation de prose et les commentaires explicatifs peuvent être en français.
- Composants fonctionnels et hooks. Pas de composants de classe.
- Aucune icône, aucun émoji, aucun symbole décoratif, ni dans le code, ni dans les commentaires, ni dans l'interface.
- Code clair et explicite, sans abstraction prématurée. Préférer la lisibilité à la concision.

## Contraintes audio à ne jamais oublier

- Le traitement audio ne doit jamais bloquer le fil JavaScript principal. La latence et la fluidité de l'interface en dépendent.
- La latence de monitoring vise moins de 20 ms, idéalement moins de 10 ms. La taille des buffers est l'arbitrage central entre latence et stabilité : buffers plus petits, latence plus faible mais charge processeur plus élevée. Ce réglage doit rester ajustable.
- Le looper et les pistes synchronisées doivent partager une horloge audio commune. La synchronisation rythmique repose sur la quantification à la grille de tempo, pas sur des horloges indépendantes.
- Surveiller la charge des effets temps réel. Au-delà d'un certain nombre d'effets simultanés, prévenir le risque de coupure plutôt que de laisser le rendu se dégrader.

## Roadmap par lots

- Lot 1, socle : development build et chaîne APK, lecteur multi-formats avec bibliothèque, enregistreur simple avec métronome.
- Lot 2, ingénierie sonore : mixage multipiste, monitoring faible latence, looper synchronisé avec overdub, premiers effets temps réel.
- Lot 3, export et finitions : mixage final et export par piste, formats multiples dont MP3, paramètres d'encodage, partage, lecture en arrière-plan.

Travailler dans cet ordre. Ne pas commencer le looper avant que l'enregistreur et l'horloge audio soient stables.

## À éviter

- Réintroduire Expo Go ou suggérer de tester l'audio temps réel dans Expo Go.
- Promettre un export universel sans réserve sur les codecs.
- Mettre du traitement audio lourd sur le fil JavaScript principal.
- Mélanger le moteur du lecteur de bibliothèque et le moteur temps réel dans une même abstraction.
- Ajouter des dépendances non justifiées par une exigence du cahier des charges.

@AGENTS.md
@COLLAB_MEMORY.md
