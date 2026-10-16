# 🔬 SciClub Manager

**SciClub Manager** est une solution complète, moderne, sécurisée et modulaire conçue pour administrer et animer les serveurs Discord de **clubs scientifiques** scolaires et universitaires (Intelligence Artificielle, Robotique, Informatique, Astronomie, Physique, Chimie, Biologie et Mathématiques).

Elle associe un **Bot Discord v14** haute performance, une **API REST sécurisée Express.js**, une **interface web d'administration React/Vite/Tailwind** connectée à Discord via OAuth2, ainsi qu'un système de **configuration déclarative en JSON** validé par Zod avec sauvegardes horodatées automatiques.

---

## 📑 Sommaire

1. [Stack Technique](#1-stack-technique)
2. [Arborescence du Projet](#2-arborescence-du-projet)
3. [Permissions Minimales du Bot](#3-permissions-minimales-du-bot)
4. [Modèle de Sécurité et Hiérarchie des Permissions](#4-modèle-de-sécurité-et-hiérarchie-des-permissions)
5. [Système Déclaratif JSON & Sauvegardes](#5-système-déclaratif-json--sauvegardes)
6. [Commandes Discord Slash](#6-commandes-discord-slash)
7. [Fonctionnalités du Dashboard Web](#7-fonctionnalités-du-dashboard-web)
8. [Guide d'Installation & Configuration Pas-à-Pas](#8-guide-dinstallation--configuration-pas-à-pas)
9. [Lancement & Déploiement](#9-lancement--déploiement)
10. [Précautions de Sécurité](#10-précautions-de-sécurité)

---

## 1. Stack Technique

- **Moteur d'exécution** : Node.js 20+ (testé avec v22 / v25)
- **Langage** : TypeScript en mode strict (`noImplicitAny`, `strictNullChecks`, etc.)
- **Bot Discord** : Discord.js v14
- **Serveur Web & API REST** : Express.js, Helmet, Express-Rate-Limit, Express-Session, CORS, Pino Logger
- **Base de Données Dynamique** : SQLite avec Better-SQLite3 (mode WAL activé)
- **Validation des Schémas** : Zod (validation des requêtes HTTP et des fichiers JSON déclaratifs)
- **Frontend** : React 18, Vite, TypeScript, Tailwind CSS, TanStack Query (React Query)
- **Routage Frontend** : React Router DOM v6
- **Composants & Graphiques** : Lucide React (icônes scientifiques et administratives), Recharts (statistiques d'activité)
- **Conteneurisation** : Docker multi-stage & Docker Compose

---

## 2. Arborescence du Projet

```text
/sciclub-manager
├── .env.example                          # Modèle de variables d'environnement
├── package.json                          # Racine npm workspaces (@sciclub/*)
├── tsconfig.base.json                    # Configuration TypeScript de base stricte
├── docker-compose.yml                    # Déploiement Docker bot + dashboard
├── README.md                             # Documentation complète
│
├── config/
│   ├── guilds/
│   │   └── 123456789012345678.json      # Configuration déclarative exemple pour un club
│   └── backups/                          # Sauvegardes horodatées automatiques
│
├── packages/
│   └── shared/                           # Schémas et types partagés
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── types/                    # Types Discord, Config, API et Entités
│           ├── schemas/                  # Schémas Zod (Config, Rôles, Salons, Événements, Projets...)
│           └── utils/                    # Calculs de permissions Discord bitwise & helpers
│
├── apps/
│   ├── bot/                              # Application Discord Bot
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts                  # Point d'entrée du bot
│   │       ├── client.ts                 # Instanciation Discord.js avec intents minimaux
│   │       ├── config/env.ts             # Validation Zod des variables d'environnement
│   │       ├── database/                 # Initialisation SQLite et schema.sql
│   │       ├── services/                 # Logique métier découplée
│   │       │   ├── configService.ts      # Lecture/écriture JSON, validation Zod & backups
│   │       │   ├── roleService.ts        # Gestion des rôles et contrôle hiérarchique
│   │       │   ├── channelService.ts     # Salons, catégories, verrouillage et slowmode
│   │       │   ├── permissionService.ts  # Overwrites 3 états (ALLOW / DENY / NEUTRAL)
│   │       │   ├── memberService.ts      # Gestion des membres et modération
│   │       │   ├── projectService.ts     # Projets et salons privés automatiques
│   │       │   ├── eventService.ts       # Événements, ateliers et rôles participants
│   │       │   ├── moderationService.ts  # Avertissements et auto-mute au seuil
│   │       │   ├── pointsService.ts      # Système de points et classement
│   │       │   └── auditLogService.ts    # Journalisation d'audit des actions
│   │       ├── commands/                 # Slash commands par domaine (general, club, admin)
│   │       └── events/                   # Événements Discord (ready, messageCreate, interactionCreate...)
│   │
│   └── web/                              # Serveur Express API + Dashboard React
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       ├── Dockerfile
│       ├── server/                       # Backend API REST
│       │   ├── index.ts                  # Point d'entrée serveur Express
│       │   ├── botClient.ts              # Client Discord connecté pour les actions API
│       │   ├── db.ts                     # Connexion SQLite
│       │   ├── middleware/               # Auth Discord OAuth2, Permissions & Validation Zod
│       │   └── routes/                   # Routes /api (auth, roles, channels, permissions, projects...)
│       └── src/                          # Frontend React SPA
│           ├── main.tsx
│           ├── App.tsx                   # Routage React Router
│           ├── index.css                 # Thème sombre scientifique Tailwind
│           ├── api/client.ts             # Client d'appel API typé
│           ├── context/AuthContext.tsx   # Contexte utilisateur et serveur actif
│           ├── components/               # Layout (Sidebar, Header) et composants réutilisables (Modal, Badge...)
│           └── pages/                    # 11 pages d'administration complètes
│
└── scripts/
    ├── migrate.js                        # Migration manuelle du schéma SQLite
    └── deploy.sh                         # Script d'installation et de déploiement
```

---

## 3. Permissions Minimales du Bot

Pour garantir une sécurité optimale, le bot **ne requiert pas la permission Administrateur (`Administrator`)**. Il utilise uniquement le jeu de permissions strictement nécessaires :

- **Voir les salons** (`ViewChannel`) : Lecture de l'arborescence des salons.
- **Envoyer des messages** (`SendMessages`) : Réponses aux interactions et messages de bienvenue.
- **Lire l'historique des messages** (`ReadMessageHistory`) : Consultation du contexte de salon.
- **Gérer les rôles** (`ManageRoles`) : Attribution des rôles configurés et gestion des participants.
- **Gérer les salons** (`ManageChannels`) : Création de salons de projet, catégories et verrouillage.
- **Gérer les messages** (`ManageMessages`) : Suppression et modération des messages.
- **Exclure temporairement des membres** (`ModerateMembers`) : Application des timeouts automatiques.
- **Créer des événements** (`CreateEvents`) : Enregistrement des événements planifiés.
- **Ajouter des réactions** (`AddReactions`) : Votes et sondages scientifiques.
- **Intégrer des liens & Joindre des fichiers** (`EmbedLinks`, `AttachFiles`) : Envoi des fiches d'événements et projets.

*Valeur numérique du bitfield calculé :* `268435456` ou calculé depuis le portail Discord Developers.

---

## 4. Modèle de Sécurité et Hiérarchie des Permissions

### Hiérarchie des rôles Discord
1. **Rôle du Bot** : Le rôle le plus élevé du bot détermine le plafond de ce qu'il peut attribuer, modifier ou supprimer. Le bot ne peut jamais modifier un rôle positionné au-dessus ou au même niveau que le sien.
2. **Hiérarchie de l'Opérateur** : Même si un utilisateur est administrateur sur le dashboard web, il ne peut pas modifier un rôle égal ou supérieur au sien dans la hiérarchie Discord, sauf s'il est le propriétaire légal du serveur (`Guild Owner`).
3. **Protection du rôle `@everyone`** : Interdiction absolue de supprimer ou de sur-privilégier le rôle `@everyone`.
4. **Anti-Élévation de Privilèges** : L'API et le dashboard refusent strictement d'accorder la permission `Administrator` à un rôle si l'utilisateur qui effectue la requête n'est pas lui-même administrateur Discord natif.
5. **Gestion des Overwrites à 3 états** :
   - `ALLOW` (Vert) : Accord explicite de la permission sur le salon.
   - `DENY` (Rouge) : Refus explicite de la permission sur le salon.
   - `NEUTRAL` (Gris) : Permission héritée des droits généraux du serveur.

---

## 5. Système Déclaratif JSON & Sauvegardes

Le comportement de chaque serveur est défini dans un fichier déclaratif :
`/config/guilds/{guildId}.json`

### Caractéristiques :
- **Validation Zod** : Chaque chargement et sauvegarde est validé par le schéma strict `GuildConfigFileSchema`.
- **Sauvegarde Horodatée Automatique** : À chaque modification enregistrée depuis le dashboard web ou la commande `/sync`, une copie horodatée est générée dans `/config/backups/{guildId}/{timestamp}.json`.
- **Restauration en un clic** : Possibilité de restaurer une version précédente directement depuis l'interface web ou via `/backup restaurer`.
- **Aucun secret dans le JSON** : Ne contient que des données organisationnelles publiques (noms, couleurs, identifiants stables `role:admin`, `channel:annonces`, paramètres de modération).

---

## 6. Commandes Discord Slash

### 👥 Commandes Générales & Club
- `/help` : Affiche le guide complet des commandes du SciClub.
- `/profil [membre]` : Affiche le profil scientifique, points de participation, badges et rôles.
- `/classement` : Affiche le top 10 des membres les plus investis dans le club.
- `/projet creer nom:... description:...` : Propose un nouveau projet et crée un salon privé.
- `/projet liste` : Affiche les projets scientifiques en cours et leurs contributeurs.
- `/projet rejoindre id:...` : Intègre l'équipe d'un projet et débloque l'accès au salon de travail.
- `/evenement creer titre:... type:... date:... lieu:...` : Planifie une conférence, atelier ou hackathon.
- `/evenement liste` : Affiche le calendrier des prochaines activités scientifiques.
- `/evenement inscrire id:...` : Réserve sa place et reçoit le rôle participant automatique.
- `/ressource ajouter titre:... url:... matiere:... description:...` : Partage un article, cours ou vidéo.
- `/ressource rechercher [matiere] [motcle]` : Filtre la bibliothèque scientifique.
- `/candidature envoyer filiere:... motivation:... interets:...` : Postule pour intégrer le club.
- `/candidature statut` : Suit l'état de validation de sa candidature.
- `/sondage creer question:... option1:... option2:...` : Lance un vote avec réactions numériques.

### ⚙️ Commandes Administratives (Staff)
- `/config afficher` : Résumé de la configuration JSON active.
- `/config recharger` : Valide et recharge la configuration à chaud sans redémarrage.
- `/role creer nom:... [couleur]` : Crée un rôle conforme à la hiérarchie.
- `/role attribuer membre:... role:...` : Assigne un rôle à un membre.
- `/role retirer membre:... role:...` : Retire un rôle à un membre.
- `/canal creer nom:... type:... [categorie]` : Crée un salon ou une catégorie.
- `/canal supprimer canal:...` : Supprime un salon Discord.
- `/permission ajouter canal:... role:... permission:... etat:...` : Configure un overwrite spécifique.
- `/permission retirer canal:... role:...` : Réinitialise un overwrite sur un salon.
- `/sync` : Synchronise l'ensemble du serveur avec le fichier JSON déclaratif.
- `/backup creer` : Déclenche une sauvegarde instantanée du fichier JSON.
- `/backup liste` : Liste les sauvegardes disponibles.
- `/backup restaurer id:...` : Restaure une sauvegarde spécifique.

---

## 7. Fonctionnalités du Dashboard Web

Le dashboard web est accessible sur `http://localhost:5173` (développement) ou `http://localhost:3001` (production).

- **Authentification Discord OAuth2** : Connexion sécurisée avec génération d'état `state` anti-CSRF et stockage des jetons en session côté serveur exclusivement.
- **Sélection du Serveur** : Filtre automatique affichant uniquement les serveurs où le bot est installé et où l'utilisateur dispose des prérogatives de gestion.
- **Vue d'ensemble & Métriques** : Cartes KPI, diagrammes de répartition Recharts, top contributeurs et flux d'audit en direct.
- **Gestion des Rôles** : Visualisation claire de la hiérarchie, badges de couleur, indicateurs d'éditabilité, modales de création et modification.
- **Salons & Pôles** : Arborescence classée par catégories, modification du sujet, curseur de slowmode et verrouillage d'urgence.
- **Matrice des Permissions** : Tableau interactif avec sélecteur de salon et de rôle permettant d'alterner les états `ALLOW` (vert), `DENY` (rouge) et `NEUTRAL` (gris).
- **Membres & Modération** : Recherche textuelle, détail des points et avertissements, attribution rapide de rôles et modales d'avertissement, timeout, expulsion et bannissement.
- **Projets & Événements** : Suivi des statuts (Idée, En cours, Terminé, Archivé) et gestion des fiches d'activités scientifiques.
- **Éditeur Déclaratif JSON** : Zone de code intégrée permettant d'éditer le fichier `{guildId}.json`, avec bouton de validation de schéma Zod, historique des sauvegardes et restauration instantanée.
- **Journal d'Audit** : Traçabilité chronologique détaillée de toutes les opérations administratives sensibles.

---

## 8. Guide d'Installation & Configuration Pas-à-Pas

### Étape 1 : Créer l'application sur le Portail Discord Developers
1. Rendez-vous sur le [Discord Developer Portal](https://discord.com/developers/applications).
2. Cliquez sur **New Application**, nommez-la par exemple **SciClub Manager**.
3. Allez dans l'onglet **Bot** :
   - Cliquez sur **Add Bot** ou **Reset Token** pour copier votre `DISCORD_BOT_TOKEN`.
   - Dans la section **Privileged Gateway Intents**, activez **Server Members Intent** et **Message Content Intent** si vous souhaitez analyser le contenu des messages pour les points.
4. Allez dans l'onglet **OAuth2** :
   - Copiez le `Client ID` et le `Client Secret`.
   - Dans **Redirects**, ajoutez l'URL de retour :  
     `http://localhost:3001/api/auth/callback` (ou votre domaine en production).

### Étape 2 : Inviter le Bot sur votre Serveur Discord
1. Dans l'onglet **OAuth2 > URL Generator** du portail Discord :
   - Cochez les scopes : `bot` et `applications.commands`.
   - Cochez les permissions :
     - *View Channels*
     - *Send Messages*
     - *Read Message History*
     - *Manage Roles*
     - *Manage Channels*
     - *Manage Messages*
     - *Moderate Members*
     - *Create Events*
     - *Add Reactions*
     - *Embed Links*
     - *Attach Files*
2. Copiez l'URL générée, collez-la dans votre navigateur et sélectionnez votre serveur de club scientifique.
3. **IMPORTANT** : Dans les paramètres de votre serveur Discord (*Paramètres du serveur > Rôles*), veillez à positionner le rôle attribué à **SciClub Manager** au-dessus des rôles qu'il devra gérer (membres, modérateurs, chefs de projets, etc.).

### Étape 3 : Configuration Locale du Projet
1. Clonez ou placez-vous dans le répertoire du projet.
2. Copiez le fichier `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```
3. Renseignez vos identifiants réels dans `.env` :
   ```env
   NODE_ENV=development
   LOG_LEVEL=info
   DISCORD_BOT_TOKEN=VOTRE_TOKEN_BOT_ICI
   DISCORD_CLIENT_ID=VOTRE_CLIENT_ID_ICI
   DISCORD_CLIENT_SECRET=VOTRE_CLIENT_SECRET_ICI
   DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/callback
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   SESSION_SECRET=cle_secrete_aleatoire_de_au_moins_32_caracteres_longs
   DATABASE_PATH=../../data/sciclub.sqlite
   CONFIG_PATH=../../config/guilds
   BACKUP_PATH=../../config/backups
   ```

### Étape 4 : Adapter la Configuration JSON
Renommez le fichier exemple `/config/guilds/123456789012345678.json` avec l'ID réel de votre serveur Discord (ex: `config/guilds/987654321098765432.json`).

---

## 9. Lancement & Déploiement

### Option A : Lancement en Développement (Recommandé pour tester)

1. **Installer les dépendances du monorepo** :
   ```bash
   npm install
   ```

2. **Compiler le package partagé (`@sciclub/shared`)** :
   ```bash
   npm run build --workspace=@sciclub/shared
   ```

3. **Initialiser la base SQLite** :
   ```bash
   node scripts/migrate.js
   ```

4. **Lancer le Bot et le Dashboard en parallèle** :
   - Dans un premier terminal (Bot Discord) :
     ```bash
     npm run dev:bot
     ```
   - Dans un second terminal (API Express + Dashboard React) :
     ```bash
     npm run dev:web
     ```
5. Ouvrez votre navigateur sur `http://localhost:5173` et connectez-vous avec Discord !

---

### Option B : Déploiement Production avec Docker Compose

Pour un déploiement sécurisé et autonome sur un serveur VPS (Linux/Ubuntu/Debian) :

1. Assurez-vous que Docker et Docker Compose sont installés.
2. Vérifiez que votre fichier `.env` est configuré avec `NODE_ENV=production`.
3. Lancez les conteneurs :
   ```bash
   docker-compose up -d --build
   ```
4. Vos conteneurs sont démarrés :
   - `sciclub_bot` : tourne en arrière-plan et gère Discord.
   - `sciclub_web` : sert l'API et le frontend compilé sur le port `3001`.

---

## 10. Précautions de Sécurité

1. **Tokens et Secrets** : Aucun secret ou mot de passe n'est exposé au frontend. Le jeton d'accès utilisateur et le token du bot restent confinés côté serveur.
2. **Session Cookies** : Les cookies de session utilisent les drapeaux `httpOnly: true`, `sameSite: 'lax'` et `secure: true` en production.
3. **Hiérarchie stricte** : Le bot refuse toute modification d'un rôle supérieur ou égal au sien, protégeant le serveur contre les corruptions de privilèges.
4. **Rate Limiting** : Les endpoints sensibles et d'authentification OAuth2 sont protégés contre les attaques par force brute via `express-rate-limit`.
5. **Audits Horodatés** : Toute action administrative réalisée via le Dashboard ou les Slash Commands produit une ligne indélébile dans la table `audit_logs` de la base de données SQLite.

---

*Développé avec rigueur et passion pour l'excellence et la transmission scientifique.*
