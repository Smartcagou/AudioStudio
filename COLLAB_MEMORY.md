# COLLAB_MEMORY.md

Fichier de contexte partageable. Chargé automatiquement à chaque session via `@COLLAB_MEMORY.md` dans CLAUDE.md.
Tenir à jour ce fichier à la fin de chaque session de travail.
Format : décision ou fait, puis **Pourquoi** et **Impact** sur une ligne chacun.

---

## Etat d'avancement

| Lot | Intitulé | Statut |
| --- | -------- | ------ |
| Lot 1 | Socle : build, lecteur, enregistreur + métronome | Terminé (validé utilisateur 2026-06-17) |
| Lot 2 | Ingénierie sonore : mixage, looper, effets | Terminé (validé utilisateur 2026-06-17) |
| Lot 3 | Export et finitions | Non commencé |

**Lot actif :** Lot 3 — export et finitions. Lots 1 et 2 complets et validés sur S21. Lot 2 = mixage multipiste + monitoring faible latence + looper synchronisé (overdub) + effets biquad, branche `lot-2-mixer` poussée.

---

## Environnement de développement

**Poste actif : Parrot OS (Linux) — migration terminée, development build fonctionnel sur S21.**

| Outil | Version | Statut |
| ----- | ------- | ------ |
| OS | Parrot OS (Linux) | OK |
| Node.js | 24.x | OK |
| Expo SDK | ~56.0.12 | OK |
| Android SDK / ADB | platform-tools | OK — S21 reconnu (RZCW709MFVX, SM-G990B2, Galaxy S21 FE) |
| EAS CLI | >= 12.0.0 | A confirmer |

**Contrainte matérielle : 8 Go de RAM.** Le build Android local sature le swap et a déjà gelé la machine (voir journal 2026-06-16 soir). Réglages mémoire pérennisés dans **`~/.gradle/gradle.properties`** (GRADLE_USER_HOME, hors projet) : `org.gradle.jvmargs=-Xmx1536m`, `parallel=false`, `workers.max=2`, `kotlin.daemon.jvmargs=-Xmx1024m`, `reactNativeArchitectures=arm64-v8a`. Cet emplacement a priorité sur le `gradle.properties` du projet et survit à `prebuild --clean` (le dossier `android/` est gitignoré et régénéré). N'affecte PAS les builds EAS cloud. NB : `expo-build-properties` ne couvre PAS jvmargs/parallel/workers (seulement `buildArchs`), d'où le choix de `~/.gradle`. Fermer Chrome pendant le build.

### Commandes de setup à lancer sur Parrot (première session)

```bash
# 1. Node.js via nvm (recommandé sur Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24

# 2. Cloner / copier le projet puis installer les dépendances
npm install

# 3. Android SDK via Android Studio ou sdkmanager standalone
# Ajouter dans ~/.bashrc :
# export ANDROID_HOME=$HOME/Android/Sdk
# export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools

# 4. EAS CLI
npm install -g eas-cli

# 5. Vérifier le S21 connecté en USB debugging
adb devices

# 6. Lancer le development build
npx expo run:android
```

---

## Décisions d'architecture

### DA-001 — Séparation stricte moteur temps réel / lecteur bibliothèque

**Pourquoi :** les deux moteurs ont des contraintes radicalement différentes (latence vs décodage). Les mélanger créerait des conflits de threading et rendrait impossible l'optimisation de chacun.

**Impact :** `src/audio/engine/` et `src/player/` ne partagent aucune abstraction commune. Deux instances de lecture peuvent coexister.

### DA-002 — react-native-audio-api pour le temps réel

**Pourquoi :** seule lib RN à exposer un vrai graphe audio Web Audio API-like avec thread dédié, buffers PCM accessibles et effets biquad natifs. `expo-av` n'offre pas d'accès au thread audio.

**Impact :** impose un development build obligatoire (module natif). Expo Go est exclu définitivement.

### DA-003 — react-native-track-player pour le lecteur bibliothèque

**Pourquoi :** basé sur ExoPlayer (Android), supporte tous les formats cibles, gère la file de lecture, les métadonnées et la lecture en arrière-plan avec notification système.

**Impact :** nécessite `@react-native-async-storage/async-storage` comme dépendance pair et un `PlaybackService` enregistré dans `index.ts`.

