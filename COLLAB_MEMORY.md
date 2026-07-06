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
| Lot 3 | Export et finitions | En cours |

**Lot actif :** Lot 3 — export et finitions. Lots 1 et 2 complets et validés sur S21. Lot 2 = mixage multipiste + monitoring faible latence + looper synchronisé (overdub) + effets biquad, branche `lot-2-mixer` poussée. Lot 3 en cours : export WAV mix+stems (validé), export AAC/M4A via module natif local (code prêt, REBUILD REQUIS avant test).

**Feedback client 2026-07-07 (branche `lot-2-mixer`, code prêt, À TESTER sur S21) :** refonte suite retour client. (1) Enregistreur redessiné : gros bouton d'enregistrement circulaire central + métronome réduit à une icône `metronome` (MaterialCommunityIcons) encadrée d'un `-`/`+`. (2) Looper à durée libre (tap-to-set) : la 1ʳᵉ prise définit la longueur de boucle (fini les mesures 1/2/4) ; overdub toujours quantifié. (3) **CRUD projets = nouvelle organisation centrale** : tables `projects`/`tracks` (déjà au schéma) enfin activées (+ `PRAGMA foreign_keys = ON` dans `initDatabase`), `projectRepository.ts` + `ProjectManager.ts`, écrans `ProjectsScreen` (liste/créer/supprimer) et `ProjectDetailScreen` (renommer, importer des sons via multi-fichiers, gérer les pistes, ouvrir les outils). Mixer/Looper/Enregistreur reçoivent `projectId` et travaillent sur les pistes DU projet ; le Mixer persiste gain/pan (`updateTrackMix`). Home = Lecteur + Projets. (4) Design : charte `theme.ts` conservée, gros chiffres + cercle orange central (inspiration photo fitness fournie). **100% pur JS, PAS de rebuild** (deps déjà liées) : redémarrer Metro avec `-c` (nouvelle famille d'icônes). typecheck OK. Non commité (attente validation visuelle S21).

**Exception charte (validée client 2026-07-07) :** l'icône métronome est désormais autorisée sur l'écran Enregistreur, en plus des écrans Player/NowPlaying. Reste : aucune autre icône hors ces écrans. Le bouton d'enregistrement central est un cercle stylé sans icône (charte).

**Contrainte transverse (rappel utilisateur 2026-07-06) : l'app doit tourner 100% hors-ligne.** Runtime déjà propre (aucun appel réseau dans `src`, vérifié). Le module natif d'encodage utilise l'encodeur Android embarqué (MediaCodec/MediaMuxer), aucune dépendance réseau. Durcissement optionnel restant : retirer la permission INTERNET du build release (fin de Lot 3).

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

### 2026-07-07 — Session 5 (suite) : mode immersif + refonte ergonomique du Mixer + test S21 VALIDÉ

- **Dev client rebâti et testé sur S21 (parcours réel, screenshots adb).** Le feedback de la session 5 est CONFIRMÉ à l'écran : écran Détail projet (projet « Test », 5 pistes dont une prise `rec-*.wav` -> l'enregistreur->piste projet marche), import multi-fichiers OK, Mixer scoppé au projet OK.
- **NB installation dev client (écrase la release) :** l'app installée sur le S21 était la **release** (non debuggable, JS embarqué) qui ignore Metro. Il a fallu `npx expo run:android` pour réinstaller le **dev client** (debug, charge le JS de Metro). Build natif en cache = 53-59 s, AUCUN gel.
- **NB réseau S21 <-> Metro :** le deep link d'Expo pointe sur l'IP LAN (`192.168.88.244`) que le S21 ne joignait pas (-> DevLauncherErrorActivity). Solution fiable en USB : `adb reverse tcp:8081 tcp:8081` puis ouvrir `exp+audiostudio://expo-development-client/?url=http://localhost:8081`. **Garder le câble USB branché.**
- **Demande client (fenêtre Mixer + barre système) :**
  - **Barre de navigation Samsung masquée en mode immersif** (réapparaît seulement au swipe du bas). Ajout dépendance **`expo-navigation-bar` (56.0.3, module natif -> REBUILD, fait)**. Sous edge-to-edge SDK 56 l'API est réduite à `setVisibilityAsync('hidden')` (pas de `setBehaviorAsync`) : suffisant, Android gère le swipe-transient par défaut. Câblé dans `App.tsx` via hook `useImmersiveNavigationBar` (Android seul, ré-assert sur `AppState` 'active'). Vérifié masqué sur Projets/Détail/Mixer. NB : barre cachée = les gestes de bord font "retour" (navigation gestuelle Samsung), comportement système attendu.
  - **Refonte ergonomique `MixerScreen.tsx`** : `useSafeAreaInsets` -> le transport n'est plus coupé par le bas (bug initial : « Exporter les pistes » sous la barre système). Icônes (Ionicons, autorisées par le client) : muet = haut-parleur `volume-high`/`volume-mute`, gain = `remove`/`add`, play/stop = `play`/`stop`, export = `download-outline` (Mix) et `albums-outline` (Pistes, côte à côte). Noms de pistes désormais lisibles en entier.
