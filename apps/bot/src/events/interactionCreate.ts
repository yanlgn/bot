import { Events, Interaction } from 'discord.js';
import { commandMap } from '../commands/index.js';
import { logger } from '../utils/logger.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  if (!command) {
    logger.warn(`Commande slash "${interaction.commandName}" non reconnue.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error: any) {
    logger.error({ error, command: interaction.commandName, user: interaction.user.tag }, 'Erreur commande slash');

    const replyPayload = {
      content: `❌ Une erreur est survenue lors de l'exécution de cette commande : ${error.message || 'Erreur interne'}`,
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyPayload).catch(() => null);
    } else {
      await interaction.reply(replyPayload).catch(() => null);
    }
  }
}