**Patch New Architecture obligatoire (DA-003b) :** RNTP 4.1.2 crashe au chargement sous New Arch — `TurboModuleInteropUtils$ParsingException: returnType == void iff synchronous` sur `TrackPlayerModule`. Cause : ~37 méthodes `MusicModule.kt` en corps d'expression `fun x(...) = scope.launch { }` retournent `Job` au lieu de `Unit`. Correctif dans `patches/react-native-track-player+4.1.2.patch` : `.let {}` ajouté sur l'accolade fermante de chaque méthode (coerce le retour en `Unit`). Patch régénéré via `npx patch-package`, appliqué au `postinstall`. NE PAS désactiver la New Arch (react-native-audio-api l'exige, DA-002).

Second crash New Arch (même patch) : à l'émission d'événements (`loadQueue`/lecture), `MusicService.emit`/`emitList` utilisaient `reactNativeHost.reactInstanceManager.currentReactContext` -> `RuntimeException: You should not use ReactNativeHost directly in the New Architecture` (FATAL). Corrigé en passant par `(applicationContext as ReactApplication).reactHost?.currentReactContext` (+ import `com.facebook.react.ReactApplication`). Les deux crashs RNTP sont donc dans le même fichier de patch. Leçon : RNTP 4.1.2 a plusieurs points d'incompatibilité New Arch, valider chaque chemin (chargement module ET émission d'événements).

### DA-004 — expo-sqlite pour la persistance

**Pourquoi :** solution embarquée, pas de réseau, mono-utilisateur. Correspond exactement au périmètre actuel (projets, pistes, réglages).

**Impact :** pas de migration vers un backend dans ce périmètre. Si la collaboration multi-utilisateur arrive un jour, réévaluer.

### DA-005 — TypeScript strict, composants fonctionnels, pas de commentaire descriptif

**Pourquoi :** cohérence avec les conventions CLAUDE.md. Les classes auraient compliqué l'intégration avec les hooks React.

**Impact :** tous les modules sont des fonctions exportées ou des classes légères sans héritage.

---

## Blockers actuels

- [x] ~~Migration vers Parrot OS~~ : résolu. Node, Android SDK, ADB OK, S21 reconnu, dev build lancé.
- [ ] **RAM 8 Go** : contrainte persistante, pas un blocker mais à surveiller. Basculer sur `eas build` si les gels reviennent.
- [x] ~~Réglages mémoire à pérenniser~~ : fait dans `~/.gradle/gradle.properties` (survit à prebuild --clean, prioritaire sur le projet).

---

## Questions ouvertes

- Q1 : Faut-il un `babel.config.js` personnalisé ou celui généré par Expo suffit ?
- Q2 : ~~Doit-on prévoir un `.nvmrc` ou `.node-version` ?~~ Résolu : `.node-version` créé (24.16.0).

---

## Journal de session

### 2026-06-17 — Session 3 (suite 5) : Lot 2 complet + début Lot 3 (export mix WAV)

- Lot 2 TERMINE ET VALIDE : mixage multipiste + monitoring + looper + effets biquad. Tout sur branche `lot-2-mixer` (4 commits, poussés).
- Début Lot 3 — export du mix final en WAV (choix utilisateur) :
  - `src/audio/export/wav.ts` : encodeur WAV PCM 16 bits (Float32 interleavé -> int16, en-tête RIFF), sans dépendance.
  - `src/audio/export/Exporter.ts` : `exportMixToWav(engine, tracks)` reconstruit le graphe (source+gain+pan+filtre) dans un `OfflineAudioContext`, `startRendering()` -> AudioBuffer, encode WAV, écrit dans Document via `expo-file-system` (`File.create()` + `File.write(Uint8Array)`). Pistes muettes exclues. Longueur = max durationSec des pistes.
  - `src/library/LibraryManager.ts` : `addExportToLibrary()` (artist 'Mix').
  - `src/ui/MixerScreen.tsx` : bouton "Exporter le mix (WAV)" -> rendu + ajout biblio + alerte.
- Pur JS (OfflineAudioContext + expo-file-system), pas de rebuild. typecheck OK, bundle rechargé sans crash.
- A VERIFIER A L'USAGE : Mixer > Exporter le mix (WAV) -> fichier mix-*.wav créé, apparait dans le Lecteur, lecture = somme des pistes avec gain/pan/filtres appliqués.
- Reste Lot 3 : partage (expo-sharing -> NATIVE, rebuild requis), autres formats (AAC/M4A/FLAC/Opus via encodeur Android ; MP3 = cas LAME), export par piste, paramètres d'encodage, lecture arrière-plan (track-player gère déjà la notif). Export WAV à commiter une fois validé.

### 2026-06-17 — Session 3 (suite 4) : commit/push Lot 1 + début Lot 2 (mixage multipiste)

