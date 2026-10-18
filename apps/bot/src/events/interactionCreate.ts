import { Events, Interaction } from 'discord.js';
import { commandMap } from '../commands/index.js';
import { logger } from '../utils/logger.js';
import {
  showDepartmentApplicationModal,
  handleDepartmentModalSubmit,
  handleDepartmentStaffReview
} from '../interactions/departmentInteractions.js';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  try {
    // 1. Commandes Slash
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) {
        logger.warn(`Commande slash "${interaction.commandName}" non reconnue.`);
        return;
      }
      await command.execute(interaction);
      return;
    }

    // 2. Sélection de pôle depuis le menu déroulant
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'cortex_dept_select') {
        const deptId = interaction.values[0];
        if (deptId) {
          await showDepartmentApplicationModal(interaction, deptId);
        }
        return;
      }
    }

    // 3. Boutons interactifs (candidature ou validation staff)
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('cortex_dept_btn_')) {
        const deptId = interaction.customId.replace('cortex_dept_btn_', '');
        await showDepartmentApplicationModal(interaction, deptId);
        return;
      }

      if (interaction.customId.startsWith('cortex_dept_app_') || interaction.customId.startsWith('cortex_dept_rej_')) {
        await handleDepartmentStaffReview(interaction);
        return;
      }
    }

    // 4. Soumission du formulaire Modal de candidature
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('cortex_dept_modal_')) {
        await handleDepartmentModalSubmit(interaction);
        return;
      }
    }
  } catch (error: any) {
    logger.error({ error, user: interaction.user.tag }, 'Erreur interaction discord');

    const replyPayload = {
      content: `❌ Une erreur est survenue lors du traitement de l'action : ${error.message || 'Erreur interne'}`,
      ephemeral: true
    };

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyPayload).catch(() => null);
      } else {
        await interaction.reply(replyPayload).catch(() => null);
      }
    }
  }
}
