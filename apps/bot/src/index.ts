import { createDiscordClient } from './client.js';
import { events } from './events/index.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import './database/db.js';

async function bootstrap() {
  logger.info('🚀 Démarrage du bot SciClub Manager...');

  const client = createDiscordClient();

  // Enregistrement dynamique des événements
  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args: any[]) => (event.execute as any)(...args));
    } else {
      client.on(event.name, (...args: any[]) => (event.execute as any)(...args));
    }
  }

  // Gestion des signaux de fin de processus
  const handleShutdown = async (signal: string) => {
    logger.info(`Signal ${signal} reçu. Arrêt propre du bot...`);
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Connexion à Discord
  try {
    await client.login(env.DISCORD_BOT_TOKEN);
  } catch (error) {
    logger.fatal({ error }, '❌ Échec de la connexion à l\'API Discord :');
    process.exit(1);
  }
}

bootstrap().catch(err => {
  logger.fatal({ err }, 'Erreur fatale au démarrage du bot SciClub :');
  process.exit(1);
});