- Lot 1 commité sur branche `lot-1-socle` et poussé sur origin. NB : remote basculé en SSH (`git@github.com:Smartcagou/AudioStudio.git`) car HTTPS sans credentials ; clé `~/.ssh/id_ed25519` authentifie comme Smartcagou. `.claude/settings.json` volontairement exclu du commit (config outillage).
- Début Lot 2 — mixage multipiste (sur le moteur temps réel, distinct de LibraryPlayer, DA-001) :
  - `src/audio/mixer/Track.ts` : classe Track. Graphe source->gain->panner->master. `decodeAudioData(uri)` -> AudioBuffer ; source recréée à chaque start (sources Web Audio à usage unique). gainDb (dbToLinear), pan (StereoPanner -1..1), mute.
  - `src/audio/mixer/Mixer.ts` : bus master (GainNode->destination), addTrack/removeTrack, `playAll()` démarre toutes les pistes au même `when` (currentTime+0.1) -> départ synchronisé à l'échantillon, stopAll, masterGain, clear.
  - `src/ui/MixerScreen.tsx` : charge toute la bibliothèque en pistes, gain +/-3 dB, pan G/C/D, mute, Tout lire/Arreter. Accès via bouton sur EngineeringScreen (route Mixer).
- typecheck OK, pur JS (pas de rebuild), bundle rechargé sans crash. Décodage seulement à l'ouverture de l'écran Mixer.
- Mixage multipiste VALIDE UTILISATEUR (lecture simultanée synchronisée, gain/pan/mute OK). `decodeAudioData` accepte donc bien les URI file:// (pas besoin de stripper).
- Mixer commité + poussé sur branche `lot-2-mixer` (depuis lot-1-socle).
- Monitoring faible latence implémenté : `Recorder.setMonitoring()` + chemin `RecorderAdapterNode -> gain -> destination` câblé dans `Recorder.start()` (armé avant la prise, type DAW). Toggle Monitoring dans EngineeringScreen avec avertissement larsen (casque obligatoire). NB : taille de buffer/latence pas réglable côté JS en 0.12.2 (seul sampleRate exposé) -> latence = défaut natif. typecheck OK, pur JS, bundle rechargé sans crash.
- Monitoring VALIDE UTILISATEUR. Commité + poussé sur `lot-2-mixer`.
- Looper synchronisé avec overdub implémenté :
  - `src/audio/looper/Looper.ts` : longueur de boucle = bars x beatsPerBar x (60/bpm) du moteur (quantification grille). Capture une boucle via AudioRecorder (WAV Cache, prefix loop-) -> decodeAudioData -> AudioBuffer ; chaque couche = AudioBufferSourceNode loop=true, loopEnd=loopDur (période verrouillée, pas de dérive). Ancrage commun T0 ; couches démarrées sur `nextBoundary()` (T0 + k*loopDur). Overdub quantize=true (attend la frontière avant de capturer). undoLastLayer, clear.
  - `src/ui/LooperScreen.tsx` : choix mesures (1/2/4), Enregistrer la boucle, Overdub, Annuler derniere couche, Effacer. Avertissement casque. Accès via bouton EngineeringScreen (route Looper).
- LIMITES CONNUES (assumées v1) : le timing de capture (début/durée) repose sur des setTimeout JS (jitter ~10-30 ms) et il y a une latence d'entrée micro non compensée -> léger offset de phase constant possible entre couches. La période est exacte (pas de dérive) mais l'alignement à beat 1 n'est pas sample-accurate. Compensation de latence = amélioration future (idéalement quand la lib exposera le réglage de buffer / un timestamp de capture).
- typecheck OK, pur JS, bundle rechargé sans crash.
- Looper VALIDE UTILISATEUR. Commité + poussé sur `lot-2-mixer`.
- Premiers effets temps réel : filtre biquad par piste du mixer.
  - `src/audio/mixer/Track.ts` : BiquadFilterNode inséré, bypass par reconnexion (gain -> filtre -> pan si actif, sinon gain -> pan). setFilterType ('lowpass'|'highpass'), setFilterFrequency (20-20000). TrackInfo étendu (filterEnabled/type/frequency) ; nouveau type TrackInit pour la création.
  - `src/ui/MixerScreen.tsx` : par piste, choix Aucun/Passe-bas/Passe-haut + fréquence (x1.5 / /1.5).
