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
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

export async function initDiscordClient(token: string): Promise<void> {
  if (!token) {
    logger.warn('⚠️ Aucun DISCORD_BOT_TOKEN fourni pour le client API.');
    return;
  }
  try {
    await discordClient.login(token);
    logger.info(`🤖 Client Discord Web connecté : ${discordClient.user?.tag}`);
  } catch (error) {
    logger.error({ error }, '❌ Impossible de connecter le client Discord Web');
  }
}
