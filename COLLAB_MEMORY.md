# COLLAB_MEMORY.md

Fichier de contexte partageable. Chargé automatiquement à chaque session via `@COLLAB_MEMORY.md` dans CLAUDE.md.
Tenir à jour ce fichier à la fin de chaque session de travail.
Format : décision ou fait, puis **Pourquoi** et **Impact** sur une ligne chacun.

---

## Etat d'avancement

| Lot | Intitulé | Statut |
| --- | -------- | ------ |
| Lot 1 | Socle : build, lecteur, enregistreur + métronome | Non commencé |
| Lot 2 | Ingénierie sonore : mixage, looper, effets | Non commencé |
| Lot 3 | Export et finitions | Non commencé |

**Lot actif :** Lot 1 — scaffold initialisé, implémentation à commencer.

---

## Environnement de développement

**Poste actif : Parrot OS (Linux) — migration depuis Windows 11 en cours.**

| Outil | Version (Windows) | Version requise | Statut |
| ----- | ----------------- | --------------- | ------ |
| OS | Windows 11 → Parrot OS | Linux ou Windows | Migration à faire |
| Node.js | 24.16.0 | ^20.19.4 ou ^22.x ou ^24.x | A réinstaller sur Parrot |
| npm | 11.12.0 | compatible | A réinstaller sur Parrot |
| Expo SDK | ~56.0.12 | 56.x | OK (dans package.json) |
| Android Studio / ADB | Non configuré (Windows) | SDK + platform-tools | A installer sur Parrot |
| EAS CLI | — | >= 12.0.0 | A installer sur Parrot |

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

### DA-004 — expo-sqlite pour la persistance

**Pourquoi :** solution embarquée, pas de réseau, mono-utilisateur. Correspond exactement au périmètre actuel (projets, pistes, réglages).

**Impact :** pas de migration vers un backend dans ce périmètre. Si la collaboration multi-utilisateur arrive un jour, réévaluer.

### DA-005 — TypeScript strict, composants fonctionnels, pas de commentaire descriptif

**Pourquoi :** cohérence avec les conventions CLAUDE.md. Les classes auraient compliqué l'intégration avec les hooks React.

**Impact :** tous les modules sont des fonctions exportées ou des classes légères sans héritage.

---

## Blockers actuels

- [ ] **Migration vers Parrot OS** : Node, Android SDK, ADB à installer. Voir section "Commandes de setup" ci-dessus.
- [ ] **Android Studio / ADB absent sur Windows** : non bloquant, résolu sur Parrot.

---

## Questions ouvertes

- Q1 : Faut-il un `babel.config.js` personnalisé ou celui généré par Expo suffit ?
- Q2 : ~~Doit-on prévoir un `.nvmrc` ou `.node-version` ?~~ Résolu : `.node-version` créé (24.16.0).

---

## Journal de session

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
