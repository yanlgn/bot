import { Events, Interaction } from 'discord.js';
import { commandMap } from '../commands/index.js';
import { logger } from '../utils/logger.js';
import {
  showDepartmentApplicationModal,
  handleDepartmentModalSubmit,
  handleDepartmentStaffReview
} from '../interactions/departmentInteractions.js';
import {
  handleSuggestionButtonClick,
  handleSuggestionModalSubmit,
  handleSuggestionStaffReview
} from '../interactions/suggestionInteractions.js';
import {
  handleCandidatureButtonClick,
  handleCandidatureModalSubmit,
  handleCandidatureStaffReview
} from '../interactions/candidatureInteractions.js';
import {
  showEventReservationModal,
  handleEventModalSubmit,
  handleEventCancellation
} from '../interactions/eventInteractions.js';

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

    // 2. Sélection depuis menus déroulants
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'cortex_dept_select') {
        const deptId = interaction.values[0];
        if (deptId) {
          await showDepartmentApplicationModal(interaction, deptId);
        }
        return;
      }

      if (interaction.customId.startsWith('cortex_ev_sess_select_') || interaction.customId.startsWith('cortex_ev_sess_select:')) {
        const eventId = interaction.customId.replace(/^cortex_ev_sess_select[_:]/, '');
        const sessionId = interaction.values[0];
        if (eventId && sessionId) {
          await showEventReservationModal(interaction, eventId, sessionId);
        }
        return;
      }
    }

    // 3. Boutons interactifs (candidature, suggestions, événements ou validations staff)
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('cortex_ev_join_') || interaction.customId.startsWith('cortex_ev_join:')) {
        const raw = interaction.customId.replace(/^cortex_ev_join[_:]/, '');
        let eventId = '';
        let sessionId = 'main';

        if (raw.includes(':')) {
          const parts = raw.split(':');
          eventId = parts[0] || '';
          sessionId = parts[1] || 'main';
        } else {
          const lastUnderscore = raw.lastIndexOf('_');
          if (lastUnderscore !== -1) {
            eventId = raw.substring(0, lastUnderscore);
            sessionId = raw.substring(lastUnderscore + 1) || 'main';
          } else {
            eventId = raw;
          }
        }

        if (eventId) {
          await showEventReservationModal(interaction, eventId, sessionId);
        }
        return;
      }

      if (interaction.customId.startsWith('cortex_ev_leave_') || interaction.customId.startsWith('cortex_ev_leave:')) {
        const eventId = interaction.customId.replace(/^cortex_ev_leave[_:]/, '');
        await handleEventCancellation(interaction, eventId);
        return;
      }

      if (interaction.customId === 'cortex_cand_btn') {
        await handleCandidatureButtonClick(interaction);
        return;
      }

      if (interaction.customId.startsWith('cortex_cand_app_') || interaction.customId.startsWith('cortex_cand_rej_')) {
        await handleCandidatureStaffReview(interaction);
        return;
      }

      if (interaction.customId === 'cortex_suggestion_btn') {
        await handleSuggestionButtonClick(interaction);
        return;
      }

      if (interaction.customId.startsWith('cortex_sug_')) {
        await handleSuggestionStaffReview(interaction);
        return;
      }

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

    // 4. Soumission des formulaires Modals
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('cortex_ev_modal_') || interaction.customId.startsWith('cortex_ev_modal:')) {
        await handleEventModalSubmit(interaction);
        return;
      }

      if (interaction.customId === 'cortex_cand_modal') {
        await handleCandidatureModalSubmit(interaction);
        return;
      }

      if (interaction.customId === 'cortex_suggestion_modal') {
        await handleSuggestionModalSubmit(interaction);
        return;
      }

      if (interaction.customId.startsWith('cortex_dept_modal_') || interaction.customId.startsWith('cortex_dept_modal:')) {
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