- typecheck OK, pur JS, bundle rechargé sans crash.
- A VERIFIER A L'OREILLE : sur une piste du mixer, activer Passe-bas/Passe-haut pendant la lecture -> filtrage audible, fréquence ajustable, Aucun = transparent.
- Lot 2 quasi bouclé (mixage + monitoring + looper + effets). Effets à commiter une fois validés. Surveiller la charge si beaucoup d'effets simultanés (CLAUDE.md). Ensuite Lot 3 : mixage final + export par piste, formats multiples dont MP3 (cas LAME), paramètres d'encodage, partage, lecture en arrière-plan.

### 2026-06-17 — Session 3 (suite 3) : enregistreur micro (fin Lot 1)

- LOT 1 TERMINE ET VALIDE UTILISATEUR : build/APK sur S21, lecteur multi-formats + bibliothèque, métronome, enregistreur WAV (enregistrement->écoute OK).
- Métronome validé utilisateur.
- `src/audio/recorder/Recorder.ts` : wrapper `AudioRecorder` (react-native-audio-api). Permission micro gérée nativement par la lib via `AudioManager.checkRecordingPermissions()` / `requestRecordingPermissions()` (`PermissionStatus = 'Granted'|'Denied'|'Undetermined'`) -> pas besoin de PermissionsAndroid externe. Sortie fichier WAV mono dans `FileDirectory.Document`, prefix `rec-`. `stop()` renvoie `FileInfo {paths, size (Mo), duration (s)}`. Départ ancré sur `engine.getClock().frame` (réf. pour le looper Lot 2).
- `src/library/LibraryManager.ts` : `addRecordingToLibrary()` insère la prise dans `library_files` -> relisible immédiatement dans le Lecteur (boucle enregistrement->écoute).
- `src/ui/EngineeringScreen.tsx` : section Enregistreur (Enregistrer/Arreter, durée live via `getCurrentDuration()`, métronome activable pendant la prise). Recorder = pur JS (natif déjà dans le dev client) -> pas de rebuild.
- typecheck OK, bundle rechargé sans crash.
- A VERIFIER A L'OREILLE : accord permission micro au 1er enregistrement, prise audible relisible depuis le Lecteur, durée correcte.
- Lot 1 quasi bouclé. Reste à confirmer le recorder, puis basculer Lot 1 -> Terminé et démarrer Lot 2 (monitoring faible latence, mixage multipiste, looper synchronisé sur getClock(), premiers effets biquad).

### 2026-06-17 — Session 3 (suite 2) : crashs RNTP New Arch + moteur/horloge/métronome

- Lecteur validé utilisateur (lecture OK). Deux crashs RNTP/New Arch corrigés en cours de route, tous deux dans `patches/react-native-track-player+4.1.2.patch` (voir DA-003b) : (1) chargement module TurboModule (`.let {}` x37), (2) `MusicService.emit` via `ReactHost` au lieu de `reactNativeHost`.
- Moteur temps réel démarré (Lot 1) :
  - `src/audio/engine/AudioEngine.ts` : AudioContext réel (react-native-audio-api 0.12.2), horloge `getClock()` (currentTime->frame), tempo sur le moteur (source de vérité), singleton `getAudioEngine()`. NB : buffer size pas encore réglable côté JS (lib 0.12.2 n'expose que sampleRate) ; champ conservé.
  - `src/audio/metronome/Metronome.ts` : scheduler anticipé (lookahead 25 ms, schedule-ahead 100 ms), clic oscillateur+enveloppe calé sample-accurate, temps fort accentué (1500 Hz vs 1000 Hz). Lit le tempo du moteur à chaque temps -> changement de BPM à chaud OK.
  - `src/ui/EngineeringScreen.tsx` : BPM +/- (40-240) + Demarrer/Arreter ; câblé depuis HomeScreen (route Engineering).
- react-native-audio-api était déjà dans le dev client -> métronome = pur JS, pas de rebuild. typecheck OK, bundle rechargé, lib native chargée, aucun crash.
- A VERIFIER A L'OREILLE : clic audible, justesse du tempo, accent du temps fort, stabilité au changement de BPM pendant lecture.
- Prochaine étape Lot 1 : enregistreur micro (capture PCM/WAV) calé sur getClock(), avec option métronome pendant l'enregistrement. Puis fin Lot 1.

### 2026-06-17 — Session 3 (suite) : audit + slice lecteur Lot 1

- Audit sécurité (OWASP) sur le code réel : 0 critique/haute, 1 medium uuid (build-time, accepté), L1 corrigé (`.gitignore` -> `.env*`). LLM01-10 et catégories serveur non applicables (app hors-ligne mono-utilisateur).
- Réglages mémoire Gradle pérennisés dans `~/.gradle/gradle.properties` (cf. section Environnement). Choix motivé : expo-build-properties ne couvre pas jvmargs/parallel/workers.
- Navigation : React Navigation native-stack (choix utilisateur), moins disruptif que expo-router vu l'entrée custom (index.ts + PlaybackService). Deps via `expo install` : @react-navigation/native@7, native-stack, react-native-screens 4.25.2, safe-area-context ~5.7.
- Slice vertical LECTEUR implémenté (Lot 1) :
  - `src/storage/` : table `library_files`, modèle `LibraryFile`, `libraryRepository.ts` (requêtes paramétrées).
  - `src/library/LibraryManager.ts` : import via expo-document-picker + copie sandbox via nouvelle API expo-file-system (File/Paths), persistance DB. Refactor classe -> fonctions de module.
  - `src/player/LibraryPlayer.ts` : setup TrackPlayer idempotent, capabilities notif, setQueue/play/pause/skip. Fonctions de module.
  - `src/ui/` : App.tsx (NavigationContainer + init DB puis player), HomeScreen (navigation), PlayerScreen (liste, import, transport via hooks usePlaybackState/useActiveTrack).
- typecheck OK. Rebuild dev client BUILD SUCCESSFUL 4m39s (machine stable, ~1.7 Go libre min). App lancée sur S21, PID vivant, aucun crash/FATAL/erreur JS.
- A VERIFIER MANUELLEMENT par l'utilisateur : import réel d'un fichier audio (picker), lecture/pause/skip audible, persistance après redémarrage app, notification média en arrière-plan.
- Prochaine étape Lot 1 : enregistreur simple + métronome (après horloge moteur). Métadonnées réelles (durée/artiste) non encore extraites à l'import (title=filename pour l'instant).

