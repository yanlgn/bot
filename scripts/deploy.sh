#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🚀 Déploiement de SciClub Manager en cours"
echo "=========================================="

# 1. Vérification du fichier .env
if [ ! -f .env ]; then
  echo "❌ Erreur : Le fichier .env n'existe pas. Veuillez copier .env.example vers .env et renseigner vos clés."
  exit 1
fi

# 2. Installation des dépendances du monorepo
echo "📦 Installation des dépendances npm..."
npm install

# 3. Migration de la base SQLite
echo "🔄 Exécution des migrations SQLite..."
node scripts/migrate.js

# 4. Compilation TypeScript de tous les packages
echo "🔨 Compilation des packages et du frontend..."
npm run build

echo "=========================================="
echo "✅ Déploiement préparé avec succès !"
echo "Pour démarrer en conteneurs Docker :"
echo "  docker-compose up -d --build"
echo "Ou manuellement avec PM2 ou Node :"
echo "  npm run start --workspace=@sciclub/bot"
echo "  npm run start --workspace=@sciclub/web"
echo "=========================================="
