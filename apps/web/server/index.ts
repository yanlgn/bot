import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttpModule from 'pino-http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { logger, initDiscordClient } from './botClient.js';
import { apiRouter } from './routes/index.js';
import { handleOAuthLogin, handleOAuthCallback } from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chargement des variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

// Nécessaire derrière le reverse proxy HTTPS de Render
app.set('trust proxy', 1);

// Sécurité Web
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions sécurisées garanties derrière proxy
app.use(session({
  name: 'cortex_session',
  secret: process.env.SESSION_SECRET || 'cortex_secret_key_session_secure_2026_xyz',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: 'auto',
    sameSite: 'lax',
    path: '/',
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 jours
  }
}));

// Logs HTTP
const pinoHttpMiddleware = typeof pinoHttpModule === 'function' ? pinoHttpModule : (pinoHttpModule as any).default || (pinoHttpModule as any).pinoHttp;
if (pinoHttpMiddleware) {
  app.use(pinoHttpMiddleware({ logger }));
}

// Routes API
app.use('/api', apiRouter);

// Routes OAuth2 directes (supporte tous les schémas enregistrés dans Discord Developer Portal)
app.get('/admin/auth/discord/callback', handleOAuthCallback);
app.get('/admin/auth/discord', handleOAuthLogin);
app.get('/auth/discord/callback', handleOAuthCallback);
app.get('/auth/discord', handleOAuthLogin);
app.get('/auth/callback', handleOAuthCallback);

// Service des fichiers statiques du frontend en production
if (isProduction) {
  const staticPath = path.resolve(__dirname, '../dist');
  app.use(express.static(staticPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Gestion globale des erreurs
app.use(errorHandler);

// Démarrage du serveur et du client Discord
async function startServer() {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || '';
  await initDiscordClient(token);

  app.listen(PORT, () => {
    logger.info(`🌐 Serveur API et Dashboard SciClub à l'écoute sur http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  logger.fatal({ err }, 'Erreur au démarrage du serveur Express :');
  process.exit(1);
});
