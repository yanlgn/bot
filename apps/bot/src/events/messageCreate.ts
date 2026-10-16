import { Events, Message } from 'discord.js';
import { ConfigService } from '../services/configService.js';
import { PointsService } from '../services/pointsService.js';

// Cooldown mémoire anti-spam pour l'attribution des points (1 minute par utilisateur)
const pointsCooldown = new Map<string, number>();

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  // Ignorer les bots et les messages privés
  if (message.author.bot || !message.guild) return;

  const config = ConfigService.getGuildConfig(message.guild.id);
  if (!config) return;

  // 1. Attribution des points de message
  if (config.points.enabled && config.points.messagePoints > 0) {
    const cooldownKey = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const lastEarned = pointsCooldown.get(cooldownKey) || 0;

    // Minimum 30 secondes entre chaque gain de points pour message
    if (now - lastEarned > 30 * 1000) {
      pointsCooldown.set(cooldownKey, now);
      PointsService.addPoints(message.guild.id, message.author.id, config.points.messagePoints);
    }
  }
}