- **Exception charte élargie (validée client 2026-07-07) :** icônes désormais autorisées aussi sur le **Mixer** (demande explicite « utilise des icônes »). Cumul autorisé : Player, NowPlaying, Enregistreur (métronome), Mixer.
- **Sauvegarde des boucles du looper (question client -> implémenté)** : le looper ne faisait que jouer en direct (aucune sauvegarde). Ajout `Looper.renderLoopToFile()` : rend la somme des couches sur une période via `OfflineAudioContext` + `encodeWav` (réutilise l'infra d'export), écrit un `loop-*.wav` en Document, renvoie l'URI. `LooperScreen` reçoit `projectId` et ajoute un bouton « Sauvegarder dans le projet » (état lecture) -> `addRecordingToProject` -> la boucle devient une piste du projet (exploitable dans le Mixer). Pur JS, pas de rebuild (Fast Refresh). typecheck OK. À TESTER : enregistrer une boucle -> Sauvegarder -> la piste `loop-*.wav` apparaît dans le projet et le Mixer.
- typecheck OK. **Toujours non commité** (attente validation finale client). Reste éventuel : appliquer la même passe ergonomique/immersive vérifiée aux autres écrans si besoin ; le décodage de 5 morceaux complets à l'ouverture du Mixer est lent (spinner ~30-60 s) — piste d'amélioration future (décodage paresseux / à la lecture).

### 2026-07-07 — Session 5 : feedback client (projets CRUD, looper libre, enregistreur redessiné)

