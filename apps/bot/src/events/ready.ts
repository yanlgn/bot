import { Client, Events, REST, Routes } from 'discord.js';
import { commands } from '../commands/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client) {
  logger.info(`🤖 SciClub Bot connecté en tant que ${client.user?.tag} !`);

  // Enregistrement global ou par serveur des slash commands
  try {
    const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
    const body = commands.map(cmd => cmd.data.toJSON());

    logger.info(`🚀 Enregistrement de ${body.length} commandes slash...`);

    await rest.put(
      Routes.applicationCommands(env.DISCORD_CLIENT_ID),
      { body }
    );

    logger.info('✅ Commandes slash enregistrées avec succès.');
  } catch (error) {
    logger.error({ error }, '❌ Erreur lors de l\'enregistrement des commandes slash :');
  }
}
