import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttpModule from 'pino-http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { logger, initDiscordClient } from './botClient.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chargement des variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

// Sécurité Web
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Sessions sécurisées
app.use(session({
  name: 'sciclub_session',
  secret: process.env.SESSION_SECRET || 'sciclub_secret_key_long_and_complex_12345',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Logs HTTP
const pinoHttpMiddleware = typeof pinoHttpModule === 'function' ? pinoHttpModule : (pinoHttpModule as any).default || (pinoHttpModule as any).pinoHttp;
if (pinoHttpMiddleware) {
  app.use(pinoHttpMiddleware({ logger }));
}

// Routes API
app.use('/api', apiRouter);

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
  await initDiscordClient(process.env.DISCORD_BOT_TOKEN || '');

  app.listen(PORT, () => {
    logger.info(`🌐 Serveur API et Dashboard SciClub à l'écoute sur http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  logger.fatal({ err }, 'Erreur au démarrage du serveur Express :');
  process.exit(1);
});