- Retour client en 4 points, tous implémentés (code prêt, non commité, À TESTER sur S21). **Pur JS, aucun rebuild** — redémarrer Metro avec `-c` (nouvelle famille d'icônes MaterialCommunityIcons résolue par Metro). Décisions validées avec le client : looper = durée libre tap-to-set ; import = sélection multi-fichiers (pas de SAF) ; projet = contexte central.
- **1. Enregistreur** (`src/ui/EngineeringScreen.tsx`, réécrit) : gros bouton d'enregistrement circulaire orange central (point blanc -> carré rouge en prise), chrono en gros chiffres ; métronome réduit à une ligne `[-] (icône metronome + BPM) [+]`, tap sur l'icône = start/stop, `-`/`+` = ±5 BPM. Reçoit `projectId` ; la prise micro devient une **piste du projet** via `addRecordingToProject` (au lieu de la bibliothèque).
- **2. Looper à durée libre** (`src/audio/looper/Looper.ts` + `LooperScreen.tsx`) : suppression de `bars`/mesures. Boucle de base en tap-to-set : `startBaseLoop()` fixe T0 + arme l'`AudioRecorder`, `stopBaseLoop()` mesure la durée = `buffer.duration` de la prise décodée, lance la couche en boucle. Overdub inchangé (quantifié à la frontière, capture timée via `captureQuantizedLoop`). Helpers `startRecorder`/`stopRecorder` extraits. Limites connues inchangées (jitter setTimeout, latence d'entrée non compensée).
- **3. CRUD projets** = réorganisation centrale. Tables `projects`/`tracks` (déjà au schéma, jamais utilisées) activées : ajout **`PRAGMA foreign_keys = ON`** dans `database.ts` `initDatabase()` (indispensable pour ON DELETE CASCADE). Nouveaux : `src/storage/projectRepository.ts` (CRUD paramétré, `getTrackCounts` en GROUP BY), `src/library/ProjectManager.ts` (create/rename/delete + suppression des fichiers sandbox, `importSoundsToProject` via `DocumentPicker multiple:true`, `addRecordingToProject`, `removeTrack`, `persistTrackMix`). Écrans : `ProjectsScreen` (liste + création inline via TextInput + suppression appui long, `useFocusEffect`) et `ProjectDetailScreen` (renommer au blur, importer des sons, liste pistes + retirer, boutons Mixage/Looper/Enregistreur avec `projectId`). `navigation.ts` : routes `Projects`/`ProjectDetail` + param `projectId` sur Engineering/Mixer/Looper. `App.tsx` : 2 écrans enregistrés. `HomeScreen` = Lecteur + Projets (remplace l'entrée Ingénierie et le placeholder Export).
- **4. Mixer scoppé au projet** (`MixerScreen.tsx`) : charge `listProjectTracks(projectId)` au lieu de `listFiles()` ; récupère gain/pan persistés ; `changeGain`/`setPan` appellent `persistTrackMix`. Filtre biquad NON persisté (pas de colonnes — évolution notée). Export mix/stems inchangé.
- **Design** : `theme.ts` conservé (déjà aligné sur la photo fitness fournie) ; gros chiffres orange (compteurs pistes, chrono, BPM), cercle orange central. **Exception charte** consignée : icône métronome autorisée sur l'Enregistreur (en plus de Player/NowPlaying).
- typecheck OK (0 erreur). Fichiers non commités (attente validation visuelle S21). Plan approuvé : `~/.claude/plans/resilient-frolicking-riddle.md`.
- À VÉRIFIER SUR S21 : créer/renommer/supprimer un projet (cascade pistes), import multi-fichiers -> pistes, enregistreur (bouton central + métronome icône, prise -> piste projet), looper durée libre (start/stop -> boucle, overdub calé), Mixer projet-scoppé + persistance gain/pan (quitter/rouvrir), export inchangé. Hors-ligne conservé (aucun appel réseau ajouté).

### 2026-07-06 — Session 4 (suite 3) : livraison APK client + support installation S21

- APK release `~/audiostudio-feedback.apk` (44 Mo) confirmé prêt et poussé sur le S21 dans `/sdcard/Download/` (partageable depuis Fichiers > Téléchargements). Identique à `android/app/build/outputs/apk/release/app-release.apk`.
- Support installation : l'utilisateur ne trouvait pas l'app. Diagnostic adb : package `com.audiostudio.app` bien installé en **user 0** (profil principal), launcher `.MainActivity` OK, aussi présent dans « Secure Folder » (user 150). App = nom **« AudioStudio »** dans le tiroir (pas le nom du fichier .apk). Lancée à distance avec succès. Rappel donné : le fichier .apk n'apparaît jamais comme une app (juste l'installateur).
- NB adb sur Parrot : le S21 apparaît d'abord en MTP seul ; `adb kill-server && adb start-server` a suffi à le faire reconnaître (RZCW709MFVX).
- **En attente : feedback client sur l'APK release.** Reprise Lot 3 ensuite (valider export AAC/M4A post-rebuild, puis partage expo-sharing + durcissement permission INTERNET).

### 2026-07-06 — Session 4 (suite 2) : charte sombre app-wide + APK release autonome

- Charte graphique sombre neumorphique étendue à TOUTE l'app (demande utilisateur) : `src/ui/theme.ts` (ajout tokens `danger`/`border`), restyle Home/Engineering/Looper/Mixer sur la palette, thème de navigation sombre global dans `App.tsx` (`navTheme` basé sur DarkTheme + `screenOptions` header sombre), StatusBar `light`, ActivityIndicator en accent. **L'exception icônes est désormais de facto app-wide** (mais les écrans de contrôle gardent des libellés texte, plus clairs).
- **APK release autonome produit et validé** : `./android/gradlew -p android assembleRelease`. 1er build = 14 min (recompile C++ natif Release, phase lourde mais AUCUN gel : swap stable ~1,8-2,3 Gi, minify OFF par défaut, arm64-v8a seul). Rebuild après le restyle JS = **1 min** (natif en cache). APK = `android/app/build/outputs/apk/release/app-release.apk` (~45,8 Mo), signé keystore debug -> installable directement, copié en `~/audiostudio-feedback.apk`.
- **Hors-ligne prouvé** : APK contient `assets/index.android.bundle` (JS embarqué) + `classes.dex` ; tourne sans Metro, testé sur S21 EN MODE AVION, aucun crash, aucune tentative de dev server. `expo-dev-launcher`/`dev-menu` compilés mais inertes en release.
- RAPPEL distinction : l'APK **development** (dev client) N'EST PAS partageable (charge le JS depuis Metro/PC) ; seul l'APK **release** est autonome. Profil EAS `preview` (eas.json) = alternative cloud si gels reviennent.
- typecheck OK. A committer + pousser. APK `~/audiostudio-feedback.apk` prêt à envoyer au client pour feedback.

