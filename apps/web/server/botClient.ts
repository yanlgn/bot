import { Client, GatewayIntentBits } from 'discord.js';
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production'
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
});

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

export async function initDiscordClient(token: string): Promise<void> {
  const actualToken = token || process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  if (!actualToken) {
    logger.warn('⚠️ Aucun token Discord fourni pour le client API web (DISCORD_BOT_TOKEN / DISCORD_TOKEN).');
    return;
  }
  try {
    await discordClient.login(actualToken);
    logger.info(`🤖 Client Discord Web connecté avec succès : ${discordClient.user?.tag}`);
  } catch (error: any) {
    logger.error({ error: error.message || error }, '❌ Impossible de connecter le client Discord Web');
  }
}