### 2026-06-17 — Session 3 : premier development build sur S21

- Diagnostic du gel machine de la veille (logs journalctl) : pas un bug logiciel mais un gel système par saturation du swap pendant le build Gradle sur 8 Go de RAM. Signature : `kwin main thread hanging`, `system is too slow`, cold boot sans shutdown propre. Aucun OOM-killer (gel dur avant action noyau).
- Réglages mémoire appliqués dans `android/gradle.properties` : `parallel=false`, `workers.max=2`, heap 1536m, daemon Kotlin 1024m, `reactNativeArchitectures=arm64-v8a` seul.
- S21 d'abord vu en MTP seul (debug USB inactif) ; après activation des options développeur + autorisation RSA → `adb devices` OK (RZCW709MFVX).
- `npx expo run:android` : BUILD SUCCESSFUL en 3m11s, APK installé, app lancée (com.audiostudio.app, PID actif), bundle JS OK (750 modules). Machine stable, aucun gel.
- Prochaine étape : implémenter le Lot 1 (AudioContext natif, TrackPlayer setup, LibraryManager, HomeScreen navigation) ; pérenniser les réglages Gradle via expo-build-properties.

### 2026-06-16 — Session 2 : audit sécurité et préparation migration Parrot

- Audit OWASP complet : 0 critique, 0 haute, 1 moyenne (uuid CVE build-time), 5 faibles.
- Correctifs appliqués : `allowBackup: false` dans app.json, `handleEvent` avec `.catch()` dans PlaybackService, commentaire anti-injection SQL dans database.ts.
- Tentative `expo run:android` sur Windows : Android SDK absent, ADB non configuré → bloqué.
- Décision : migration du projet vers Parrot OS pour la prochaine session.
- Prochaine étape : setup environnement Android sur Parrot, puis `npx expo run:android` sur S21.

### 2026-06-16 — Session 1 : nettoyage, COLLAB_MEMORY et scaffold propre

- Suppression du scaffold défectueux (fausses dépendances, Node trop ancien).
- Mise à jour Node.js 20.18 → 24.16.0.
- Création de COLLAB_MEMORY.md, intégré dans CLAUDE.md via `@COLLAB_MEMORY.md`.
- Initialisation Expo SDK 56 (~56.0.12) avec template blank-typescript.
- Dépendances installées : expo-dev-client, expo-sqlite, expo-document-picker, expo-file-system, expo-system-ui, react-native-audio-api, react-native-track-player, @react-native-async-storage/async-storage.
- Structure src/ complète créée (stubs Lot 1) : engine, recorder, mixer, looper, export, player, library, storage, state, ui.
- `npm run typecheck` : 0 erreur.
- Prochaine étape : implémenter le Lot 1 (AudioContext natif, TrackPlayer setup, LibraryManager, HomeScreen navigation).