### 2026-07-06 — Session 4 (suite) : refonte UI lecteur (design sombre neumorphique)

- Demande utilisateur : implémenter un design fourni (mockup) AVANT de finir Lot 3 — lecteur sombre neumorphique, art circulaire, scrubber dégradé orange, transport type DAW + écran playlist.
- **EXCEPTION VALIDÉE UTILISATEUR (déroge à CLAUDE.md "aucune icône dans l'UI") : icônes autorisées UNIQUEMENT sur les écrans Player et NowPlaying.** Le reste de l'app garde des libellés texte. Lib : `@expo/vector-icons` (Ionicons), installée via `expo install` — **pas de rebuild** (assets JS bundlés par Metro, `expo-font` déjà lié nativement dans le dev client, imbriqué sous `node_modules/expo/node_modules/expo-font`).
- Dégradé du scrubber : **pur JS** (choix utilisateur, sans rebuild) via `src/ui/components/HorizontalGradient.tsx` (segments à couleur interpolée). Pas de expo-linear-gradient.
- Fichiers : `src/ui/theme.ts` (palette sombre + bordures neumorphiques approx — Android n'a qu'une ombre `elevation`, relief simulé par bordures claires/sombres), `src/ui/NowPlayingScreen.tsx` (art circulaire placeholder note de musique, scrubber cliquable pour seek via `useProgress`+`seekTo`, transport neumorphique), `PlayerScreen.tsx` réécrit (playlist sombre, pill orange sur piste active, bouton play/pause par ligne, mini-barre de lecture qui ouvre NowPlaying). `LibraryPlayer.seekTo` ajouté. `navigation.ts`+`App.tsx` : route `NowPlaying`, `headerShown:false` sur Player+NowPlaying (headers sombres custom avec bouton retour).
- typecheck OK. Pur JS -> Metro redémarré avec `-c` (nouveau package @expo/vector-icons non résolu par le Metro déjà lancé), app rechargée via deep link. Bundle 1208 modules, aucune erreur logcat, app vivante.
- A VERIFIER A L'ECRAN (utilisateur) : rendu sombre/neumorphique, pill orange sur piste active, play/pause par ligne, mini-barre, ouverture NowPlaying, scrubber (progression + seek au tap), boutons transport. Réglages fins couleurs/tailles possibles.
- Coeur (favori) et repeat = visuels/local uniquement (pas de persistance ni logique) pour l'instant.
- NB : travail NON commité (attente validation visuelle). Ensuite : reprise Lot 3 (export AAC/M4A à valider après rebuild précédent).

### 2026-07-06 — Session 4 : Lot 3 — export AAC/M4A via module natif Android

- Reprise après pause. Rappel utilisateur : contrainte transverse = app 100% hors-ligne. Vérifié : aucun appel réseau dans `src` (grep http/fetch/axios = 0). Runtime déjà hors-ligne. Décision de reprise : continuer Lot 3, cap sur les formats d'export ; **AAC/M4A d'abord** ; partage (expo-sharing) reporté à un rebuild ultérieur (éviter 2 builds risqués sur 8 Go RAM).
- Problème de fond : `react-native-audio-api` ne produit que du PCM/WAV. Pour AAC/M4A/FLAC/Opus, CLAUDE.md impose l'encodeur média natif d'Android. Aucune dépendance existante ne l'expose -> **module natif Expo local** (pas de dépendance externe, conforme + hors-ligne).
- `modules/audio-encoder/` créé via `npx create-expo-module --local` (template @57, projet SDK 56 — OK). Élagué : iOS/web/View/types supprimés, `expo-module.config.json` -> `platforms: ["android"]` seul. Autolinking confirmé (`expo-modules-autolinking resolve` voit `expo.modules.audioencoder.AudioEncoderModule`).
- Encodeur Kotlin `AudioEncoderModule.kt` : `AsyncFunction("encodeWavToM4a")(inputUri, outputUri, bitRate)`. AsyncFunction = thread natif, **ne bloque jamais le fil JS** (contrainte audio CLAUDE.md). Parse l'en-tête WAV (RIFF, blocs fmt/data, robuste aux blocs additionnels + padding), exige PCM 16 bits, encode via `MediaCodec` AAC-LC + mux `MediaMuxer` MP4 (.m4a). Gère EOS, INFO_OUTPUT_FORMAT_CHANGED, BUFFER_FLAG_CODEC_CONFIG. Bitrate 192 kbps.
- `src/audio/export/Exporter.ts` refactor : `ExportFormat = 'wav' | 'm4a'`. `exportMix(engine, tracks, format)` et `exportTrack(engine, track, format)` remplacent les variantes `*ToWav`. `finalize()` : WAV -> écriture directe Document ; M4A -> WAV temporaire en cache -> `AudioEncoder.encodeWavToM4a` -> Document, temp supprimé. `addExportToLibrary` déduit le type de l'extension (.m4a OK, pas de modif).
- `src/ui/MixerScreen.tsx` : sélecteur de format WAV/M4A, boutons "Exporter le mix (WAV|M4A)" + "Exporter les pistes" pilotés par le format choisi.
- typecheck OK. **REBUILD REQUIS** (code natif ajouté) : `npx expo run:android` — étape à risque de gel sur 8 Go (fermer Chrome, ou basculer `eas build -p android --profile preview`). Fast Refresh ne recharge pas le natif.
- A VERIFIER A L'USAGE après rebuild : Mixer > Format M4A > Exporter le mix -> fichier mix-*.m4a dans le Lecteur, lisible, taille << WAV. Idem stems. WAV inchangé.
- MP3 toujours non fourni (cas LAME). FLAC/Opus = extension future du même module (autre MIME MediaCodec). Partage (expo-sharing) + durcissement permission INTERNET = suite Lot 3.
- NB commits : travail stems (Exporter/MixerScreen) + ce lot natif non encore commités (attente validation utilisateur post-rebuild).

### 2026-06-17 — Session 3 (suite 5) : Lot 2 complet + début Lot 3 (export mix WAV)

- Lot 2 TERMINE ET VALIDE : mixage multipiste + monitoring + looper + effets biquad. Tout sur branche `lot-2-mixer` (4 commits, poussés).
- Début Lot 3 — export du mix final en WAV (choix utilisateur) :
  - `src/audio/export/wav.ts` : encodeur WAV PCM 16 bits (Float32 interleavé -> int16, en-tête RIFF), sans dépendance.
  - `src/audio/export/Exporter.ts` : `exportMixToWav(engine, tracks)` reconstruit le graphe (source+gain+pan+filtre) dans un `OfflineAudioContext`, `startRendering()` -> AudioBuffer, encode WAV, écrit dans Document via `expo-file-system` (`File.create()` + `File.write(Uint8Array)`). Pistes muettes exclues. Longueur = max durationSec des pistes.
  - `src/library/LibraryManager.ts` : `addExportToLibrary()` (artist 'Mix').
  - `src/ui/MixerScreen.tsx` : bouton "Exporter le mix (WAV)" -> rendu + ajout biblio + alerte.
- Pur JS (OfflineAudioContext + expo-file-system), pas de rebuild. typecheck OK, bundle rechargé sans crash.
- A VERIFIER A L'USAGE : Mixer > Exporter le mix (WAV) -> fichier mix-*.wav créé, apparait dans le Lecteur, lecture = somme des pistes avec gain/pan/filtres appliqués.
- Export WAV mix VALIDE UTILISATEUR. Commité + poussé (lot-2-mixer).
- Question utilisateur (offline) : confirmé que l'appli fonctionne 100% hors-ligne au runtime (aucun appel réseau dans src, SQLite+fichiers locaux, moteurs audio locaux). Seules dépendances internet = dev (Metro dev client) et build cloud EAS (alternative: build local Gradle). Durcissement possible : retirer permission INTERNET du build release (à faire en fin de Lot 3 si souhaité).
- Export par piste (stems) : `Exporter.ts` refactorisé avec `renderTracksToWav` partagé ; `exportTrackToWav(engine, track)` rend une piste seule (gain/pan/filtre, mute ignoré) -> fichier stem-<nom>-*.wav ajouté à la biblio. Bouton "Exporter les pistes" dans MixerScreen (boucle sur les pistes). typecheck OK, pur JS, sans crash.
- A VERIFIER A L'USAGE : "Exporter les pistes" -> un WAV par piste dans le Lecteur (stem-<nom>).
- Reste Lot 3 : partage (expo-sharing -> NATIVE, rebuild requis), autres formats (AAC/M4A/FLAC/Opus via encodeur Android ; MP3 = cas LAME), paramètres d'encodage, lecture arrière-plan (track-player gère déjà la notif). Stems à commiter une fois validés.

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
